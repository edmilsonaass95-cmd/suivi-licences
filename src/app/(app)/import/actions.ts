"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { getLicencePrice, isHorsSarcelles } from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import type { ImportedRow } from "@/lib/joueurs/import-parsing";

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
  let imported = 0;
  let skipped = 0;
  let paymentsCreated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const categorie = getCategorieFFF(
      parseDateOnly(row.date_naissance),
      row.sexe,
      getSaisonStart()
    );
    const horsSarcelles = isHorsSarcelles(row.ville);
    const licencePrice = getLicencePrice(
      categorie,
      row.sexe,
      row.nature,
      horsSarcelles
    );

    const { data: inserted, error } = await supabase
      .from("players")
      .insert({
        nom: row.nom,
        prenom: row.prenom,
        date_naissance: row.date_naissance,
        sexe: row.sexe,
        email: row.email || null,
        telephone: row.telephone || null,
        ville: row.ville,
        nature: row.nature,
        hors_sarcelles: horsSarcelles,
        licence_price: licencePrice,
        notes: row.note || null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        skipped += 1;
      } else {
        errors.push(`${row.nom} ${row.prenom} : ${error.message}`);
      }
      continue;
    }
    imported += 1;

    if (row.montant && row.montant > 0) {
      const { error: paymentError } = await supabase.from("payments").insert({
        player_id: inserted.id,
        mode: "non_renseigne",
        amount: row.montant,
        saison_start: saisonStart,
        created_by: user?.id,
      });
      if (paymentError) {
        errors.push(
          `${row.nom} ${row.prenom} : joueur importé mais paiement non enregistré (${paymentError.message})`
        );
      } else {
        paymentsCreated += 1;
      }
    }
  }

  revalidatePath("/joueurs");
  return { imported, skipped, paymentsCreated, errors };
}
