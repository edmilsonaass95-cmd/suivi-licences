"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentSchema, playerSchema } from "@/lib/joueurs/schemas";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { getLicencePrice } from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";

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
  const licencePrice = getLicencePrice(categorie, v.mute, v.hors_sarcelles);

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
      adresse: v.adresse || null,
      mute: v.mute,
      hors_sarcelles: v.hors_sarcelles,
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
