"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { getSaisonStart } from "@/lib/categorie-fff";
import { chunk } from "@/lib/chunk";
import { refreshPlayerPrices } from "@/lib/joueurs/seasons";
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

export type ExistingEcheance = {
  playerId: string;
  montant: number;
  date: string;
  statut: PrelevementStatut;
};

/**
 * Retrouve, parmi les références du fichier, celles qui ont déjà été
 * importées (par référence de la plateforme), avec le joueur auquel elles sont
 * rattachées : sert à repérer les doublons avant l'import.
 */
export async function findExistingEcheances(
  refs: string[]
): Promise<{ existing: Record<string, ExistingEcheance> } | { error: string }> {
  const { canWrite } = await getCurrentUserRoles();
  if (!canWrite) {
    return { error: "Action réservée aux administrateurs et gestionnaires." };
  }

  const supabase = await createClient();
  const existing: Record<string, ExistingEcheance> = {};
  for (const batch of chunk(Array.from(new Set(refs)), ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("prelevements")
      .select(
        "reference_externe, montant, date_prelevement, statut, payments(player_id)"
      )
      .in("reference_externe", batch);
    if (error) return { error: error.message };
    for (const row of data ?? []) {
      const payment = Array.isArray(row.payments) ? row.payments[0] : row.payments;
      if (!row.reference_externe || !payment) continue;
      existing[row.reference_externe] = {
        playerId: payment.player_id,
        montant: Number(row.montant),
        date: row.date_prelevement,
        statut: row.statut as PrelevementStatut,
      };
    }
  }
  return { existing };
}

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

  const knownRefs = new Set(existingRows.map((r) => r.reference_externe));

  for (const entry of entries) {
    // Une échéance annulée qui n'a jamais été importée n'a rien à suivre : on
    // ne la crée pas (elle ne compterait que dans la limite de 4 échéances).
    entry.echeances = entry.echeances.filter(
      (e) => e.statut !== "annule" || knownRefs.has(e.ref)
    );
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

    for (const incoming of entry.echeances) {
      // Le statut du fichier est repris tel quel : seule une échéance « en
      // succès » (prélevé) compte comme encaissée.
      const echeance = incoming;
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

    const activeCount = finalRows.filter((r) => r.statut !== "annule").length;
    if (activeCount > 4) {
      errors.push(
        `${entry.nom} ${entry.prenom} : plus de 4 échéances au total (${activeCount}), ignoré — à traiter manuellement.`
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

    // Une échéance annulée ne sera jamais prélevée : elle n'entre pas dans le total.
    const totalAmount = finalRows
      .filter((r) => r.statut !== "annule")
      .reduce((sum, r) => sum + r.montant, 0);
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

  // Un prélèvement en ligne ajoute les frais de paiement en ligne à la licence.
  await refreshPlayerPrices(
    supabase,
    entries.map((e) => e.playerId)
  );

  revalidatePath("/prelevements");
  revalidatePath("/joueurs");
  revalidatePath("/dashboard");

  return { playersImported, echeancesCreated, echeancesUpdated, errors };
}
