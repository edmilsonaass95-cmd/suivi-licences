"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon, DownloadIcon, Trash2Icon, PaperclipIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  createAttachment,
  deleteAttachment,
} from "@/app/(app)/joueurs/attachments-actions";
import { formatDateFr } from "@/lib/date";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
            if (file) handleFileSelected(file);
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
