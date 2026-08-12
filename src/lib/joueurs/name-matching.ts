export type MatchablePlayer = { id: string; nom: string; prenom: string };

/**
 * Normalise un nom de fichier ou un nom de joueur pour comparaison :
 * enlève l'extension, les accents, un éventuel suffixe "(1)" de fichier
 * dupliqué, uniformise séparateurs/espaces/casse.
 */
export function normalizeForMatching(value: string): string {
  return value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Retourne les joueurs dont le nom ET le prénom apparaissent tous les deux
 * dans le nom de fichier normalisé, quel que soit l'ordre ("Nom Prénom" ou
 * "Prénom Nom"). 0 candidat = aucune correspondance, plusieurs = ambigu.
 */
export function matchPlayersForFilename<T extends MatchablePlayer>(
  filename: string,
  players: T[]
): T[] {
  const normalizedFile = normalizeForMatching(filename);
  if (!normalizedFile) return [];

  return players.filter((p) => {
    const nom = normalizeForMatching(p.nom);
    const prenom = normalizeForMatching(p.prenom);
    if (!nom || !prenom) return false;
    return normalizedFile.includes(nom) && normalizedFile.includes(prenom);
  });
}
