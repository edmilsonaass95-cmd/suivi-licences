"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateUserRole } from "@/app/(app)/users/actions";
import { formatDateFr } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Role = "admin" | "manager" | "viewer";

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  role: Role;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  viewer: "Lecteur",
};

export function UsersTable({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: Role) {
    setPendingId(userId);
    const result = await updateUserRole(userId, role);
    setPendingId(null);

    if (result.error) {
      toast.error("Impossible de modifier le rôle", {
        description: result.error,
      });
      return;
    }

    toast.success("Rôle mis à jour");
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Inscrit le</TableHead>
            <TableHead>Rôle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Aucun utilisateur.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                {r.fullName ?? "—"}
                {r.id === currentUserId && (
                  <Badge variant="outline" className="ml-2">
                    Vous
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.email}</TableCell>
              <TableCell>{formatDateFr(r.createdAt)}</TableCell>
              <TableCell>
                <Select
                  value={r.role}
                  onValueChange={(v) =>
                    v && handleRoleChange(r.id, v as Role)
                  }
                >
                  <SelectTrigger
                    className="w-44"
                    disabled={pendingId === r.id}
                  >
                    <SelectValue>
                      {(v: string) => ROLE_LABELS[v as Role]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
