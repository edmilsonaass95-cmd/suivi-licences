export type Sexe = "M" | "F";

/**
 * Année de début de la saison en cours (ex: 2026 pour la saison 2026-2027).
 * La saison sportive FFF démarre le 1er juillet.
 */
export function getSaisonStart(date: Date = new Date()): number {
  const month = date.getMonth(); // 0 = janvier
  return month >= 6 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getCategorieFFF(
  dateNaissance: Date,
  sexe: Sexe,
  saisonStart: number
): string {
  const birthYear = dateNaissance.getFullYear();
  const diff = saisonStart + 1 - birthYear;

  if (diff <= 20) {
    const label = `U${diff}`;
    return sexe === "F" ? `${label}F` : label;
  }

  // Au-delà de U20 : Senior ou Vétéran, selon l'âge au 2 septembre de la saison.
  const reference = new Date(saisonStart, 8, 2);
  const birthdayThisYear = new Date(
    reference.getFullYear(),
    dateNaissance.getMonth(),
    dateNaissance.getDate()
  );
  const age =
    reference.getFullYear() -
    birthYear -
    (reference < birthdayThisYear ? 1 : 0);

  const label = age >= 35 ? "Vétéran" : "Senior";
  return sexe === "F" ? `${label} F` : label;
}
