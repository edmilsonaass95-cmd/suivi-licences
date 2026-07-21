"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon } from "lucide-react";

import { updateChequeStatut } from "@/app/(app)/echeancier/actions";
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

export type ChequeRow = {
  id: string;
  numeroOrdre: number;
  montant: number;
  dateEncaissement: string;
  statut: "a_encaisser" | "encaisse" | "impaye";
  banque: string | null;
  playerId: string;
  playerName: string;
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const STATUT_LABELS: Record<ChequeRow["statut"], string> = {
  a_encaisser: "À encaisser",
  encaisse: "Encaissé",
  impaye: "Impayé",
};

const FILTERS = ["tous", "a_encaisser", "encaisse", "impaye"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  tous: "Tous",
  a_encaisser: "À encaisser",
  encaisse: "Encaissés",
  impaye: "Impayés",
};

function StatutBadge({ row }: { row: ChequeRow }) {
  const isLate =
    row.statut === "a_encaisser" && parseDateOnly(row.dateEncaissement) < new Date(new Date().toDateString());

  if (row.statut === "encaisse") return <Badge>Encaissé</Badge>;
  if (row.statut === "impaye") return <Badge variant="destructive">Impayé</Badge>;
  return (
    <Badge
      className={
        isLate ? "border-transparent bg-amber-500 text-white" : undefined
      }
      variant={isLate ? undefined : "outline"}
    >
      {isLate ? "À encaisser (en retard)" : "À encaisser"}
    </Badge>
  );
}

function monthLabel(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const label = date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ChequesTable({ rows }: { rows: ChequeRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("tous");
  const router = useRouter();

  const filtered = rows.filter(
    (r) => filter === "tous" || r.statut === filter
  );

  const groups = new Map<string, ChequeRow[]>();
  for (const row of filtered) {
    const key = monthLabel(row.dateEncaissement);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const handleStatutChange = async (
    chequeId: string,
    statut: ChequeRow["statut"]
  ) => {
    const result = await updateChequeStatut(chequeId, statut);
    if (result.error) {
      toast.error("Impossible de mettre à jour le chèque", {
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
        <p className="text-muted-foreground">Aucun chèque à afficher.</p>
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
                  <TableHead>Date d&apos;encaissement</TableHead>
                  <TableHead>Banque</TableHead>
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
                    <TableCell>{row.numeroOrdre}</TableCell>
                    <TableCell className="text-right">
                      {eur.format(row.montant)}
                    </TableCell>
                    <TableCell>{formatDateFr(row.dateEncaissement)}</TableCell>
                    <TableCell>{row.banque ?? "—"}</TableCell>
                    <TableCell>
                      <StatutBadge row={row} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md hover:bg-accent">
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={row.statut === "encaisse"}
                            onClick={() =>
                              handleStatutChange(row.id, "encaisse")
                            }
                          >
                            Marquer encaissé
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={row.statut === "impaye"}
                            onClick={() =>
                              handleStatutChange(row.id, "impaye")
                            }
                          >
                            Marquer impayé
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={row.statut === "a_encaisser"}
                            onClick={() =>
                              handleStatutChange(row.id, "a_encaisser")
                            }
                          >
                            Remettre à encaisser
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
