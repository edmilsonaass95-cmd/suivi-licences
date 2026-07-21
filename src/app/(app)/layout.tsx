import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";

function initials(nameOrEmail: string) {
  const base = nameOrEmail.trim();
  const parts = base.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{displayName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">
                    {user?.email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <SignOutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
