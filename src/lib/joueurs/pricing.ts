// Tarifs du club, saison 2026-2027.
// Source : "Prix licences par catégorie.xlsx" fourni par le club.
type Pricing = { base: number; mutation: number };

export const LICENCE_PRICING: Record<string, Pricing> = {
  U6: { base: 300, mutation: 0 },
  U7: { base: 380, mutation: 0 },
  U8: { base: 380, mutation: 0 },
  U9: { base: 380, mutation: 0 },
  U10: { base: 380, mutation: 0 },
  U11: { base: 380, mutation: 0 },
  U12: { base: 380, mutation: 0 },
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
  U10F: { base: 320, mutation: 0 },
  U11F: { base: 320, mutation: 0 },
  U12F: { base: 320, mutation: 0 },
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

const SUPPLEMENT_HORS_SARCELLES = 20;

export function getLicencePrice(
  categorie: string,
  mute: boolean,
  horsSarcelles: boolean
): number {
  const pricing = LICENCE_PRICING[categorie];
  if (!pricing) return 0;
  let price = pricing.base;
  if (mute) price += pricing.mutation;
  if (horsSarcelles) price += SUPPLEMENT_HORS_SARCELLES;
  return Math.round(price * 100) / 100;
}
