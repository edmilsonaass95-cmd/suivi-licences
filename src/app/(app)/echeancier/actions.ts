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
  const { error } = await supabase
    .from("cheques")
    .update({ statut })
    .eq("id", chequeId);

  if (error) return { error: error.message };

  revalidatePath("/echeancier");
  revalidatePath("/joueurs");
  return { success: true };
}
