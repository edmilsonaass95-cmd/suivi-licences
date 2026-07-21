/** Parse une date "YYYY-MM-DD" en heure locale, sans décalage de fuseau horaire. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateFr(value: string | Date): string {
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
  // "YYYY-MM-DD" (date pure) vs horodatage complet (ex: "2026-07-21T06:30:00Z")
  const date = value.includes("T") ? new Date(value) : parseDateOnly(value);
  return date.toLocaleDateString("fr-FR");
}
