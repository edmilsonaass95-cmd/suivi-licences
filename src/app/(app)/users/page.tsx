import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, type UserRow } from "@/components/users/users-table";
import { AddUserDialog } from "@/components/users/add-user-dialog";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");
  const isAdmin = myRoles?.some((r) => r.role === "admin") ?? false;

  if (!isAdmin) redirect("/dashboard");

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("email"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    createdAt: p.created_at,
    role: (roleByUser.get(p.id) ?? "viewer") as UserRow["role"],
    disabled: p.disabled,
    approved: p.approved,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Utilisateurs</h1>
          <p className="mt-2 text-muted-foreground">
            {rows.length} utilisateur(s). Gérez les rôles d&apos;accès.
          </p>
        </div>
        <AddUserDialog />
      </div>
      <UsersTable rows={rows} currentUserId={user?.id ?? ""} />
    </div>
  );
}
