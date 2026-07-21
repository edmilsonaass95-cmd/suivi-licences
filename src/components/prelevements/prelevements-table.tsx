"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon } from "lucide-react";

import { updatePrelevementStatut } from "@/app/(app)/prelevements/actions";
import { parseDateOnly, formatDateFr } from "@/lib/date";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function PrelevementsTable({ rows }: { rows: PrelevementRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("tous");
  const router = useRouter();

  const filtered = rows.filter(
    (r) => filter === "tous" || r.statut === filter
  );

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
      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground">Aucun prélèvement à afficher.</p>
      )}

      {Array.from(groups.entries()).map(([month, monthRows]) => (
        <div key={month} className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {month}
          </h3>
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRows.map((row) => (
                  <TableRow key={row.id}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
