"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUTS = ["a_encaisser", "encaisse", "impaye"] as const;
type ChequeStatut = (typeof VALID_STATUTS)[number];

export async function updateChequeStatut(
  chequeId: string,
  statut: ChequeStatut
) {
  if (!VALID_STATUTS.includes(statut)) {
    return { error: "Statut invalide" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("cheques")
    .select("payments(player_id)")
    .eq("id", chequeId)
    .single();

  const { error } = await supabase
    .from("cheques")
    .update({ statut })
    .eq("id", chequeId);

  if (error) return { error: error.message };

  const paymentsRel = current?.payments as
    | { player_id: string }
    | { player_id: string }[]
    | null
    | undefined;
  const playerId = Array.isArray(paymentsRel)
    ? paymentsRel[0]?.player_id
    : paymentsRel?.player_id;

  revalidatePath("/echeancier");
  revalidatePath("/joueurs");
  if (playerId) revalidatePath(`/joueurs/${playerId}`);
  return { success: true };
}
