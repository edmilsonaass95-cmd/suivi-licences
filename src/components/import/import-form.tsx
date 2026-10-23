"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";

import { importPlayers } from "@/app/(app)/import/actions";
import {
  detectColumnMapping,
  isIsoDate,
  normalizeKey,
  normalizeYearKey,
  parseSpreadsheet,
  rowToDraft,
  validateDraft,
  type ImportDraft,
  type ImportedRow,
} from "@/lib/joueurs/import-parsing";
import { formatDateFr } from "@/lib/date";
import { chunk } from "@/lib/chunk";
import { NATURE_LABELS, NATURES, type Nature } from "@/lib/joueurs/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Un seul appel pour 1300 lignes dépassait la durée maximale d'une requête.
const IMPORT_BATCH_SIZE = 100;

type ExistingPlayer = { nom: string; prenom: string; date_naissance: string };

type Action = "importer" | "ignorer";

/** `choice` = choix manuel de l'utilisateur ; sinon le statut proposé s'applique. */
type Row = { id: number; draft: ImportDraft; choice: Action | null };

type RowStatus = {
  data: ImportedRow | null;
  errors: string[];
  isDuplicate: boolean;
  yearDuplicateDates: string[] | null;
  /** Statut proposé automatiquement. */
  suggested: Action;
};

const CELL_CLASS =
  "h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

const STATUS_CLASS: Record<Action, string> = {
  importer: "border-primary/50 bg-primary/10 font-medium text-primary",
  ignorer:
    "border-amber-500 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-400",
};

function sameStatus(a: RowStatus, b: RowStatus) {
  return (
    a.suggested === b.suggested &&
    a.isDuplicate === b.isDuplicate &&
    a.errors.join("|") === b.errors.join("|") &&
    (a.yearDuplicateDates ?? []).join("|") ===
      (b.yearDuplicateDates ?? []).join("|")
  );
}

type RowEditorProps = {
  row: Row;
  status: RowStatus;
  onChange: (id: number, patch: Partial<ImportDraft>) => void;
  onSetStatus: (id: number, value: Action | "supprimer") => void;
};

const RowEditor = memo(
  function RowEditor({ row, status, onChange, onSetStatus }: RowEditorProps) {
    const { draft, id } = row;
    const effective: Action = row.choice ?? status.suggested;
    const text = (field: keyof ImportDraft, width?: string) => (
      <input
        className={CELL_CLASS}
        style={width ? { minWidth: width } : undefined}
        value={draft[field] as string}
        onChange={(e) => onChange(id, { [field]: e.target.value })}
      />
    );
    const date = (field: "date_naissance" | "date_reglement") => (
      <input
        type="date"
        className={CELL_CLASS}
        style={{ minWidth: "8.5rem" }}
        value={isIsoDate(draft[field]) ? draft[field] : ""}
        onChange={(e) => onChange(id, { [field]: e.target.value })}
      />
    );

    return (
      <TableRow>
        <TableCell className="align-top">
          <select
            className={`${CELL_CLASS} ${STATUS_CLASS[effective]}`}
            style={{ minWidth: "9rem" }}
            value={effective}
            onChange={(e) =>
              onSetStatus(id, e.target.value as Action | "supprimer")
            }
          >
            <option value="importer">À importer</option>
            <option value="ignorer">
              {status.isDuplicate ? "Ignoré (doublon)" : "Ignoré"}
            </option>
            <option value="supprimer">Supprimer</option>
          </select>
          {status.errors.length > 0 && (
            <p className="mt-1 max-w-40 text-xs text-destructive">
              {status.errors.join(", ")}
            </p>
          )}
          {status.isDuplicate && (
            <p className="mt-1 max-w-40 text-xs text-amber-600 dark:text-amber-400">
              Déjà présent (même nom, prénom et naissance)
            </p>
          )}
          {!status.isDuplicate && status.yearDuplicateDates && (
            <p className="mt-1 max-w-40 text-xs text-amber-600 dark:text-amber-400">
              Homonyme possible, né(e) le{" "}
              {status.yearDuplicateDates.map((d) => formatDateFr(d)).join(", ")}
            </p>
          )}
        </TableCell>
        <TableCell className="align-top">{text("nom", "7rem")}</TableCell>
        <TableCell className="align-top">{text("prenom", "7rem")}</TableCell>
        <TableCell className="align-top">{date("date_naissance")}</TableCell>
        <TableCell className="align-top">
          <select
            className={CELL_CLASS}
            style={{ minWidth: "3.5rem" }}
            value={draft.sexe === "M" || draft.sexe === "F" ? draft.sexe : ""}
            onChange={(e) => onChange(id, { sexe: e.target.value })}
          >
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </TableCell>
        <TableCell className="align-top">
          <select
            className={CELL_CLASS}
            style={{ minWidth: "9rem" }}
            value={draft.nature}
            onChange={(e) =>
              onChange(id, { nature: e.target.value as Nature })
            }
          >
            {NATURES.map((n) => (
              <option key={n} value={n}>
                {NATURE_LABELS[n]}
              </option>
            ))}
          </select>
        </TableCell>
        <TableCell className="align-top">{text("ville", "7rem")}</TableCell>
        <TableCell className="align-top">{text("email", "10rem")}</TableCell>
        <TableCell className="align-top">{text("telephone", "7rem")}</TableCell>
        <TableCell className="align-top">{text("montant", "4.5rem")}</TableCell>
        <TableCell className="align-top">{date("date_reglement")}</TableCell>
        <TableCell className="align-top">{text("note", "8rem")}</TableCell>
      </TableRow>
    );
  },
  (prev, next) =>
    prev.row === next.row && sameStatus(prev.status, next.status)
);

