"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";

import { importPlayers } from "@/app/(app)/import/actions";
import {
  detectColumnMapping,
  mapRow,
  normalizeKey,
  normalizeYearKey,
  parseSpreadsheet,
  type ImportedRow,
} from "@/lib/joueurs/import-parsing";
import { formatDateFr } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ExistingPlayer = { nom: string; prenom: string; date_naissance: string };

type PreviewRow = {
  data: ImportedRow | null;
  errors: string[];
  isDuplicate: boolean;
  yearDuplicateDates: string[] | null;
  forceImport: boolean;
  key: string | null;
};

export function ImportForm({
  existingPlayers,
}: {
  existingPlayers: ExistingPlayer[];
}) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const existingSet = new Set(
    existingPlayers.map((p) =>
      normalizeKey(p.nom, p.prenom, p.date_naissance)
    )
  );
  const existingYearMap = new Map<string, string[]>();
  for (const p of existingPlayers) {
    const yearKey = normalizeYearKey(p.nom, p.prenom, p.date_naissance);
    const dates = existingYearMap.get(yearKey) ?? [];
    dates.push(p.date_naissance);
    existingYearMap.set(yearKey, dates);
  }

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const { headers, rows: rawRows } = await parseSpreadsheet(file);
      const mapping = detectColumnMapping(headers);

      const seenInFile = new Set<string>();
      const seenYearInFile = new Map<string, string[]>();
      const preview: PreviewRow[] = rawRows.map((raw) => {
        const parsed = mapRow(raw, mapping);
        if (!parsed.data) {
          return {
            data: null,
            errors: parsed.errors,
            isDuplicate: false,
            yearDuplicateDates: null,
            forceImport: false,
            key: null,
          };
        }
        const key = normalizeKey(
          parsed.data.nom,
          parsed.data.prenom,
          parsed.data.date_naissance
        );
        const isDuplicate = existingSet.has(key) || seenInFile.has(key);
        seenInFile.add(key);

        let yearDuplicateDates: string[] | null = null;
        const yearKey = normalizeYearKey(
          parsed.data.nom,
          parsed.data.prenom,
          parsed.data.date_naissance
        );
        if (!isDuplicate) {
          const collisions = [
            ...(existingYearMap.get(yearKey) ?? []),
            ...(seenYearInFile.get(yearKey) ?? []),
          ];
          if (collisions.length > 0) yearDuplicateDates = collisions;
        }
        seenYearInFile.set(yearKey, [
          ...(seenYearInFile.get(yearKey) ?? []),
          parsed.data.date_naissance,
        ]);

        return {
          data: parsed.data,
          errors: [],
          isDuplicate,
          yearDuplicateDates,
          forceImport: false,
          key,
        };
      });

      setRows(preview);
      setFileName(file.name);
    } catch {
      toast.error("Impossible de lire ce fichier", {
        description: "Vérifie qu'il s'agit bien d'un fichier CSV ou Excel.",
      });
    } finally {
      setParsing(false);
    }
  };

  const importable = rows.filter(
    (r) =>
      r.data && !r.isDuplicate && (!r.yearDuplicateDates || r.forceImport)
  );

  const toggleForceImport = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, forceImport: !r.forceImport } : r
      )
    );
  };

  const handleImport = async () => {
    setImporting(true);
    const summary = await importPlayers(
      importable.map((r) => r.data as ImportedRow)
    );
    setImporting(false);

    if ("error" in summary) {
      toast.error("Import impossible", { description: summary.error });
      return;
    }

    setResult(summary);
    toast.success(`${summary.imported} joueur(s) importé(s)`);
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
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{rows.length} ligne(s) lues</Badge>
            <Badge>{importable.length} à importer</Badge>
            <Badge className="border-transparent bg-amber-500 text-white">
              {rows.filter((r) => r.data && r.isDuplicate).length} doublon(s)
              ignoré(s)
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600 dark:text-amber-400"
            >
              {
                rows.filter(
                  (r) =>
                    r.data &&
                    !r.isDuplicate &&
                    r.yearDuplicateDates &&
                    !r.forceImport
                ).length
              }{" "}
              à vérifier manuellement (non importé)
            </Badge>
            <Badge variant="destructive">
              {rows.filter((r) => !r.data).length} ligne(s) invalide(s)
            </Badge>
          </div>

          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Naissance</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.data?.nom ?? "—"}</TableCell>
                    <TableCell>{row.data?.prenom ?? "—"}</TableCell>
                    <TableCell>{row.data?.date_naissance ?? "—"}</TableCell>
                    <TableCell>{row.data?.sexe ?? "—"}</TableCell>
                    <TableCell>{row.data?.ville ?? "—"}</TableCell>
                    <TableCell>
                      {!row.data ? (
                        <Badge variant="destructive">
                          {row.errors.join(", ")}
                        </Badge>
                      ) : row.isDuplicate ? (
                        <Badge className="border-transparent bg-amber-500 text-white">
                          Ignoré (doublon)
                        </Badge>
                      ) : row.yearDuplicateDates ? (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              row.forceImport
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "border-amber-500 text-amber-600 dark:text-amber-400"
                            }
                          >
                            {row.forceImport
                              ? "Sera importé"
                              : "À vérifier — non importé"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Homonyme déjà présent, né(e) le{" "}
                            {row.yearDuplicateDates
                              .map((d) => formatDateFr(d))
                              .join(", ")}
                          </p>
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={row.forceImport}
                              onCheckedChange={() => toggleForceImport(i)}
                            />
                            Pas un doublon, importer quand même
                          </label>
                        </div>
                      ) : (
                        <Badge>À importer</Badge>
                      )}
                    </TableCell>
                  </TableRow>
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
              ? "Import en cours..."
              : `Importer ${importable.length} joueur(s)`}
          </Button>
        </>
      )}

      {result && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            <strong>{result.imported}</strong> joueur(s) importé(s),{" "}
            <strong>{result.skipped}</strong> doublon(s) ignoré(s).
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
