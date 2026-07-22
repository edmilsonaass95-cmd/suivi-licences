import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Une fois la date d'encaissement dépassée, un chèque "à encaisser" est
 * considéré encaissé par défaut (le trésorier peut toujours le repasser
 * en impayé manuellement s'il revient rejeté).
 */
export async function syncOverdueCheques(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("cheques")
    .update({ statut: "encaisse" })
    .eq("statut", "a_encaisser")
    .lt("date_encaissement", today);
}

/**
 * Une fois la date de prélèvement dépassée, un prélèvement "prévu" est
 * considéré prélevé par défaut (à repasser en échec manuellement sinon).
 */
export async function syncOverduePrelevements(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("prelevements")
    .update({ statut: "preleve" })
    .eq("statut", "prevu")
    .lt("date_prelevement", today);
}
