"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAttachment(
  playerId: string,
  filePath: string,
  filename: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("attachments").insert({
    player_id: playerId,
    file_path: filePath,
    filename,
    uploaded_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/joueurs/${playerId}`);
  return { success: true };
}

export async function deleteAttachment(attachmentId: string) {
  const supabase = await createClient();

  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("player_id, file_path")
    .eq("id", attachmentId)
    .single();

  if (fetchError || !attachment) {
    return { error: fetchError?.message ?? "Fichier introuvable" };
  }

  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([attachment.file_path]);

  if (storageError) return { error: storageError.message };

  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { error: error.message };

  revalidatePath(`/joueurs/${attachment.player_id}`);
  return { success: true };
}
