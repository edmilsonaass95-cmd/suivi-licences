"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, RotateCcwIcon } from "lucide-react";

import { setUserDisabled, updateUserRole } from "@/app/(app)/users/actions";
import { formatDateFr } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type Role = "admin" | "manager" | "viewer";

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  role: Role;
  disabled: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
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

  async function handleDisableToggle(userId: string, disabled: boolean) {
    setPendingId(userId);
    const result = await setUserDisabled(userId, disabled);
    setPendingId(null);

    if (result.error) {
      toast.error(
        disabled ? "Impossible de désactiver le compte" : "Impossible de réactiver le compte",
        { description: result.error }
      );
      return;
    }

    toast.success(disabled ? "Compte désactivé" : "Compte réactivé");
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
            <TableHead>Statut</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                {r.disabled ? (
                  <Badge variant="destructive">Désactivé</Badge>
                ) : (
                  <Badge>Actif</Badge>
                )}
              </TableCell>
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
              <TableCell className="text-right">
                {r.disabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === r.id}
                    onClick={() => handleDisableToggle(r.id, false)}
                  >
                    <RotateCcwIcon />
                    Réactiver
                  </Button>
                ) : r.id === currentUserId ? (
                  <Button variant="outline" size="sm" disabled>
                    <BanIcon />
                    Désactiver
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === r.id}
                        />
                      }
                    >
                      <BanIcon />
                      Désactiver
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Désactiver ce compte ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {r.fullName ?? r.email}{" "}
                          ne pourra plus se connecter ni accéder à
                          l&apos;application. Vous pourrez réactiver ce
                          compte à tout moment.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => handleDisableToggle(r.id, true)}
                        >
                          Désactiver
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
