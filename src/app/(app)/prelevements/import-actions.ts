"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { getSaisonStart } from "@/lib/categorie-fff";
import { chunk } from "@/lib/chunk";
import type { PrelevementStatut } from "@/lib/joueurs/statut-labels";

const ID_BATCH_SIZE = 150;

export type PrelevementImportEntry = {
  playerId: string;
  nom: string;
  prenom: string;
  echeances: {
    ref: string;
    montant: number;
    date: string;
    statut: PrelevementStatut;
  }[];
};

type ExistingRow = {
  id: string;
  payment_id: string;
  numero_echeance: number;
  montant: number;
  date_prelevement: string;
  statut: PrelevementStatut;
  reference_externe: string;
};

export async function importPrelevements(entries: PrelevementImportEntry[]) {
  const { canWrite } = await getCurrentUserRoles();
  if (!canWrite) {
    return { error: "Action réservée aux administrateurs et gestionnaires." };
  }
  if (entries.length === 0) return { error: "Aucune ligne à importer." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const saisonStart = getSaisonStart();

  const playerIds = entries.map((e) => e.playerId);

  // Étape 1 : retrouver, pour chaque joueur, le paiement "prélèvement en
  // ligne" déjà créé par un import précédent (s'il existe).
  const existingPayments: { id: string; player_id: string }[] = [];
  for (const batch of chunk(playerIds, ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("payments")
      .select("id, player_id")
      .eq("mode", "prelevement")
      .in("player_id", batch);
    if (error) return { error: error.message };
    if (data) existingPayments.push(...data);
  }
  const paymentIdByPlayer = new Map(
    existingPayments.map((p) => [p.player_id, p.id])
  );
  const paymentIds = existingPayments.map((p) => p.id);

  // Étape 2 : récupérer les échéances déjà importées (reference_externe
  // non nulle) sur ces paiements, pour mise à jour plutôt que doublon.
  const existingRows: ExistingRow[] = [];
  for (const batch of chunk(paymentIds, ID_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from("prelevements")
      .select(
        "id, payment_id, numero_echeance, montant, date_prelevement, statut, reference_externe"
      )
      .in("payment_id", batch)
      .not("reference_externe", "is", null);
    if (error) return { error: error.message };
    if (data) {
      existingRows.push(
        ...data.map((r) => ({ ...r, montant: Number(r.montant) }))
      );
    }
  }
  const existingRowsByPayment = new Map<string, ExistingRow[]>();
  for (const row of existingRows) {
    const list = existingRowsByPayment.get(row.payment_id) ?? [];
    list.push(row);
    existingRowsByPayment.set(row.payment_id, list);
  }

  let playersImported = 0;
  let echeancesCreated = 0;
  let echeancesUpdated = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.echeances.length === 0) continue;

    let paymentId = paymentIdByPlayer.get(entry.playerId) ?? null;
    const existingForPayment = paymentId
      ? (existingRowsByPayment.get(paymentId) ?? [])
      : [];
    const existingByRef = new Map(
      existingForPayment.map((r) => [r.reference_externe, r])
    );

    type FinalRow = {
      id?: string;
      ref: string;
      montant: number;
      date: string;
      statut: PrelevementStatut;
      isNew: boolean;
      changed: boolean;
    };

    const finalRows: FinalRow[] = existingForPayment.map((r) => ({
      id: r.id,
      ref: r.reference_externe,
      montant: r.montant,
      date: r.date_prelevement,
      statut: r.statut,
      isNew: false,
      changed: false,
    }));

    for (const echeance of entry.echeances) {
      const existing = existingByRef.get(echeance.ref);
      if (existing) {
        const row = finalRows.find((r) => r.ref === echeance.ref)!;
        if (
          row.montant !== echeance.montant ||
          row.date !== echeance.date ||
          row.statut !== echeance.statut
        ) {
          row.montant = echeance.montant;
          row.date = echeance.date;
          row.statut = echeance.statut;
          row.changed = true;
        }
      } else {
        finalRows.push({
          ref: echeance.ref,
          montant: echeance.montant,
          date: echeance.date,
          statut: echeance.statut,
          isNew: true,
          changed: true,
        });
      }
    }

    if (finalRows.length > 4) {
      errors.push(
        `${entry.nom} ${entry.prenom} : plus de 4 échéances au total (${finalRows.length}), ignoré — à traiter manuellement.`
      );
      continue;
    }

    finalRows.sort((a, b) => a.date.localeCompare(b.date));
    finalRows.forEach((row, i) => {
      const numero = i + 1;
      if (!row.isNew) {
        const original = existingForPayment.find((r) => r.id === row.id)!;
        if (original.numero_echeance !== numero) row.changed = true;
      }
    });

    if (!paymentId) {
      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          player_id: entry.playerId,
          mode: "prelevement",
          amount: 0,
          saison_start: saisonStart,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (paymentError) {
        errors.push(`${entry.nom} ${entry.prenom} : ${paymentError.message}`);
        continue;
      }
      paymentId = newPayment.id;
    }

    let rowFailed = false;
    for (const [i, row] of finalRows.entries()) {
      const numero = i + 1;
      if (row.isNew) {
        const { error } = await supabase.from("prelevements").insert({
          payment_id: paymentId,
          numero_echeance: numero,
          montant: row.montant,
          date_prelevement: row.date,
          statut: row.statut,
          reference_externe: row.ref,
        });
        if (error) {
          errors.push(`${entry.nom} ${entry.prenom} : ${error.message}`);
          rowFailed = true;
          break;
        }
        echeancesCreated++;
      } else if (row.changed) {
        const { error } = await supabase
          .from("prelevements")
          .update({
            numero_echeance: numero,
            montant: row.montant,
            date_prelevement: row.date,
            statut: row.statut,
          })
          .eq("id", row.id);
        if (error) {
          errors.push(`${entry.nom} ${entry.prenom} : ${error.message}`);
          rowFailed = true;
          break;
        }
        echeancesUpdated++;
      }
    }
    if (rowFailed) continue;

    const totalAmount = finalRows.reduce((sum, r) => sum + r.montant, 0);
    const { error: amountError } = await supabase
      .from("payments")
      .update({ amount: totalAmount })
      .eq("id", paymentId);
    if (amountError) {
      errors.push(`${entry.nom} ${entry.prenom} : ${amountError.message}`);
      continue;
    }

    playersImported++;
  }

  revalidatePath("/prelevements");
  revalidatePath("/joueurs");
  revalidatePath("/dashboard");

  return { playersImported, echeancesCreated, echeancesUpdated, errors };
}