export function ImportForm({
  existingPlayers,
}: {
  existingPlayers: ExistingPlayer[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    paymentsCreated: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const router = useRouter();

  const { existingSet, existingYearMap } = useMemo(() => {
    const set = new Set(
      existingPlayers.map((p) =>
        normalizeKey(p.nom, p.prenom, p.date_naissance)
      )
    );
    const yearMap = new Map<string, string[]>();
    for (const p of existingPlayers) {
      const yearKey = normalizeYearKey(p.nom, p.prenom, p.date_naissance);
      const dates = yearMap.get(yearKey) ?? [];
      dates.push(p.date_naissance);
      yearMap.set(yearKey, dates);
    }
    return { existingSet: set, existingYearMap: yearMap };
  }, [existingPlayers]);

  // Statut proposé pour chaque ligne, recalculé à chaque modification :
  // les lignes en erreur, les doublons et les homonymes sont proposés
  // « Ignoré », le reste « À importer ». L'utilisateur peut tout changer.
  const statuses = useMemo<RowStatus[]>(() => {
    const seenInFile = new Set<string>();
    const seenYearInFile = new Map<string, string[]>();
    return rows.map((row) => {
      const { data, errors } = validateDraft(row.draft);
      if (!data) {
        return {
          data: null,
          errors,
          isDuplicate: false,
          yearDuplicateDates: null,
          suggested: "ignorer",
        };
      }
      const key = normalizeKey(data.nom, data.prenom, data.date_naissance);
      const isDuplicate = existingSet.has(key) || seenInFile.has(key);
      seenInFile.add(key);

      const yearKey = normalizeYearKey(
        data.nom,
        data.prenom,
        data.date_naissance
      );
      let yearDuplicateDates: string[] | null = null;
      if (!isDuplicate) {
        const collisions = [
          ...(existingYearMap.get(yearKey) ?? []),
          ...(seenYearInFile.get(yearKey) ?? []),
        ];
        if (collisions.length > 0) yearDuplicateDates = collisions;
      }
      seenYearInFile.set(yearKey, [
        ...(seenYearInFile.get(yearKey) ?? []),
        data.date_naissance,
      ]);

      return {
        data,
        errors: [],
        isDuplicate,
        yearDuplicateDates,
        suggested: isDuplicate || yearDuplicateDates ? "ignorer" : "importer",
      };
    });
  }, [rows, existingSet, existingYearMap]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const { headers, rows: rawRows } = await parseSpreadsheet(file);
      const mapping = detectColumnMapping(headers);
      setRows(
        rawRows.map((raw) => ({
          id: nextId.current++,
          draft: rowToDraft(raw, mapping),
          choice: null,
        }))
      );
      setFileName(file.name);
    } catch {
      toast.error("Impossible de lire ce fichier", {
        description: "Vérifie qu'il s'agit bien d'un fichier CSV ou Excel.",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleChange = useCallback(
    (id: number, patch: Partial<ImportDraft>) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, draft: { ...r.draft, ...patch } } : r
        )
      );
    },
    []
  );

  const handleSetStatus = useCallback(
    (id: number, value: Action | "supprimer") => {
      setRows((prev) =>
        value === "supprimer"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, choice: value } : r))
      );
    },
    []
  );

  const importable: ImportedRow[] = [];
  let nbIgnored = 0;
  let nbToFix = 0;
  rows.forEach((row, i) => {
    const s = statuses[i];
    const effective = row.choice ?? s.suggested;
    if (effective === "ignorer") nbIgnored++;
    else if (s.data) importable.push(s.data);
    else nbToFix++;
  });

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    const total = { imported: 0, skipped: 0, paymentsCreated: 0, errors: [] as string[] };
    let done = 0;

    for (const batch of chunk(importable, IMPORT_BATCH_SIZE)) {
      setProgress(`${done} / ${importable.length}`);
      let summary;
      try {
        summary = await importPlayers(batch);
      } catch {
        total.errors.push(
          `Connexion interrompue après ${done} ligne(s) : relance l'import, les joueurs déjà importés seront ignorés.`
        );
        break;
      }
      if ("error" in summary) {
        total.errors.push(summary.error ?? "Import impossible");
        break;
      }
      total.imported += summary.imported;
      total.skipped += summary.skipped;
      total.paymentsCreated += summary.paymentsCreated;
      total.errors.push(...summary.errors);
      done += batch.length;
    }

    setImporting(false);
    setProgress(null);
    setResult(total);
    if (total.imported > 0) {
      toast.success(`${total.imported} joueur(s) importé(s)`);
    }
    if (done < importable.length) {
      toast.error("Import interrompu", {
        description: `${done} ligne(s) traitée(s) sur ${importable.length}.`,
      });
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
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
          <UploadIcon />
          {parsing ? "Lecture..." : "Choisir un fichier CSV ou Excel"}
        </Button>
        {fileName && (
          <span className="text-sm text-muted-foreground">{fileName}</span>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            Modifie n&apos;importe quelle cellule, et choisis pour chaque ligne
            son statut : « À importer », « Ignoré » ou « Supprimer » (retire la
            ligne de la liste).
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{rows.length} ligne(s)</Badge>
            <Badge>{importable.length} à importer</Badge>
            <Badge className="border-transparent bg-amber-500 text-white">
              {nbIgnored} ignorée(s)
            </Badge>
            {nbToFix > 0 && (
              <Badge variant="destructive">
                {nbToFix} à corriger (erreur)
              </Badge>
            )}
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statut</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Naissance</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date règl.</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    status={statuses[i]}
                    onChange={handleChange}
                    onSetStatus={handleSetStatus}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || importable.length === 0}
          >
            {importing
              ? `Import en cours... ${progress ?? ""}`
              : `Importer ${importable.length} joueur(s)`}
          </Button>
        </>
      )}

      {result && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            <strong>{result.imported}</strong> joueur(s) importé(s),{" "}
            <strong>{result.skipped}</strong> refusé(s) car déjà présent(s)
            {result.paymentsCreated > 0 && (
              <>
                , <strong>{result.paymentsCreated}</strong> paiement(s)
                enregistré(s)
              </>
            )}
            .
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
    </div>
  );
}
