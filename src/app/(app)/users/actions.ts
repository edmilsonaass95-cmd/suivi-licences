"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = ["admin", "manager", "viewer"] as const;
type Role = (typeof VALID_ROLES)[number];

function friendlyAuthEmailError(message: string) {
  if (message.toLowerCase().includes("rate limit")) {
    return "Limite d'envoi d'e-mails Supabase atteinte. Réessayez dans quelques minutes, ou configurez un serveur SMTP personnalisé dans Supabase (Project Settings > Authentication > SMTP Settings) pour lever cette limite.";
  }
  return message;
}

export async function createUser(values: {
  email: string;
  fullName: string;
  role: Role;
}) {
  if (!VALID_ROLES.includes(values.role)) {
    return { error: "Rôle invalide" };
  }

  const email = values.email.trim().toLowerCase();
  if (!email) return { error: "E-mail requis" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");
  const isAdmin = myRoles?.some((r) => r.role === "admin") ?? false;
  if (!isAdmin) {
    return { error: "Action réservée aux administrateurs." };
  }

  // Client isolé (sans cookies) pour ne jamais toucher à la session de l'admin connecté.
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const tempPassword = randomBytes(24).toString("base64url");

  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password: tempPassword,
    options: {
      data: values.fullName ? { full_name: values.fullName } : undefined,
    },
  });

  if (signUpError) {
    return { error: friendlyAuthEmailError(signUpError.message) };
  }

  const newUserId = signUpData.user?.id;
  if (!newUserId || signUpData.user?.identities?.length === 0) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }

  // Le compte existe déjà à ce stade : on assigne le rôle même si l'envoi
  // de l'e-mail échoue ensuite, pour ne pas laisser un compte mal configuré.
  if (values.role !== "viewer") {
    await supabase.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: newUserId, role: values.role });
    if (roleError) return { error: roleError.message };
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const { error: resetError } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocol}://${host}/auth/reset-password`,
  });
  if (resetError) {
    return {
      error: `Compte créé mais l'e-mail n'a pas pu être envoyé : ${friendlyAuthEmailError(resetError.message)}`,
    };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (disabled && user?.id === userId) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const { error } = await supabase.rpc("set_user_disabled", {
    _user_id: userId,
    _disabled: disabled,
  });
  if (error) return { error: error.message };

  revalidatePath("/users");
  return { success: true };
}

export async function updateUserRole(userId: string, role: Role) {
  if (!VALID_ROLES.includes(role)) {
    return { error: "Rôle invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === userId && role !== "admin") {
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("user_id", userId);
    if (!count) {
      return {
        error:
          "Impossible de retirer le rôle admin : vous êtes le seul administrateur.",
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (insertError) return { error: insertError.message };

  revalidatePath("/users");
  return { success: true };
}
