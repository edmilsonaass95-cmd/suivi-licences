// Tarifs du club, saison 2026-2027.
// Source : "Prix licences par catégorie.xlsx" fourni par le club.
// Mise à jour FFF : le supplément mutation s'applique désormais dès U10
// (auparavant à partir de U13).
type Pricing = { base: number; mutation: number };

export const LICENCE_PRICING: Record<string, Pricing> = {
  U6: { base: 300, mutation: 0 },
  U7: { base: 380, mutation: 0 },
  U8: { base: 380, mutation: 0 },
  U9: { base: 380, mutation: 0 },
  U10: { base: 380, mutation: 34.6 },
  U11: { base: 380, mutation: 34.6 },
  U12: { base: 380, mutation: 34.6 },
  U13: { base: 400, mutation: 34.6 },
  U14: { base: 400, mutation: 34.6 },
  U15: { base: 400, mutation: 34.6 },
  U16: { base: 420, mutation: 34.6 },
  U17: { base: 420, mutation: 34.6 },
  U18: { base: 420, mutation: 34.6 },
  U19: { base: 420, mutation: 91.6 },
  U20: { base: 420, mutation: 91.6 },
  Senior: { base: 420, mutation: 91.6 },
  U6F: { base: 320, mutation: 0 },
  U7F: { base: 320, mutation: 0 },
  U8F: { base: 320, mutation: 0 },
  U9F: { base: 320, mutation: 0 },
  U10F: { base: 320, mutation: 34.6 },
  U11F: { base: 320, mutation: 34.6 },
  U12F: { base: 320, mutation: 34.6 },
  U13F: { base: 320, mutation: 34.6 },
  U14F: { base: 340, mutation: 34.6 },
  U15F: { base: 340, mutation: 34.6 },
  U16F: { base: 340, mutation: 34.6 },
  U17F: { base: 340, mutation: 34.6 },
  U18F: { base: 340, mutation: 34.6 },
  // U19F absent du fichier source : alignée sur U20F (même palier U19-U20).
  U19F: { base: 340, mutation: 91.6 },
  U20F: { base: 340, mutation: 91.6 },
  "Senior F": { base: 340, mutation: 91.6 },
  // Le fichier source ne précise pas de supplément mutation pour les vétérans : 0 par défaut.
  Vétéran: { base: 200, mutation: 0 },
  "Vétéran F": { base: 200, mutation: 0 },
};

export const NATURES = [
  "renouvellement",
  "libre",
  "changement_inter_ligue",
  "changement_intra_ligue",
] as const;
export type Nature = (typeof NATURES)[number];

export const NATURE_LABELS: Record<Nature, string> = {
  renouvellement: "Renouvellement",
  libre: "Libre (pas de licence la saison précédente)",
  changement_inter_ligue: "Changement de club inter ligue",
  changement_intra_ligue: "Changement de club dans la ligue",
};

const NATURES_AVEC_MUTATION: Nature[] = [
  "changement_inter_ligue",
  "changement_intra_ligue",
];

export const NIVEAUX = [
  "standard",
  "u17_nat",
  "u19_nat",
  "u19_nat_f",
  "d3f",
  "senior_1",
] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const NIVEAU_LABELS: Record<Niveau, string> = {
  standard: "Standard",
  u17_nat: "U17NAT",
  u19_nat: "U19NAT",
  u19_nat_f: "U19NAT F",
  d3f: "D3F",
  senior_1: "Sénior 1",
};

// Remplace le tarif de base par catégorie pour un niveau spécial ; le
// supplément mutation (par catégorie), le supplément hors Sarcelles et la
// remise continuent de s'appliquer par-dessus.
const NIVEAU_BASE_PRICE: Partial<Record<Niveau, number>> = {
  u17_nat: 480,
  u19_nat: 480,
  u19_nat_f: 450,
  d3f: 450,
  senior_1: 500,
};

const SUPPLEMENT_HORS_SARCELLES = 20;

export const REMISE_PARENTE = 20;

export function isHorsSarcelles(ville: string): boolean {
  return ville.trim().toLowerCase() !== "sarcelles";
}

/** Le motif "parente" impose toujours le même montant ; "autre" utilise le montant saisi. */
export function resolveRemise(
  motif: "aucune" | "parente" | "autre",
  remise: number
): number {
  if (motif === "parente") return REMISE_PARENTE;
  if (motif === "autre") return remise;
  return 0;
}

export function getLicencePrice(
  categorie: string,
  sexe: "M" | "F",
  nature: Nature,
  horsSarcelles: boolean,
  remise = 0,
  niveau: Niveau = "standard"
): number {
  const pricing = LICENCE_PRICING[categorie];
  if (!pricing) return 0;
  let price = niveau === "standard" ? pricing.base : (NIVEAU_BASE_PRICE[niveau] ?? pricing.base);
  if (NATURES_AVEC_MUTATION.includes(nature)) price += pricing.mutation;
  // Le supplément hors Sarcelles ne s'applique pas aux licenciées féminines.
  if (horsSarcelles && sexe !== "F") price += SUPPLEMENT_HORS_SARCELLES;
  price -= remise;
  return Math.max(0, Math.round(price * 100) / 100);
}
