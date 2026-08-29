"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { ensurePlayerSeasons, getMaxKnownSaisonStart } from "@/lib/joueurs/seasons";
import { FIRST_SAISON_START } from "@/lib/saison-selection";
import { SAISON_COOKIE } from "@/lib/saison-selection-cookie";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

function setSaisonCookie(
  store: Awaited<ReturnType<typeof cookies>>,
  saisonStart: number
) {
  store.set(SAISON_COOKIE, String(saisonStart), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setSaisonSelectionnee(saisonStart: number) {
  const supabase = await createClient();
  const maxSaisonStart = await getMaxKnownSaisonStart(supabase);
  if (
    !Number.isInteger(saisonStart) ||
    saisonStart < FIRST_SAISON_START ||
    saisonStart > maxSaisonStart
  ) {
    return { error: "Saison invalide." };
  }
  const store = await cookies();
  setSaisonCookie(store, saisonStart);
  return { success: true };
}

/**
 * Ajoute une saison au-delà de la dernière connue (au minimum la saison
 * suivant la saison réelle) : crée l'instantané tarifaire de tous les
 * joueurs pour cette nouvelle saison et la sélectionne aussitôt.
 */
export async function addNextSaison() {
  const { canWrite } = await getCurrentUserRoles();
  if (!canWrite) {
    return { error: "Action réservée aux administrateurs et gestionnaires." };
  }

  const supabase = await createClient();
  const maxSaisonStart = await getMaxKnownSaisonStart(supabase);
  const nextSaison = maxSaisonStart + 1;

  const { data: players, error } = await fetchAllRows((from, to) =>
    supabase
      .from("players")
      .select("id, date_naissance, sexe, nature, niveau, hors_sarcelles, remise")
      .order("id")
      .range(from, to)
  );

  if (error) return { error: error.message };

  await ensurePlayerSeasons(
    supabase,
    (players ?? []).map((p) => ({
      id: p.id,
      date_naissance: p.date_naissance,
      sexe: p.sexe as "M" | "F",
      nature: p.nature,
      niveau: p.niveau,
      hors_sarcelles: p.hors_sarcelles,
      remise: Number(p.remise),
    })),
    nextSaison,
    { canWrite: true }
  );

  const store = await cookies();
  setSaisonCookie(store, nextSaison);

  revalidatePath("/dashboard");
  revalidatePath("/joueurs");
  return { success: true, saisonStart: nextSaison };
}
