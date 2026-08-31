"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon, MailWarningIcon } from "lucide-react";

import { updatePrelevementStatut } from "@/app/(app)/prelevements/actions";
import { sendRelances } from "@/app/(app)/joueurs/actions";
import { parseDateOnly, formatDateFr } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export type PrelevementRow = {
  id: string;
  numeroEcheance: number;
  montant: number;
  datePrelevement: string;
  statut: "prevu" | "preleve" | "echec";
  playerId: string;
  playerName: string;
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const FILTERS = ["tous", "prevu", "preleve", "echec"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  tous: "Tous",
  prevu: "À venir",
  preleve: "Prélevés",
  echec: "Échecs",
};

function StatutBadge({ statut }: { statut: PrelevementRow["statut"] }) {
  if (statut === "preleve") return <Badge>Prélevé</Badge>;
  if (statut === "echec") return <Badge variant="destructive">Échec</Badge>;
  return <Badge variant="outline">À venir</Badge>;
}

function monthLabel(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const label = date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PrelevementsTable({
  rows,
  canWrite,
}: {
  rows: PrelevementRow[];
  canWrite: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("tous");
  const [search, setSearch] = useState("");
  const [relancing, setRelancing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  const filtered = rows.filter(
    (r) =>
      (filter === "tous" || r.statut === filter) &&
      r.playerName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPlayerIds = Array.from(
    new Set(
      filtered.filter((r) => selected.has(r.id)).map((r) => r.playerId)
    )
  );

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGroup(groupRows: PrelevementRow[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of groupRows) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  async function handleRelance() {
    setRelancing(true);
    const result = await sendRelances(selectedPlayerIds);
    setRelancing(false);

    if ("error" in result) {
      toast.error("Impossible d'envoyer les relances", {
        description: result.error,
      });
      return;
    }

    const { sent, failed } = result;
    if (sent > 0) {
      toast.success(sent > 1 ? `${sent} relances envoyées` : "Relance envoyée");
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} relance(s) non envoyée(s)`, {
        description: failed
          .map((f) => `${f.nom} ${f.prenom} : ${f.reason}`)
          .join(", "),
      });
    }
    setSelected(new Set());
    router.refresh();
  }

  const groups = new Map<string, PrelevementRow[]>();
  for (const row of filtered) {
    const key = monthLabel(row.datePrelevement);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const handleStatutChange = async (
    id: string,
    statut: PrelevementRow["statut"]
  ) => {
    const result = await updatePrelevementStatut(id, statut);
    if (result.error) {
      toast.error("Impossible de mettre à jour le prélèvement", {
        description: result.error,
      });
      return;
    }
    toast.success("Statut mis à jour");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher un joueur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={filter}
          onValueChange={(v) =>
            setFilter((v ?? "tous") as (typeof FILTERS)[number])
          }
        >
          <SelectTrigger>
            <SelectValue>
              {(v: string) => FILTER_LABELS[v as (typeof FILTERS)[number]]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {FILTER_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canWrite && selectedPlayerIds.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto"
                  disabled={relancing}
                />
              }
            >
              <MailWarningIcon />
              {relancing ? "Envoi..." : `Relancer (${selectedPlayerIds.length})`}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Envoyer une relance {selectedPlayerIds.length > 1
                    ? `à ces ${selectedPlayerIds.length} joueurs`
                    : "à ce joueur"}{" "}
                  ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Un e-mail rappelant leur solde à régler sera envoyé à
                  chaque joueur sélectionné. Les joueurs déjà soldés ou
                  sans e-mail seront ignorés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction disabled={relancing} onClick={handleRelance}>
                  {relancing ? "Envoi..." : "Envoyer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground">Aucun prélèvement à afficher.</p>
      )}

      {Array.from(groups.entries()).map(([month, monthRows]) => {
        const allMonthSelected = monthRows.every((r) => selected.has(r.id));
        return (
        <div key={month} className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {month}
          </h3>
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  {canWrite && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allMonthSelected}
                        onCheckedChange={(checked) =>
                          toggleGroup(monthRows, checked === true)
                        }
                        aria-label={`Tout sélectionner (${month})`}
                      />
                    </TableHead>
                  )}
                  <TableHead>Joueur</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  {canWrite && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRows.map((row) => (
                  <TableRow key={row.id}>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(checked) =>
                            toggleRow(row.id, checked === true)
                          }
                          aria-label={`Sélectionner ${row.playerName}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Link
                        href={`/joueurs/${row.playerId}`}
                        className="hover:underline"
                      >
                        {row.playerName}
                      </Link>
                    </TableCell>
                    <TableCell>{row.numeroEcheance}</TableCell>
                    <TableCell className="text-right">
                      {eur.format(row.montant)}
                    </TableCell>
                    <TableCell>{formatDateFr(row.datePrelevement)}</TableCell>
                    <TableCell>
                      <StatutBadge statut={row.statut} />
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={row.statut === "preleve"}
                              onClick={() =>
                                handleStatutChange(row.id, "preleve")
                              }
                            >
                              Marquer prélevé
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={row.statut === "echec"}
                              onClick={() =>
                                handleStatutChange(row.id, "echec")
                              }
                            >
                              Marquer échec
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={row.statut === "prevu"}
                              onClick={() =>
                                handleStatutChange(row.id, "prevu")
                              }
                            >
                              Remettre à venir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        );
      })}
    </div>
  );
}
