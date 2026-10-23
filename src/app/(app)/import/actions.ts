"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { getLicencePrice, isHorsSarcelles } from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import type { ImportedRow } from "@/lib/joueurs/import-parsing";

type PlayerRecord = {
  nom: string;
  prenom: string;
  date_naissance: string;
  sexe: "M" | "F";
  email: string | null;
  telephone: string | null;
  ville: string;
  nature: ImportedRow["nature"];
  hors_sarcelles: boolean;
  licence_price: number;
  notes: string | null;
};

function toRecord(row: ImportedRow): PlayerRecord {
  const categorie = getCategorieFFF(
    parseDateOnly(row.date_naissance),
    row.sexe,
    getSaisonStart()
  );
  const horsSarcelles = isHorsSarcelles(row.ville);
  return {
    nom: row.nom,
    prenom: row.prenom,
    date_naissance: row.date_naissance,
    sexe: row.sexe,
    email: row.email || null,
    telephone: row.telephone || null,
    ville: row.ville,
    nature: row.nature,
    hors_sarcelles: horsSarcelles,
    licence_price: getLicencePrice(
      categorie,
      row.sexe,
      row.nature,
      horsSarcelles
    ),
    notes: row.note || null,
  };
}

const keyOf = (r: { nom: string; prenom: string; date_naissance: string }) =>
  `${r.nom}|${r.prenom}|${r.date_naissance}`;

/**
 * Importe un lot de joueurs (le client envoie le fichier par paquets : un seul
 * appel pour 1300 lignes dépassait la durée maximale d'une requête serveur).
 * Les joueurs du lot sont enregistrés en une seule opération ; en cas de
 * doublon dans le lot, on retombe sur un enregistrement ligne par ligne pour
 * n'écarter que les doublons.
 */
export async function importPlayers(rows: ImportedRow[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");
  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

  if (!isAdmin) {
    return { error: "Seul un administrateur peut importer des joueurs." };
  }

  const saisonStart = getSaisonStart();
  let skipped = 0;
  const errors: string[] = [];

  const records = rows.map((row) => ({ row, record: toRecord(row) }));
  const insertedIds = new Map<string, string>();

  const bulk = await supabase
    .from("players")
    .insert(records.map((r) => r.record))
    .select("id, nom, prenom, date_naissance");

  if (!bulk.error) {
    for (const p of bulk.data) insertedIds.set(keyOf(p), p.id);
  } else if (bulk.error.code === "23505") {
    for (const { row, record } of records) {
      const single = await supabase
        .from("players")
        .insert(record)
        .select("id, nom, prenom, date_naissance")
        .single();
      if (single.error) {
        if (single.error.code === "23505") skipped += 1;
        else errors.push(`${row.nom} ${row.prenom} : ${single.error.message}`);
      } else {
        insertedIds.set(keyOf(single.data), single.data.id);
      }
    }
  } else {
    return { error: bulk.error.message };
  }

  const nowIso = new Date().toISOString();
  const payments = records.flatMap(({ row }) => {
    const playerId = insertedIds.get(keyOf(row));
    if (!playerId || !row.montant || row.montant <= 0) return [];
    return [
      {
        player_id: playerId,
        mode: "non_renseigne",
        amount: row.montant,
        saison_start: saisonStart,
        created_by: user?.id,
        // Toujours renseigné : dans une insertion groupée, une clé absente sur
        // certaines lignes est envoyée à null (et non à la valeur par défaut).
        created_at: row.date_reglement
          ? `${row.date_reglement}T12:00:00Z`
          : nowIso,
      },
    ];
  });

  let paymentsCreated = 0;
  if (payments.length > 0) {
    const { error: paymentError } = await supabase
      .from("payments")
      .insert(payments);
    if (paymentError) {
      errors.push(
        `${payments.length} paiement(s) non enregistré(s) : ${paymentError.message}`
      );
    } else {
      paymentsCreated = payments.length;
    }
  }

  // Pas de revalidatePath : le client importe par lots et rafraîchit la page
  // une seule fois à la fin.
  return { imported: insertedIds.size, skipped, paymentsCreated, errors };
}
