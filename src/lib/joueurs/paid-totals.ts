import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export type PaidTotal = { player_id: string; paid: number };

/**
 * Total réglé par joueur pour une saison (cf. saison_paid_totals). Le résultat
 * dépasse 1000 lignes dès que plus de 1000 joueurs ont un règlement : sans
 * pagination, PostgREST le tronque en silence et les joueurs au-delà
 * apparaissent à 0 € payé.
 */
export async function fetchSaisonPaidTotals(
  supabase: SupabaseClient,
  saisonStart: number
): Promise<Map<string, number>> {
  const { data, error } = await fetchAllRows<{ player_id: string; paid: number }>(
    (from, to) =>
      supabase
        .rpc("saison_paid_totals", { _saison_start: saisonStart })
        .order("player_id")
        .range(from, to)
  );
  if (error) console.error("saison_paid_totals:", error.message);
  return new Map(data.map((r) => [r.player_id, Number(r.paid)]));
}
