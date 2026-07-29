export const FIRST_SAISON_START = 2026;

/**
 * Saisons sélectionnables, de la plus récente à la plus ancienne, jusqu'à
 * `maxSaisonStart` (cf. getMaxKnownSaisonStart : au moins la saison suivante,
 * plus loin si des saisons ont été ajoutées manuellement).
 */
export function getSelectableSaisons(maxSaisonStart: number): number[] {
  const saisons: number[] = [];
  for (let s = maxSaisonStart; s >= FIRST_SAISON_START; s--) saisons.push(s);
  return saisons;
}

export function saisonLabel(saisonStart: number): string {
  return `${saisonStart}/${saisonStart + 1}`;
}

export function saisonShortLabel(saisonStart: number): string {
  const pad = (n: number) => String(n % 100).padStart(2, "0");
  return `${pad(saisonStart)}/${pad(saisonStart + 1)}`;
}
