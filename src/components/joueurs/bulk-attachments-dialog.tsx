"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileUpIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { createAttachment } from "@/app/(app)/joueurs/attachments-actions";
import {
  matchPlayersForFilename,
  type MatchablePlayer,
} from "@/lib/joueurs/name-matching";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
// Nombre de fichiers envoyés en même temps : bien plus rapide qu'un par un.
const UPLOAD_CONCURRENCY = 4;

type RowStatus = "idle" | "uploading" | "done" | "error";

type Row = {
  file: File;
  playerId: string;
  matchCount: number;
  status: RowStatus;
  error?: string;
};

function normalizeFilename(filename: string): string {
  return filename.trim().toLowerCase();
}

export function BulkAttachmentsDialog({
  players,
  existingFilenamesByPlayer,
}: {
  players: MatchablePlayer[];
  existingFilenamesByPlayer: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [summary, setSummary] = useState<{
    sent: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const pdfFiles = files.filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
    );
    const rejected = files.length - pdfFiles.length;
    if (rejected > 0) {
      toast.error(
        rejected > 1
          ? `${rejected} fichiers ignorés (seuls les PDF sont acceptés)`
          : "1 fichier ignoré (seuls les PDF sont acceptés)"
      );
    }
    const newRows: Row[] = pdfFiles.map((file) => {
      const candidates = matchPlayersForFilename(file.name, players);
      return {
        file,
        playerId: candidates.length === 1 ? candidates[0].id : "",
        matchCount: candidates.length,
        status: "idle",
      };
    });
    setRows((prev) => [...prev, ...newRows]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function setRowPlayer(index: number, playerId: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, playerId } : r))
    );
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  async function handleImport() {
    const supabase = createClient();
    // Les fichiers déjà envoyés ne sont pas renvoyés ; ceux en erreur sont
    // retentés.
    const queue = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.playerId && row.status !== "done");
    const skipped = rows.filter((r) => !r.playerId).length;
    if (queue.length === 0) return;

    setImporting(true);
    setSummary(null);
    setProgress({ done: 0, total: queue.length });

    let cursor = 0;
    let finished = 0;
    let sent = 0;
    let failed = 0;

    async function uploadOne({ row, index }: (typeof queue)[number]) {
      if (row.file.size > MAX_SIZE_BYTES) {
        updateRow(index, {
          status: "error",
          error: "Fichier trop volumineux (10 Mo max)",
        });
        failed++;
        return;
      }

      updateRow(index, { status: "uploading", error: undefined });
      const path = `${row.playerId}/${Date.now()}-${index}-${row.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, row.file);
      if (uploadError) {
        updateRow(index, { status: "error", error: uploadError.message });
        failed++;
        return;
      }

      const result = await createAttachment(row.playerId, path, row.file.name);
      if ("error" in result) {
        updateRow(index, { status: "error", error: result.error });
        failed++;
        return;
      }

      updateRow(index, { status: "done" });
      sent++;
    }

    async function worker() {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        try {
          await uploadOne(item);
        } catch (e) {
          updateRow(item.index, {
            status: "error",
            error: e instanceof Error ? e.message : "Erreur d'envoi",
          });
          failed++;
        }
        finished++;
        setProgress({ done: finished, total: queue.length });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker)
    );

    setImporting(false);
    setSummary({ sent, skipped, failed });
    router.refresh();

    const parts = [`${sent} fichier${sent > 1 ? "s" : ""} importé${sent > 1 ? "s" : ""}`];
    if (skipped > 0) parts.push(`${skipped} ignoré(s)`);
    if (failed > 0) parts.push(`${failed} en erreur`);
    if (failed > 0) {
      toast.error(parts.join(", "));
    } else {
      toast.success(parts.join(", "));
    }
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      setRows([]);
      setImporting(false);
      setProgress(null);
      setSummary(null);
    }
  }

  const importableCount = rows.filter(
    (r) => r.playerId && r.status !== "done"
  ).length;
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const duplicateFlags = useMemo(() => {
    const seenInBatch = new Map<string, number>();
    return rows.map((row) => {
      if (!row.playerId) return false;
      const key = `${row.playerId}|${normalizeFilename(row.file.name)}`;
      const alreadyExists = (existingFilenamesByPlayer[row.playerId] ?? []).some(
        (f) => normalizeFilename(f) === normalizeFilename(row.file.name)
      );
      const duplicateInBatch = seenInBatch.has(key);
      seenInBatch.set(key, (seenInBatch.get(key) ?? 0) + 1);
      return alreadyExists || duplicateInBatch;
    });
  }, [rows, existingFilenamesByPlayer]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fermer en plein envoi ferait perdre le suivi des fichiers restants.
        if (!next && importing) return;
        handleClose(next);
      }}
    >
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileUpIcon />
        Importer des pièces jointes
      </Button>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des pièces jointes en masse</DialogTitle>
          <DialogDescription>
            Dépose plusieurs PDF nommés d&apos;après le joueur concerné (ex.
            « Nom Prénom.pdf ») : le joueur est retrouvé automatiquement
            quand le rapprochement est certain, sinon choisis-le
            manuellement.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          className="rounded-lg border border-dashed border-input p-4 text-center text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
          }}
        >
          Glisse des PDF ici, ou{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => inputRef.current?.click()}
            disabled={importing}
          >
            choisis des fichiers
          </button>
        </div>

        {(importing || summary) && progress && (
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                {importing ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Import en cours... ne ferme pas cette fenêtre
                  </>
                ) : summary && summary.failed > 0 ? (
                  <>
                    <TriangleAlertIcon className="size-4 text-destructive" />
                    Import terminé avec des erreurs
                  </>
                ) : (
                  <>
                    <CheckIcon className="size-4 text-primary" />
                    Import terminé
                  </>
                )}
              </span>
              <span>{percent} %</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-3 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  summary && summary.failed > 0 ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.done} / {progress.total} fichier(s) traité(s)
              {summary && (
                <>
                  {" "}
                  — {summary.sent} ajouté(s)
                  {summary.skipped > 0 &&
                    `, ${summary.skipped} ignoré(s) (aucun joueur choisi)`}
                  {summary.failed > 0 && `, ${summary.failed} en erreur`}
                </>
              )}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.file.name}-${i}`}>
                    <TableCell className="max-w-40 truncate" title={row.file.name}>
                      {row.file.name}
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
                      {row.status === "error" && (
                        <p className="mt-1 text-xs text-destructive">
                          {row.error}
                        </p>
                      )}
                      {row.status === "idle" && duplicateFlags[i] && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <TriangleAlertIcon className="size-3 shrink-0" />
                          Doublon : un fichier du même nom existe déjà pour
                          ce joueur.
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.status === "uploading" && (
                        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                      )}
                      {row.status === "done" && (
                        <CheckIcon className="size-4 text-primary" />
                      )}
                      {row.status === "error" && (
                        <XIcon className="size-4 text-destructive" />
                      )}
                      {row.status === "idle" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={importing}
                          onClick={() => removeRow(i)}
                          aria-label="Retirer"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={importableCount === 0 || importing}
            onClick={handleImport}
          >
            {importing
              ? `Import... ${progress?.done ?? 0} / ${progress?.total ?? 0}`
              : `Importer (${importableCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
