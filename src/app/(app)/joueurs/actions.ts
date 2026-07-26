"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  paymentSchema,
  playerEditSchema,
  playerSchema,
} from "@/lib/joueurs/schemas";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import {
  getLicencePrice,
  isHorsSarcelles,
  resolveRemise,
} from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import {
  CHEQUE_STATUT_LABEL,
  PRELEVEMENT_STATUT_LABEL,
  type ChequeStatut,
  type PrelevementStatut,
} from "@/lib/joueurs/statut-labels";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { sendMail } from "@/lib/email";
import { relanceEmailHtml } from "@/lib/joueurs/relance-email";

const STATUT_JOUEUR_LABEL: Record<string, string> = {
  paye: "Payé",
  partiel: "Partiel",
  impaye: "Impayé",
};

export async function deletePlayers(playerIds: string[]) {
  if (playerIds.length === 0) return { error: "Aucun joueur sélectionné." };

  const supabase = await createClient();

  const { data: attachments } = await supabase
    .from("attachments")
    .select("file_path")
    .in("player_id", playerIds);

  if (attachments && attachments.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("attachments")
      .remove(attachments.map((a) => a.file_path));
    if (storageError) return { error: storageError.message };
  }

  const { error } = await supabase
    .from("players")
    .delete()
    .in("id", playerIds);

  if (error) return { error: error.message };

  revalidatePath("/joueurs");
  return { success: true };
}

export async function sendRelances(playerIds: string[]) {
  if (playerIds.length === 0) return { error: "Aucun joueur sélectionné." };

  const { canWrite } = await getCurrentUserRoles();
  if (!canWrite) {
    return { error: "Action réservée aux administrateurs et gestionnaires." };
  }

  const supabase = await createClient();
  const [{ data: players }, { data: balances }] = await Promise.all([
    supabase
      .from("players")
      .select("id, nom, prenom, email, licence_price")
      .in("id", playerIds),
    supabase.from("player_balances").select("*").in("player_id", playerIds),
  ]);

  const balanceByPlayer = new Map(
    (balances ?? []).map((b) => [b.player_id, b])
  );

  let sent = 0;
  const failed: { nom: string; prenom: string; reason: string }[] = [];

  for (const p of players ?? []) {
    const balance = balanceByPlayer.get(p.id);
    const solde = Number(balance?.solde ?? p.licence_price);

    if (!p.email) {
      failed.push({ nom: p.nom, prenom: p.prenom, reason: "Pas d'e-mail" });
      continue;
    }
    if (solde <= 0) {
      failed.push({ nom: p.nom, prenom: p.prenom, reason: "Déjà soldé" });
      continue;
    }

    try {
      await sendMail({
        to: p.email,
        subject: "Rappel : solde de licence à régler",
        html: relanceEmailHtml(p.prenom, solde),
      });
      sent++;
    } catch (e) {
      failed.push({
        nom: p.nom,
        prenom: p.prenom,
        reason: e instanceof Error ? e.message : "Erreur d'envoi",
      });
    }
  }

  return { success: true, sent, failed };
}

