import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategorieFFF, getSaisonStart, type Sexe } from "@/lib/categorie-fff";
import { getLicencePrice } from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";

export type PlayerAttributes = {
  id: string;
  date_naissance: string;
  sexe: Sexe;
  mute: boolean;
  hors_sarcelles: boolean;
  remise: number;
};

export type PlayerSeasonSnapshot = {
  player_id: string;
  saison_start: number;
  categorie: string;
  licence_price: number;
  mute: boolean;
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
      player.mute,
      player.hors_sarcelles,
      player.remise
    ),
    mute: player.mute,
    hors_sarcelles: player.hors_sarcelles,
    remise: player.remise,
  };
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

  const { data: existing } = await supabase
    .from("player_seasons")
    .select(
      "player_id, saison_start, categorie, licence_price, mute, hors_sarcelles, remise"
    )
    .eq("saison_start", saisonStart)
    .in(
      "player_id",
      players.map((p) => p.id)
    );

  const result = new Map<string, PlayerSeasonSnapshot>();
  const existingIds = new Set<string>();
  for (const row of existing ?? []) {
    existingIds.add(row.player_id);
    result.set(row.player_id, {
      ...row,
      licence_price: Number(row.licence_price),
      remise: Number(row.remise),
    });
  }

  // Une saison non encore écoulée (en cours ou future) reste vivante : on la
  // recalcule à chaque consultation. Seule une saison déjà terminée est figée
  // définitivement dès sa première consultation.
  const isLiveSaison = saisonStart >= getSaisonStart();
  const toUpsert: PlayerSeasonSnapshot[] = [];
  const toInsert: PlayerSeasonSnapshot[] = [];

  for (const player of players) {
    if (isLiveSaison) {
      const snapshot = computeSnapshot(player, saisonStart);
      result.set(player.id, snapshot);
      toUpsert.push(snapshot);
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
