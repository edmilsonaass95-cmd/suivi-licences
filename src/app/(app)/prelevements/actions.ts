"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