export async function createPlayer(values: unknown) {
  const parsed = playerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  const categorie = getCategorieFFF(
    parseDateOnly(v.date_naissance),
    v.sexe,
    getSaisonStart()
  );
  const horsSarcelles = isHorsSarcelles(v.ville);
  const remise = resolveRemise(v.remise_motif, v.remise);
  const licencePrice = getLicencePrice(categorie, v.mute, horsSarcelles, remise);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .insert({
      nom: v.nom,
      prenom: v.prenom,
      date_naissance: v.date_naissance,
      sexe: v.sexe,
      email: v.email || null,
      telephone: v.telephone || null,
      ville: v.ville,
      mute: v.mute,
      hors_sarcelles: horsSarcelles,
      remise,
      remise_motif: v.remise_motif === "aucune" ? null : v.remise_motif,
      remise_lien_joueur_id:
        v.remise_motif === "parente" ? v.remise_lien_joueur_id : null,
      licence_price: licencePrice,
      notes: v.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Un joueur avec ce nom, prénom et cette date de naissance existe déjà.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/joueurs");
  return { id: data.id as string };
}

export async function updatePlayer(playerId: string, values: unknown) {
  const parsed = playerEditSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  if (v.remise_motif === "parente" && v.remise_lien_joueur_id === playerId) {
    return { error: "Un joueur ne peut pas être lié à lui-même." };
  }

  const supabase = await createClient();
  const { data: player, error: fetchError } = await supabase
    .from("players")
    .select("date_naissance, sexe, mute")
    .eq("id", playerId)
    .single();

  if (fetchError || !player) {
    return { error: fetchError?.message ?? "Joueur introuvable" };
  }

  const categorie = getCategorieFFF(
    parseDateOnly(player.date_naissance),
    player.sexe as "M" | "F",
    getSaisonStart()
  );
  const horsSarcelles = isHorsSarcelles(v.ville);
  const remise = resolveRemise(v.remise_motif, v.remise);
  const licencePrice = getLicencePrice(
    categorie,
    player.mute,
    horsSarcelles,
    remise
  );

  const { error } = await supabase
    .from("players")
    .update({
      email: v.email || null,
      telephone: v.telephone || null,
      ville: v.ville,
      hors_sarcelles: horsSarcelles,
      remise,
      remise_motif: v.remise_motif === "aucune" ? null : v.remise_motif,
      remise_lien_joueur_id:
        v.remise_motif === "parente" ? v.remise_lien_joueur_id : null,
      licence_price: licencePrice,
    })
    .eq("id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
  return { success: true };
}

export async function createPayment(playerId: string, values: unknown) {
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const amount =
    v.mode === "cheque"
      ? v.cheques.reduce((sum, c) => sum + c.montant, 0)
      : v.mode === "prelevement"
        ? v.echeances.reduce((sum, e) => sum + e.montant, 0)
        : v.amount;

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      player_id: playerId,
      mode: v.mode,
      amount,
      note: v.note || null,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (v.mode === "cheque") {
    const { error: chequesError } = await supabase.from("cheques").insert(
      v.cheques.map((c, i) => ({
        payment_id: payment.id,
        numero_ordre: i + 1,
        montant: c.montant,
        date_encaissement: c.date_encaissement,
        banque: c.banque || null,
        numero_cheque: c.numero_cheque || null,
      }))
    );
    if (chequesError) return { error: chequesError.message };
  }

  if (v.mode === "prelevement") {
    const { error: prelevementsError } = await supabase
      .from("prelevements")
      .insert(
        v.echeances.map((e, i) => ({
          payment_id: payment.id,
          numero_echeance: i + 1,
          montant: e.montant,
          date_prelevement: e.date_prelevement,
        }))
      );
    if (prelevementsError) return { error: prelevementsError.message };
  }

  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
  return { id: payment.id as string };
}

export async function updatePayment(paymentId: string, values: unknown) {
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("payments")
    .select("id, player_id, mode")
    .eq("id", paymentId)
    .single();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Paiement introuvable" };
  }

  if (existing.mode !== v.mode) {
    return { error: "Le mode de paiement ne peut pas être modifié." };
  }

  const amount =
    v.mode === "cheque"
      ? v.cheques.reduce((sum, c) => sum + c.montant, 0)
      : v.mode === "prelevement"
        ? v.echeances.reduce((sum, e) => sum + e.montant, 0)
        : v.amount;

  const { error } = await supabase
    .from("payments")
    .update({ amount, note: v.note || null })
    .eq("id", paymentId);

  if (error) return { error: error.message };

  if (v.mode === "cheque") {
    const { data: existingCheques } = await supabase
      .from("cheques")
      .select("id")
      .eq("payment_id", paymentId);
    const existingIds = new Set((existingCheques ?? []).map((c) => c.id));
    const keptIds = new Set(v.cheques.map((c) => c.id).filter(Boolean));

    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("cheques").delete().in("id", toDelete);
    }

    for (const [i, c] of v.cheques.entries()) {
      const row = {
        numero_ordre: i + 1,
        montant: c.montant,
        date_encaissement: c.date_encaissement,
        banque: c.banque || null,
        numero_cheque: c.numero_cheque || null,
      };
      if (c.id && existingIds.has(c.id)) {
        await supabase.from("cheques").update(row).eq("id", c.id);
      } else {
        await supabase
          .from("cheques")
          .insert({ ...row, payment_id: paymentId });
      }
    }
  }

  if (v.mode === "prelevement") {
    const { data: existingEcheances } = await supabase
      .from("prelevements")
      .select("id")
      .eq("payment_id", paymentId);
    const existingIds = new Set((existingEcheances ?? []).map((e) => e.id));
    const keptIds = new Set(v.echeances.map((e) => e.id).filter(Boolean));

    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("prelevements").delete().in("id", toDelete);
    }

    for (const [i, e] of v.echeances.entries()) {
      const row = {
        numero_echeance: i + 1,
        montant: e.montant,
        date_prelevement: e.date_prelevement,
      };
      if (e.id && existingIds.has(e.id)) {
        await supabase.from("prelevements").update(row).eq("id", e.id);
      } else {
        await supabase
          .from("prelevements")
          .insert({ ...row, payment_id: paymentId });
      }
    }
  }

  revalidatePath(`/joueurs/${existing.player_id}`);
  revalidatePath("/joueurs");
  revalidatePath("/echeancier");
  revalidatePath("/prelevements");
  return { success: true };
}

