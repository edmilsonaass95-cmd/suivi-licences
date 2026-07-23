"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = ["admin", "manager", "viewer"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function updateUserRole(userId: string, role: Role) {
  if (!VALID_ROLES.includes(role)) {
    return { error: "Rôle invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === userId && role !== "admin") {
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("user_id", userId);
    if (!count) {
      return {
        error:
          "Impossible de retirer le rôle admin : vous êtes le seul administrateur.",
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (insertError) return { error: insertError.message };

  revalidatePath("/users");
  return { success: true };
}
