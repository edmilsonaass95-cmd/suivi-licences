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
  const { error } = await supabase
    .from("prelevements")
    .update({ statut })
    .eq("id", prelevementId);

  if (error) return { error: error.message };

  revalidatePath("/prelevements");
  revalidatePath("/joueurs");
  return { success: true };
}
