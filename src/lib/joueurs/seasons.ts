import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategorieFFF, getSaisonStart, type Sexe } from "@/lib/categorie-fff";
import { getLicencePrice, type Nature, type Niveau } from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import { chunk } from "@/lib/chunk";

export type PlayerAttributes = {
  id: string;
  date_naissance: string;
  sexe: Sexe;
  nature: Nature;
  niveau: Niveau;
  hors_sarcelles: boolean;
  remise: number;
  /** Prix actuellement stocké sur la fiche joueur, pour le resynchroniser si une règle de prix change. */
  licence_price?: number;
};

export type PlayerSeasonSnapshot = {
  player_id: string;
  saison_start: number;
  categorie: string;
  licence_price: number;
  nature: Nature;
  niveau: Niveau;
  hors_sarcelles: boolean;
  remise: number;
};

function computeSnapshot(
  player: PlayerAttributes,
  saisonStart: number
): PlayerSeasonSnapshot {
  const categorie = getCategorieFFF(
    parseDateOnly(player.date_naissance),
    player.sexe,
    saisonStart
  );
  return {
    player_id: player.id,
    saison_start: saisonStart,
    categorie,
    licence_price: getLicencePrice(
      categorie,
      player.sexe,
      player.nature,
      player.hors_sarcelles,
      player.remise,
      player.niveau
    ),
    nature: player.nature,
    niveau: player.niveau,
    hors_sarcelles: player.hors_sarcelles,
    remise: player.remise,
  };
}

function sameSnapshot(a: PlayerSeasonSnapshot, b: PlayerSeasonSnapshot) {
  return (
    a.categorie === b.categorie &&
    Math.abs(a.licence_price - b.licence_price) < 0.001 &&
    a.nature === b.nature &&
    a.niveau === b.niveau &&
    a.hors_sarcelles === b.hors_sarcelles &&
    Math.abs(a.remise - b.remise) < 0.001
  );
}

/**
 * Fige (saison passée) ou rafraîchit (saison en cours ou à venir) l'instantané
 * tarifaire d'un ensemble de joueurs pour une saison donnée. Ne réécrit
 * jamais un instantané déjà figé pour une saison passée.
 */
export async function ensurePlayerSeasons(
  supabase: SupabaseClient,
  players: PlayerAttributes[],
  saisonStart: number,
  { canWrite }: { canWrite: boolean }
): Promise<Map<string, PlayerSeasonSnapshot>> {
  if (players.length === 0) return new Map();

  // Par paquets : au-delà de quelques centaines d'identifiants, l'URL de la
  // requête dépasse la limite du serveur et la lecture échoue (après un long
  // délai), ce qui forçait la réécriture de tous les instantanés.
  const existing: PlayerSeasonSnapshot[] = [];
  const batches = await Promise.all(
    chunk(
      players.map((p) => p.id),
      150
    ).map(async (ids) => {
      const { data, error } = await supabase
        .from("player_seasons")
        .select(
          "player_id, saison_start, categorie, licence_price, nature, niveau, hors_sarcelles, remise"
        )
        .eq("saison_start", saisonStart)
        .in("player_id", ids);
      if (error) console.error("ensurePlayerSeasons select:", error.message);
      return data ?? [];
    })
  );
  for (const batch of batches) existing.push(...batch);

  const result = new Map<string, PlayerSeasonSnapshot>();
  const existingById = new Map<string, PlayerSeasonSnapshot>();
  for (const row of existing ?? []) {
    const snapshot = {
      ...row,
      licence_price: Number(row.licence_price),
      remise: Number(row.remise),
    };
    existingById.set(row.player_id, snapshot);
    result.set(row.player_id, snapshot);
  }
  const existingIds = new Set(existingById.keys());

  // Une saison non encore écoulée (en cours ou future) reste vivante : on la
  // recalcule à chaque consultation. Seule une saison déjà terminée est figée
  // définitivement dès sa première consultation.
  const isLiveSaison = saisonStart >= getSaisonStart();
  const toUpsert: PlayerSeasonSnapshot[] = [];
  const toInsert: PlayerSeasonSnapshot[] = [];
  const isCurrentSaison = saisonStart === getSaisonStart();
  const staleIdsByPrice = new Map<number, string[]>();

  for (const player of players) {
    if (isLiveSaison) {
      const snapshot = computeSnapshot(player, saisonStart);
      result.set(player.id, snapshot);
      // Inutile de réécrire un instantané déjà à jour : à chaque affichage de
      // la liste, des milliers d'écritures ralentissaient la page.
      const previous = existingById.get(player.id);
      if (!previous || !sameSnapshot(previous, snapshot)) {
        toUpsert.push(snapshot);
      }
      if (
        isCurrentSaison &&
        player.licence_price !== undefined &&
        Math.abs(player.licence_price - snapshot.licence_price) > 0.001
      ) {
        const ids = staleIdsByPrice.get(snapshot.licence_price) ?? [];
        ids.push(player.id);
        staleIdsByPrice.set(snapshot.licence_price, ids);
      }
    } else if (!existingIds.has(player.id)) {
      const snapshot = computeSnapshot(player, saisonStart);
      result.set(player.id, snapshot);
      toInsert.push(snapshot);
    }
  }

  if (!canWrite) return result;

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("player_seasons").upsert(
      toUpsert.map((s) => ({ ...s, updated_at: new Date().toISOString() })),
      { onConflict: "player_id,saison_start" }
    );
    if (error) console.error("ensurePlayerSeasons upsert:", error.message);
  }
  // Une règle de prix a changé : le prix stocké sur la fiche (utilisé par les
  // soldes, relances et exports) est resynchronisé sur le prix recalculé.
  for (const [price, ids] of staleIdsByPrice) {
    for (const batch of chunk(ids, 150)) {
      const { error } = await supabase
        .from("players")
        .update({ licence_price: price })
        .in("id", batch);
      if (error) console.error("ensurePlayerSeasons price sync:", error.message);
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from("player_seasons").insert(toInsert);
    // 23505 : quelqu'un d'autre l'a figé entre-temps (course bénigne), ignoré.
    if (error && error.code !== "23505") {
      console.error("ensurePlayerSeasons insert:", error.message);
    }
  }

  return result;
}

/**
 * Dernière saison connue : au minimum la saison suivant la saison réelle
 * (toujours proposée d'avance), ou plus loin si des saisons ont déjà été
 * ajoutées manuellement (cf. addNextSaison) au-delà de cette limite.
 */
export async function getMaxKnownSaisonStart(
  supabase: SupabaseClient
): Promise<number> {
  const current = getSaisonStart();
  const { data } = await supabase
    .from("player_seasons")
    .select("saison_start")
    .order("saison_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Math.max(current + 1, data?.saison_start ?? 0);
}

/**
 * Fige/rafraîchit l'instantané de la saison réelle en cours pour un joueur.
 * Utilisé par createPlayer/updatePlayer, qui ne touchent jamais qu'à la
 * saison réelle du jour.
 */
export async function upsertCurrentPlayerSeason(
  supabase: SupabaseClient,
  player: PlayerAttributes
) {
  const snapshot = computeSnapshot(player, getSaisonStart());
  const { error } = await supabase
    .from("player_seasons")
    .upsert(
      { ...snapshot, updated_at: new Date().toISOString() },
      { onConflict: "player_id,saison_start" }
    );
  return error;
}
