"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { chunk } from "@/lib/chunk";
import { refreshPlayerPrices } from "@/lib/joueurs/seasons";

const ID_BATCH_SIZE = 150;

const VALID_STATUTS = ["prevu", "preleve", "echec"] as const;
type PrelevementStatut = (typeof VALID_STATUTS)[number];

export async function updatePrelevementStatut(
  prelevementId: string,
  statut: PrelevementStatut
) {
  if (!VALID_STATUTS.includes(statut)) {
    return { error: "Statut invalide" };
  }

  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("prelevements")
    .select("date_prelevement, payments(player_id)")
    .eq("id", prelevementId)
    .single();

  if (fetchError || !current) {
    return { error: fetchError?.message ?? "Prélèvement introuvable" };
  }

  const { error } = await supabase
    .from("prelevements")
    .update({ statut })
    .eq("id", prelevementId);

  if (error) return { error: error.message };

  const paymentsRel = current.payments as
    | { player_id: string }
    | { player_id: string }[]
    | null;
  const playerId = Array.isArray(paymentsRel)
    ? paymentsRel[0]?.player_id
    : paymentsRel?.player_id;

  // Un prélèvement en échec suspend le mandat : les échéances suivantes
  // du même joueur, encore prévues, sont aussi marquées en échec.
  if (statut === "echec" && playerId) {
    const { data: following } = await supabase
      .from("prelevements")
      .select("id, payments!inner(player_id)")
      .eq("payments.player_id", playerId)
      .eq("statut", "prevu")
      .gt("date_prelevement", current.date_prelevement);

    const followingIds = (following ?? []).map((p) => p.id);
    if (followingIds.length > 0) {
      await supabase
        .from("prelevements")
        .update({ statut: "echec" })
        .in("id", followingIds);
    }
  }

  revalidatePath("/prelevements");
  revalidatePath("/joueurs");
  if (playerId) revalidatePath(`/joueurs/${playerId}`);
  return { success: true };
}

/**
 * Supprime des échéances de prélèvement. Le paiement qui les porte est mis à
 * jour (montant) ou supprimé s'il n'a plus aucune échéance ; le prix de la
 * licence est recalculé (les frais de paiement en ligne en dépendent).
 */
export async function deletePrelevements(prelevementIds: string[]) {
  const { canWrite } = await getCurrentUserRoles();
  if (!canWrite) {
    return { error: "Action réservée aux administrateurs et gestionnaires." };
  }
  if (prelevementIds.length === 0) {
    return { error: "Aucun prélèvement sélectionné." };
  }

  const supabase = await createClient();

  // Paiements concernés, avant suppression.
  const paymentIds = new Set<string>();
  for (const batch of chunk(prelevementIds, ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("prelevements")
      .select("payment_id")
      .in("id", batch);
    if (error) return { error: error.message };
    for (const row of data ?? []) paymentIds.add(row.payment_id);
  }

  let deleted = 0;
  for (const batch of chunk(prelevementIds, ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("prelevements")
      .delete()
      .in("id", batch)
      .select("id");
    if (error) return { error: error.message, deleted };
    deleted += data?.length ?? 0;
  }

  // Échéances restantes par paiement : montant mis à jour, ou paiement supprimé.
  const remainingByPayment = new Map<string, number>();
  for (const batch of chunk([...paymentIds], ID_BATCH_SIZE)) {
    const { data } = await supabase
      .from("prelevements")
      .select("payment_id, montant")
      .in("payment_id", batch);
    for (const row of data ?? []) {
      remainingByPayment.set(
        row.payment_id,
        (remainingByPayment.get(row.payment_id) ?? 0) + Number(row.montant)
      );
    }
  }

  const emptyPaymentIds = [...paymentIds].filter(
    (id) => !remainingByPayment.has(id)
  );
  const playerIds = new Set<string>();
  for (const batch of chunk([...paymentIds], ID_BATCH_SIZE)) {
    const { data } = await supabase
      .from("payments")
      .select("player_id")
      .in("id", batch);
    for (const row of data ?? []) playerIds.add(row.player_id);
  }

  for (const batch of chunk(emptyPaymentIds, ID_BATCH_SIZE)) {
    await supabase.from("payments").delete().in("id", batch);
  }
  for (const [paymentId, amount] of remainingByPayment) {
    await supabase.from("payments").update({ amount }).eq("id", paymentId);
  }

  await refreshPlayerPrices(supabase, [...playerIds]);

  revalidatePath("/prelevements");
  revalidatePath("/joueurs");
  revalidatePath("/echeancier");
  revalidatePath("/dashboard");
  for (const id of playerIds) revalidatePath(`/joueurs/${id}`);
  return { success: true, deleted };
}