export async function deletePayment(paymentId: string) {
  const supabase = await createClient();

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("player_id")
    .eq("id", paymentId)
    .single();

  if (fetchError || !payment) {
    return { error: fetchError?.message ?? "Paiement introuvable" };
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath(`/joueurs/${payment.player_id}`);
  revalidatePath("/joueurs");
  revalidatePath("/echeancier");
  revalidatePath("/prelevements");
  return { success: true };
}

export async function getPaymentsForExport(filters?: {
  mode?: string;
  categorie?: string;
  genre?: string;
  statutJoueur?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(
      "player_id, mode, amount, note, created_at, players(nom, prenom, sexe, date_naissance, licence_price), cheques(statut), prelevements(statut)"
    )
    .order("created_at", { ascending: false });

  if (filters?.mode && filters.mode !== "tous") {
    query = query.eq("mode", filters.mode);
  }

  const { data, error } = await query;

  if (error) return { error: error.message };

  const playerIds = Array.from(
    new Set((data ?? []).map((p) => p.player_id).filter(Boolean))
  );
  const { data: balances } = await supabase
    .from("player_balances")
    .select("player_id, paid")
    .in("player_id", playerIds);
  const paidByPlayer = new Map(
    (balances ?? []).map((b) => [b.player_id, Number(b.paid)])
  );

  const saisonStart = getSaisonStart();
  let rows = (data ?? []).map((p) => {
    const playersRel = p.players as
      | { nom: string; prenom: string; sexe: "M" | "F"; date_naissance: string; licence_price: number }
      | { nom: string; prenom: string; sexe: "M" | "F"; date_naissance: string; licence_price: number }[]
      | null;
    const player = Array.isArray(playersRel) ? playersRel[0] : playersRel;
    const categorie = player
      ? getCategorieFFF(parseDateOnly(player.date_naissance), player.sexe, saisonStart)
      : null;

    const licencePrice = player ? Number(player.licence_price) : 0;
    const paid = paidByPlayer.get(p.player_id) ?? 0;
    const isSolde = licencePrice > 0 && paid >= licencePrice;
    const statutJoueur = !player
      ? null
      : isSolde
        ? "paye"
        : paid > 0
          ? "partiel"
          : "impaye";

    let statut = "Encaissé";
    if (p.mode === "cheque") {
      const labels = Array.from(
        new Set(
          (p.cheques as { statut: ChequeStatut }[]).map(
            (c) => CHEQUE_STATUT_LABEL[c.statut]
          )
        )
      );
      statut = labels.join(" / ") || "—";
    } else if (p.mode === "prelevement") {
      const labels = Array.from(
        new Set(
          (p.prelevements as { statut: PrelevementStatut }[]).map(
            (e) => PRELEVEMENT_STATUT_LABEL[e.statut]
          )
        )
      );
      statut = labels.join(" / ") || "—";
    }

    return {
      joueur: player ? `${player.nom} ${player.prenom}` : "—",
      sexe: player?.sexe ?? null,
      categorie,
      mode: p.mode,
      amount: Number(p.amount),
      statut,
      statutJoueur,
      statutJoueurLabel: statutJoueur ? STATUT_JOUEUR_LABEL[statutJoueur] : "—",
      note: p.note,
      created_at: p.created_at,
    };
  });

  if (filters?.genre && filters.genre !== "tous") {
    rows = rows.filter((r) => r.sexe === filters.genre);
  }
  if (filters?.categorie && filters.categorie !== "toutes") {
    rows = rows.filter((r) => r.categorie === filters.categorie);
  }
  if (filters?.statutJoueur && filters.statutJoueur !== "tous") {
    rows = rows.filter((r) => {
      if (filters.statutJoueur === "reste_a_payer") {
        return r.statutJoueur === "partiel" || r.statutJoueur === "impaye";
      }
      return r.statutJoueur === filters.statutJoueur;
    });
  }

  return { rows };
}
