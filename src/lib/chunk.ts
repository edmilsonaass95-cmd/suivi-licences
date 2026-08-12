/**
 * Découpe un tableau en lots. Utilisé pour éviter de dépasser la limite de
 * longueur d'URL de Supabase/PostgREST quand un filtre `.in(...)` porte sur
 * un grand nombre d'identifiants (ex: sélection de centaines de joueurs).
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
