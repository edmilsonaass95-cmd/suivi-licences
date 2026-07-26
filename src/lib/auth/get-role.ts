import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserRoles() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");
  const roleSet = new Set((roles ?? []).map((r) => r.role));
  return {
    isAdmin: roleSet.has("admin"),
    isManager: roleSet.has("manager"),
    canWrite: roleSet.has("admin") || roleSet.has("manager"),
  };
}
