import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import {
  syncOverdueCheques,
  syncOverduePrelevements,
} from "@/lib/payments/sync-statuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await Promise.all([
    syncOverdueCheques(supabase),
    syncOverduePrelevements(supabase),
  ]);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");

  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "?";

  return (
    <SidebarProvider>
      <AppSidebar isAdmin={isAdmin} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="font-heading text-sm font-medium">
            Suivi des licences
          </span>
          <div className="ml-auto">
            <UserMenu displayName={displayName} email={user?.email} />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
