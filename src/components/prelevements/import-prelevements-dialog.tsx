"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon, UploadIcon, Undo2Icon } from "lucide-react";

import {
  findExistingEcheances,
  importPrelevements,
  type ExistingEcheance,
  type PrelevementImportEntry,
} from "@/app/(app)/prelevements/import-actions";
import {
  parsePrelevementFile,
  type IgnoredLine,
  type ParsedEcheance,
} from "@/lib/joueurs/prelevement-import-parsing";
import {
  matchPlayersForFilename,
  type MatchablePlayer,
} from "@/lib/joueurs/name-matching";
import { formatDateFr } from "@/lib/date";
import { effectivePrelevementStatut } from "@/lib/joueurs/statut-labels";
import { cn } from "@/lib/utils";
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
  /** Ligne retirée de l'import par l'utilisateur (récupérable). */
  removed: boolean;
};

/**
 * nouveau : rien d'importé encore · maj : déjà importé en partie, avec des
 * nouveautés ou des changements · doublon : déjà importé à l'identique ·
 * corriger : joueur à choisir ou ligne incohérente.
 */
type RowKind = "nouveau" | "maj" | "doublon" | "corriger";

type RowState = {
  kind: RowKind;
  nouvelles: number;
  modifiees: number;
  identiques: number;
  reason: string | null;
};

type Filter =
  | "tous"
  | "pret"
  | "corriger"
  | "doublon"
  | "retirees"
  | "retraits"
  | "annulees"
  | "erreurs";

const KIND_LABEL: Record<RowKind, string> = {
  nouveau: "Nouveau",
  maj: "Mise à jour",
  doublon: "Déjà importé",
  corriger: "À corriger",
};

const KIND_CLASS: Record<RowKind, string> = {
  nouveau: "border-primary/50 bg-primary/10 font-medium text-primary",
  maj: "border-sky-500 bg-sky-500/10 font-medium text-sky-700 dark:text-sky-400",
  doublon: "border-border bg-muted font-medium text-muted-foreground",
  corriger:
    "border-amber-500 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-400",
};

function classifyRow(
  row: PreviewRow,
  existing: Record<string, ExistingEcheance>,
  players: MatchablePlayer[]
): RowState {
  const base = { nouvelles: 0, modifiees: 0, identiques: 0 };

  if (!row.playerId) {
    return {
      ...base,
      kind: "corriger",
      reason:
        row.matchCount > 1
          ? "Plusieurs joueurs correspondent : choisis le bon."
          : "Aucun joueur trouvé : choisis-le ou retire la ligne.",
    };
  }
  if (row.echeances.length > 4) {
    return {
      ...base,
      kind: "corriger",
      reason: "Plus de 4 échéances dans le fichier pour ce nom.",
    };
  }

  const counts = { ...base };
  for (const e of row.echeances) {
    const found = existing[e.ref];
    if (!found) {
      counts.nouvelles++;
    } else if (found.playerId !== row.playerId) {
      const other = players.find((p) => p.id === found.playerId);
      return {
        ...base,
        kind: "corriger",
        reason: `La référence ${e.ref} est déjà importée pour ${
          other ? `${other.nom} ${other.prenom}` : "un autre joueur"
        }.`,
      };
    } else if (
      Math.abs(found.montant - e.montant) < 0.005 &&
      found.date === e.date &&
      found.statut === effectivePrelevementStatut(e.statut, e.date)
    ) {
      counts.identiques++;
    } else {
      counts.modifiees++;
    }
  }

  const kind: RowKind =
    counts.nouvelles === 0 && counts.modifiees === 0
      ? "doublon"
      : counts.nouvelles === row.echeances.length
        ? "nouveau"
        : "maj";
  return { ...counts, kind, reason: null };
}

function FilterChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
        active && "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background",
        !active && "opacity-90 hover:opacity-100",
        className
      )}
    >
      {children}
    </button>
  );
}

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
  const [existing, setExisting] = useState<Record<string, ExistingEcheance>>({});
  const [parseInfo, setParseInfo] = useState<{
    ignoredRetraits: IgnoredLine[];
    ignoredAnnulees: IgnoredLine[];
    errors: string[];
  } | null>(null);
  const [filter, setFilter] = useState<Filter>("tous");
  const [result, setResult] = useState<{
    playersImported: number;
    echeancesCreated: number;
    echeancesUpdated: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const refreshExisting = useCallback(async (list: PreviewRow[]) => {
    const refs = list.flatMap((r) => r.echeances.map((e) => e.ref));
    const response = await findExistingEcheances(refs);
    if ("error" in response) {
      toast.error("Vérification des doublons impossible", {
        description: response.error,
      });
      return;
    }
    setExisting(response.existing);
  }, []);

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    setFilter("tous");
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
            removed: false,
          };
        }
      );
      preview.sort((a, b) => a.nomPrenom.localeCompare(b.nomPrenom));

      setRows(preview);
      setParseInfo({ ignoredRetraits, ignoredAnnulees, errors });
      setFileName(file.name);
      await refreshExisting(preview);
    } catch {
      toast.error("Impossible de lire ce fichier", {
        description: "Vérifie qu'il s'agit bien de l'export CSV ou Excel.",
      });
    } finally {
      setParsing(false);
    }
  }

  function setRowPlayer(nomPrenom: string, playerId: string) {
    setRows((prev) =>
      prev.map((r) => (r.nomPrenom === nomPrenom ? { ...r, playerId } : r))
    );
  }

  function setRowRemoved(nomPrenom: string, removed: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.nomPrenom === nomPrenom ? { ...r, removed } : r))
    );
  }

  const states = useMemo(
    () => new Map(rows.map((r) => [r.nomPrenom, classifyRow(r, existing, players)])),
    [rows, existing, players]
  );

  const activeRows = rows.filter((r) => !r.removed);
  const kindOf = (r: PreviewRow) => states.get(r.nomPrenom)!.kind;
  const importableRows = activeRows.filter(
    (r) => kindOf(r) === "nouveau" || kindOf(r) === "maj"
  );
  const toFixCount = activeRows.filter((r) => kindOf(r) === "corriger").length;
  const duplicateCount = activeRows.filter((r) => kindOf(r) === "doublon").length;
  const updateCount = activeRows.filter((r) => kindOf(r) === "maj").length;
  const removedCount = rows.length - activeRows.length;

  const visibleRows = rows.filter((r) => {
    if (filter === "retirees") return r.removed;
    if (r.removed) return false;
    if (filter === "pret") return kindOf(r) === "nouveau" || kindOf(r) === "maj";
    if (filter === "corriger") return kindOf(r) === "corriger";
    if (filter === "doublon") return kindOf(r) === "doublon";
    return filter === "tous";
  });

  function toggleFilter(next: Filter) {
    setFilter((current) => (current === next ? "tous" : next));
  }

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
    // Les lignes importées apparaissent désormais comme « Déjà importé ».
    await refreshExisting(rows);
    router.refresh();
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      setRows([]);
      setExisting({});
      setParseInfo(null);
      setResult(null);
      setFileName(null);
      setFilter("tous");
    }
  }

  const showIgnored = filter === "retraits" || filter === "annulees";
  const ignoredLines =
    filter === "retraits"
      ? (parseInfo?.ignoredRetraits ?? [])
      : filter === "annulees"
        ? (parseInfo?.ignoredAnnulees ?? [])
        : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <UploadIcon />
        Importer les paiements en ligne
      </Button>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importer les paiements en ligne</DialogTitle>
          <DialogDescription>
            Dépose l&apos;export « Transactions » de la plateforme de
            paiement en ligne : chaque joueur est retrouvé automatiquement à
            partir de son nom et prénom. Un fichier déjà importé peut être
            redéposé plus tard : les échéances déjà connues sont repérées
            (doublons) et seules celles qui ont changé sont mises à jour.
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
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={parsing || importing}
          >
            {parsing ? "Lecture..." : "Choisir le fichier"}
          </Button>
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
        </div>

        {parseInfo && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2 text-sm">
              <FilterChip active={filter === "tous"} onClick={() => setFilter("tous")}>
                <Badge variant="outline">
                  {activeRows.length} joueur(s) dans le fichier
                </Badge>
              </FilterChip>
              <FilterChip active={filter === "pret"} onClick={() => toggleFilter("pret")}>
                <Badge>
                  {importableRows.length} prêt(s) à importer
                  {updateCount > 0 && ` (dont ${updateCount} mise(s) à jour)`}
                </Badge>
              </FilterChip>
              {toFixCount > 0 && (
                <FilterChip
                  active={filter === "corriger"}
                  onClick={() => toggleFilter("corriger")}
                >
                  <Badge className="border-transparent bg-amber-500 text-white">
                    {toFixCount} à corriger manuellement
                  </Badge>
                </FilterChip>
              )}
              {duplicateCount > 0 && (
                <FilterChip
                  active={filter === "doublon"}
                  onClick={() => toggleFilter("doublon")}
                >
                  <Badge variant="outline">
                    {duplicateCount} déjà importé(s)
                  </Badge>
                </FilterChip>
              )}
              {removedCount > 0 && (
                <FilterChip
                  active={filter === "retirees"}
                  onClick={() => toggleFilter("retirees")}
                >
                  <Badge variant="outline">{removedCount} retirée(s)</Badge>
                </FilterChip>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {parseInfo.ignoredRetraits.length > 0 && (
                <FilterChip
                  active={filter === "retraits"}
                  onClick={() => toggleFilter("retraits")}
                >
                  <Badge variant="outline">
                    {parseInfo.ignoredRetraits.length} retrait(s) club ignoré(s)
                  </Badge>
                </FilterChip>
              )}
              {parseInfo.ignoredAnnulees.length > 0 && (
                <FilterChip
                  active={filter === "annulees"}
                  onClick={() => toggleFilter("annulees")}
                >
                  <Badge variant="outline">
                    {parseInfo.ignoredAnnulees.length} échéance(s) annulée(s)
                    ignorée(s)
                  </Badge>
                </FilterChip>
              )}
              {parseInfo.errors.length > 0 && (
                <FilterChip
                  active={filter === "erreurs"}
                  onClick={() => toggleFilter("erreurs")}
                >
                  <Badge variant="destructive">
                    {parseInfo.errors.length} ligne(s) en erreur
                  </Badge>
                </FilterChip>
              )}
            </div>
          </div>
        )}

        {showIgnored && (
          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Nom (fichier)</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ignoredLines.map((l) => (
                  <TableRow key={l.line}>
                    <TableCell className="text-muted-foreground">{l.line}</TableCell>
                    <TableCell>{l.date ? formatDateFr(l.date) : "—"}</TableCell>
                    <TableCell className="max-w-40 truncate" title={l.nomPrenom}>
                      {l.nomPrenom || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.ref || "—"}
                    </TableCell>
                    <TableCell>
                      {l.montant !== null ? eur.format(l.montant) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filter === "erreurs" && parseInfo && (
          <ul className="max-h-96 list-disc space-y-0.5 overflow-auto pl-5 text-sm text-destructive">
            {parseInfo.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}

        {!showIgnored && filter !== "erreurs" && rows.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom (fichier)</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Échéances</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      Aucune ligne dans cette catégorie.
                    </TableCell>
                  </TableRow>
                )}
                {visibleRows.map((row) => {
                  const state = states.get(row.nomPrenom)!;
                  return (
                    <TableRow
                      key={row.nomPrenom}
                      className={row.removed ? "opacity-60" : undefined}
                    >
                      <TableCell
                        className="max-w-40 truncate"
                        title={row.nomPrenom}
                      >
                        {row.nomPrenom}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.playerId}
                          onValueChange={(v) =>
                            setRowPlayer(row.nomPrenom, v ?? "")
                          }
                        >
                          <SelectTrigger
                            className="w-full"
                            disabled={importing || row.removed}
                          >
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
                        {!row.removed && state.reason && (
                          <p className="mt-1 text-xs text-destructive">
                            {state.reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.removed ? (
                          <Badge variant="outline">Retirée</Badge>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
                                KIND_CLASS[state.kind]
                              )}
                            >
                              {KIND_LABEL[state.kind]}
                            </span>
                            {state.kind === "maj" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[
                                  state.nouvelles > 0 &&
                                    `${state.nouvelles} nouvelle(s)`,
                                  state.modifiees > 0 &&
                                    `${state.modifiees} modifiée(s)`,
                                  state.identiques > 0 &&
                                    `${state.identiques} identique(s)`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="min-w-44 whitespace-normal text-sm text-muted-foreground">
                        {row.echeances.length} ×{" "}
                        {row.echeances
                          .map((e) => formatDateFr(e.date))
                          .join(", ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {eur.format(
                          row.echeances.reduce((sum, e) => sum + e.montant, 0)
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={importing}
                          aria-label={
                            row.removed
                              ? `Remettre ${row.nomPrenom} dans l'import`
                              : `Retirer ${row.nomPrenom} de l'import`
                          }
                          title={
                            row.removed
                              ? "Remettre dans l'import"
                              : "Retirer de l'import"
                          }
                          onClick={() =>
                            setRowRemoved(row.nomPrenom, !row.removed)
                          }
                        >
                          {row.removed ? <Undo2Icon /> : <TrashIcon />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
