"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, Trash2Icon, MailWarningIcon } from "lucide-react";
import { deletePlayers, sendRelances } from "@/app/(app)/joueurs/actions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  previousSolde?: number;
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

export function PlayersTable({
  rows,
  isAdmin,
  canWrite,
  soldeLabel = "Solde",
  previousSoldeLabel,
}: {
  rows: PlayerRow[];
  isAdmin: boolean;
  canWrite: boolean;
  soldeLabel?: string;
  previousSoldeLabel?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [genre, setGenre] = useState("tous");
  const [statut, setStatut] = useState("tous");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [relancing, setRelancing] = useState(false);

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
      [`${soldeLabel} (€)`]: r.solde,
      ...(previousSoldeLabel
        ? { [`${previousSoldeLabel} (€)`]: r.previousSolde ?? 0 }
        : {}),
      Statut: statutLabel(r.paid, r.licencePrice),
    }));
    exportToExcel(`joueurs-${todayStamp()}.xlsx`, "Joueurs", exportRows);
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deletePlayers(Array.from(selected));
    setDeleting(false);

    if (result.error) {
      toast.error("Impossible de supprimer", { description: result.error });
      return;
    }

    toast.success(
      selected.size > 1 ? "Joueurs supprimés" : "Joueur supprimé"
    );
    setSelected(new Set());
    router.refresh();
  }

  async function handleRelance() {
    setRelancing(true);
    const result = await sendRelances(Array.from(selected));
    setRelancing(false);

    if ("error" in result) {
      toast.error("Impossible d'envoyer les relances", {
        description: result.error,
      });
      return;
    }

    const { sent, failed } = result;
    if (sent > 0) {
      toast.success(
        sent > 1 ? `${sent} relances envoyées` : "Relance envoyée"
      );
    }
    if (failed.length > 0) {
      toast.error(
        `${failed.length} relance(s) non envoyée(s)`,
        {
          description: failed
            .map((f) => `${f.nom} ${f.prenom} : ${f.reason}`)
            .join(", "),
        }
      );
    }
    setSelected(new Set());
    router.refresh();
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
        {canWrite && selected.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="outline" disabled={relancing} />}
            >
              <MailWarningIcon />
              {relancing ? "Envoi..." : `Relancer (${selected.size})`}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Envoyer une relance {selected.size > 1
                    ? `à ces ${selected.size} joueurs`
                    : "à ce joueur"}{" "}
                  ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Un e-mail rappelant leur solde à régler sera envoyé à
                  l&apos;adresse enregistrée de chaque joueur sélectionné.
                  Les joueurs déjà soldés ou sans e-mail seront ignorés.
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
        {isAdmin && selected.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" />}
            >
              <Trash2Icon />
              Supprimer ({selected.size})
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer {selected.size > 1
                    ? `ces ${selected.size} joueurs`
                    : "ce joueur"}{" "}
                  ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est définitive : les joueurs, leurs paiements,
                  chèques, prélèvements et pièces jointes seront supprimés
                  sans possibilité de retour.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              {canWrite && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) =>
                      toggleAll(checked === true)
                    }
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
              )}
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Prix licence</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">{soldeLabel}</TableHead>
              {previousSoldeLabel && (
                <TableHead className="text-right">
                  {previousSoldeLabel}
                </TableHead>
              )}
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={
                    (canWrite ? 7 : 6) + (previousSoldeLabel ? 1 : 0)
                  }
                  className="text-center text-muted-foreground"
                >
                  Aucun joueur trouvé.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                {canWrite && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(checked) =>
                        toggleRow(r.id, checked === true)
                      }
                      aria-label={`Sélectionner ${r.nom} ${r.prenom}`}
                    />
                  </TableCell>
                )}
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
                {previousSoldeLabel && (
                  <TableCell className="text-right">
                    {eur.format(r.previousSolde ?? 0)}
                  </TableCell>
                )}
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
