"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon, DownloadIcon, Trash2Icon, PaperclipIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  createAttachment,
  deleteAttachment,
} from "@/app/(app)/joueurs/attachments-actions";
import { formatDateFr } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export type Attachment = {
  id: string;
  filename: string;
  file_path: string;
  created_at: string;
};

export function AttachmentsSection({
  playerId,
  attachments,
  isAdmin,
}: {
  playerId: string;
  attachments: Attachment[];
  isAdmin: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function isDuplicateFilename(filename: string) {
    const normalized = filename.trim().toLowerCase();
    return attachments.some((a) => a.filename.trim().toLowerCase() === normalized);
  }

  const duplicateAttachmentIds = useMemo(() => {
    const countByName = new Map<string, number>();
    for (const a of attachments) {
      const key = a.filename.trim().toLowerCase();
      countByName.set(key, (countByName.get(key) ?? 0) + 1);
    }
    return new Set(
      attachments
        .filter((a) => (countByName.get(a.filename.trim().toLowerCase()) ?? 0) > 1)
        .map((a) => a.id)
    );
  }, [attachments]);

  function onFilePicked(file: File) {
    if (isDuplicateFilename(file.name)) {
      setPendingDuplicate(file);
      return;
    }
    handleFileSelected(file);
  }

  async function handleFileSelected(file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Fichier trop volumineux", {
        description: "La taille maximale est de 10 Mo.",
      });
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = `${playerId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file);

    if (uploadError) {
      setUploading(false);
      toast.error("Impossible d'envoyer le fichier", {
        description: uploadError.message,
      });
      return;
    }

    const result = await createAttachment(playerId, path, file.name);
    setUploading(false);

    if (result.error) {
      toast.error("Impossible d'enregistrer le fichier", {
        description: result.error,
      });
      return;
    }

    toast.success("Fichier ajouté");
    router.refresh();
  }

  async function handleDownload(attachment: Attachment) {
    setDownloadingId(attachment.id);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("attachments")
      .download(attachment.file_path);
    setDownloadingId(null);

    if (error || !data) {
      toast.error("Impossible de télécharger le fichier", {
        description: error?.message,
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(attachmentId: string) {
    const result = await deleteAttachment(attachmentId);
    if (result.error) {
      toast.error("Impossible de supprimer le fichier", {
        description: result.error,
      });
      return;
    }
    toast.success("Fichier supprimé");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pièces jointes</h2>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFilePicked(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {uploading ? "Envoi..." : "Ajouter un fichier"}
        </Button>
      </div>

      <AlertDialog
        open={pendingDuplicate !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDuplicate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fichier déjà présent</AlertDialogTitle>
            <AlertDialogDescription>
              Un fichier nommé « {pendingDuplicate?.name} » existe déjà pour
              ce joueur. L&apos;ajouter quand même ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDuplicate) handleFileSelected(pendingDuplicate);
                setPendingDuplicate(null);
              }}
            >
              Ajouter quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune pièce jointe pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-card p-3 text-sm shadow-sm ring-1 ring-foreground/10"
            >
              <div className="flex min-w-0 items-center gap-2">
                <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.filename}</span>
                {duplicateAttachmentIds.has(a.id) && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500 text-amber-600 dark:text-amber-400"
                  >
                    Doublon
                  </Badge>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateFr(a.created_at)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={downloadingId === a.id}
                  onClick={() => handleDownload(a)}
                  aria-label="Télécharger"
                >
                  <DownloadIcon className="size-4" />
                </Button>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Supprimer"
                        />
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Supprimer ce fichier ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          « {a.filename} » sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => handleDelete(a.id)}
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
