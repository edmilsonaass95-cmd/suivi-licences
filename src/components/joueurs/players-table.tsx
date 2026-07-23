"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { exportToExcel, todayStamp } from "@/lib/export-xlsx";
import { PLAYER_STATUT_LABEL } from "@/lib/joueurs/statut-labels";

function statutLabel(paid: number, expected: number) {
  if (expected > 0 && paid >= expected) return "Payé";
  if (paid > 0) return "Partiel";
  return "Dû";
}

export type PlayerRow = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  categorie: string;
  licencePrice: number;
  paid: number;
  solde: number;
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

function StatusBadge({ paid, expected }: { paid: number; expected: number }) {
  const label = statutLabel(paid, expected);
  if (label === "Payé") return <Badge>Payé</Badge>;
  if (label === "Partiel") {
    return (
      <Badge className="border-transparent bg-amber-500 text-white">
        Partiel
      </Badge>
    );
  }
  return <Badge variant="destructive">Dû</Badge>;
}

export function PlayersTable({ rows }: { rows: PlayerRow[] }) {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [genre, setGenre] = useState("tous");
  const [statut, setStatut] = useState("tous");

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.categorie))).sort(),
    [rows]
  );

  const filtered = rows.filter((r) => {
    const matchesSearch = `${r.nom} ${r.prenom}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategorie =
      categorie === "toutes" || r.categorie === categorie;
    const matchesGenre = genre === "tous" || r.sexe === genre;
    const isSolde = r.licencePrice > 0 && r.paid >= r.licencePrice;
    const matchesStatut =
      statut === "tous" ||
      (statut === "paye" && isSolde) ||
      (statut === "partiel" && r.paid > 0 && !isSolde) ||
      (statut === "impaye" && r.paid === 0) ||
      (statut === "reste_a_payer" && !isSolde);
    return matchesSearch && matchesCategorie && matchesGenre && matchesStatut;
  });

  function handleExport() {
    const exportRows = filtered.map((r) => ({
      Nom: r.nom,
      Prénom: r.prenom,
      Genre: r.sexe,
      Catégorie: r.categorie,
      "Prix licence (€)": r.licencePrice,
      "Payé (€)": r.paid,
      "Solde (€)": r.solde,
      Statut: statutLabel(r.paid, r.licencePrice),
    }));
    exportToExcel(`joueurs-${todayStamp()}.xlsx`, "Joueurs", exportRows);
  }

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
          value={categorie}
          onValueChange={(v) => setCategorie(v ?? "toutes")}
        >
          <SelectTrigger>
            <SelectValue>
              {(v: string) => (v === "toutes" ? "Toutes catégories" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={genre} onValueChange={(v) => setGenre(v ?? "tous")}>
          <SelectTrigger>
            <SelectValue>
              {(v: string) =>
                v === "tous" ? "Tous genres" : v === "M" ? "Masculin" : "Féminin"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous genres</SelectItem>
            <SelectItem value="M">Masculin</SelectItem>
            <SelectItem value="F">Féminin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statut} onValueChange={(v) => setStatut(v ?? "tous")}>
          <SelectTrigger>
            <SelectValue>
              {(v: string) => PLAYER_STATUT_LABEL[v] ?? PLAYER_STATUT_LABEL.tous}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PLAYER_STATUT_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={handleExport}
        >
          <DownloadIcon />
          Exporter ({filtered.length})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Prix licence</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun joueur trouvé.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/joueurs/${r.id}`}
                    className="block hover:underline"
                  >
                    {r.nom} {r.prenom}
                  </Link>
                </TableCell>
                <TableCell>{r.categorie}</TableCell>
                <TableCell className="text-right">
                  {eur.format(r.licencePrice)}
                </TableCell>
                <TableCell className="text-right">
                  {eur.format(r.paid)}
                </TableCell>
                <TableCell className="text-right">
                  {eur.format(r.solde)}
                </TableCell>
                <TableCell>
                  <StatusBadge paid={r.paid} expected={r.licencePrice} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
