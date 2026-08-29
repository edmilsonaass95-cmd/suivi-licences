/**
 * PostgREST (Supabase) plafonne chaque requête à 1000 lignes par défaut :
 * un simple .select() sur une table qui dépasse ce nombre est tronqué
 * silencieusement, sans erreur. Cette fonction relit la requête par pages
 * de 1000 (via .range()) jusqu'à épuisement pour récupérer la table
 * complète. La requête doit être triée (.order(...)) pour une pagination
 * stable.
 */
export async function fetchAllRows<T>(
  queryFn: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFn(from, from + pageSize - 1);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
