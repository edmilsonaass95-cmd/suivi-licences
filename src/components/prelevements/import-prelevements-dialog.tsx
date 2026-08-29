"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";

import {
  importPrelevements,
  type PrelevementImportEntry,
} from "@/app/(app)/prelevements/import-actions";
import {
  parsePrelevementFile,
  type ParsedEcheance,
} from "@/lib/joueurs/prelevement-import-parsing";
import {
  matchPlayersForFilename,
  type MatchablePlayer,
} from "@/lib/joueurs/name-matching";
import { formatDateFr } from "@/lib/date";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type PreviewRow = {
  nomPrenom: string;
  echeances: ParsedEcheance[];
  matchCount: number;
  playerId: string;
};

export function ImportPrelevementsDialog({
  players,
}: {
  players: MatchablePlayer[];
}) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseInfo, setParseInfo] = useState<{
    ignoredRetraits: number;
    ignoredAnnulees: number;
    errors: string[];
  } | null>(null);
  const [result, setResult] = useState<{
    playersImported: number;
    echeancesCreated: number;
    echeancesUpdated: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    try {
      const { echeances, ignoredRetraits, ignoredAnnulees, errors } =
        await parsePrelevementFile(file);

      const grouped = new Map<string, ParsedEcheance[]>();
      for (const e of echeances) {
        const list = grouped.get(e.nomPrenom) ?? [];
        list.push(e);
        grouped.set(e.nomPrenom, list);
      }

      const preview: PreviewRow[] = Array.from(grouped.entries()).map(
        ([nomPrenom, list]) => {
          const candidates = matchPlayersForFilename(nomPrenom, players);
          return {
            nomPrenom,
            echeances: list,
            matchCount: candidates.length,
            playerId: candidates.length === 1 ? candidates[0].id : "",
          };
        }
      );
      preview.sort((a, b) => a.nomPrenom.localeCompare(b.nomPrenom));

      setRows(preview);
      setParseInfo({ ignoredRetraits, ignoredAnnulees, errors });
      setFileName(file.name);
    } catch {
      toast.error("Impossible de lire ce fichier", {
        description: "Vérifie qu'il s'agit bien de l'export CSV ou Excel.",
      });
    } finally {
      setParsing(false);
    }
  }

  function setRowPlayer(index: number, playerId: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, playerId } : r))
    );
  }

  const importableRows = rows.filter(
    (r) => r.playerId && r.echeances.length <= 4
  );

  async function handleImport() {
    setImporting(true);
    const entries: PrelevementImportEntry[] = importableRows.map((r) => {
      const player = players.find((p) => p.id === r.playerId)!;
      return {
        playerId: r.playerId,
        nom: player.nom,
        prenom: player.prenom,
        echeances: r.echeances.map((e) => ({
          ref: e.ref,
          montant: e.montant,
          date: e.date,
          statut: e.statut,
        })),
      };
    });

    const summary = await importPrelevements(entries);
    setImporting(false);

    if ("error" in summary) {
      toast.error("Import impossible", { description: summary.error });
      return;
    }

    setResult(summary);
    toast.success(
      `${summary.playersImported} joueur(s) mis à jour (${summary.echeancesCreated} échéance(s) créée(s), ${summary.echeancesUpdated} mise(s) à jour)`
    );
    router.refresh();
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      setRows([]);
      setParseInfo(null);
      setResult(null);
      setFileName(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <UploadIcon />
        Importer les paiements en ligne
      </Button>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importer les paiements en ligne</DialogTitle>
          <DialogDescription>
            Dépose l&apos;export « Transactions » de la plateforme de
            paiement en ligne : chaque joueur est retrouvé automatiquement à
            partir de son nom et prénom. Un fichier déjà importé peut être
            redéposé plus tard : les échéances déjà connues sont mises à
            jour (statut, montant, date) plutôt que dupliquées.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? "Lecture..." : "Choisir le fichier"}
          </Button>
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
        </div>

        {parseInfo && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{rows.length} joueur(s) identifié(s) dans le fichier</Badge>
            <Badge>
              {importableRows.length} prêt(s) à importer
            </Badge>
            {rows.length > importableRows.length && (
              <Badge className="border-transparent bg-amber-500 text-white">
                {rows.length - importableRows.length} à corriger manuellement
              </Badge>
            )}
            {parseInfo.ignoredRetraits > 0 && (
              <Badge variant="outline">
                {parseInfo.ignoredRetraits} retrait(s) club ignoré(s)
              </Badge>
            )}
            {parseInfo.ignoredAnnulees > 0 && (
              <Badge variant="outline">
                {parseInfo.ignoredAnnulees} échéance(s) annulée(s) ignorée(s)
              </Badge>
            )}
            {parseInfo.errors.length > 0 && (
              <Badge variant="destructive">
                {parseInfo.errors.length} ligne(s) en erreur
              </Badge>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom (fichier)</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Échéances</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={row.nomPrenom}>
                    <TableCell className="max-w-40 truncate" title={row.nomPrenom}>
                      {row.nomPrenom}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.playerId}
                        onValueChange={(v) => setRowPlayer(i, v ?? "")}
                      >
                        <SelectTrigger className="w-full" disabled={importing}>
                          <SelectValue
                            placeholder={
                              row.matchCount > 1
                                ? "Plusieurs correspondances"
                                : "Aucune correspondance"
                            }
                          >
                            {(v: string) => {
                              const p = players.find((pl) => pl.id === v);
                              return p ? `${p.nom} ${p.prenom}` : "Choisir";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {players.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom} {p.prenom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {row.echeances.length > 4 && (
                        <p className="mt-1 text-xs text-destructive">
                          Plus de 4 échéances dans le fichier pour ce nom.
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.echeances.length} ×{" "}
                      {row.echeances
                        .map((e) => formatDateFr(e.date))
                        .join(", ")}
                    </TableCell>
                    <TableCell>
                      {eur.format(
                        row.echeances.reduce((sum, e) => sum + e.montant, 0)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {parseInfo && parseInfo.errors.length > 0 && (
          <ul className="max-h-32 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-destructive">
            {parseInfo.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}

        {result && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p>
              <strong>{result.playersImported}</strong> joueur(s) mis à jour
              — <strong>{result.echeancesCreated}</strong> échéance(s)
              créée(s), <strong>{result.echeancesUpdated}</strong> mise(s) à
              jour.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-destructive">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || importableRows.length === 0}
          >
            {importing
              ? "Import en cours..."
              : `Importer (${importableRows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
