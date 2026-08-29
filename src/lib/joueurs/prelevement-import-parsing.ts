import { parseSpreadsheet } from "@/lib/joueurs/import-parsing";
import type { PrelevementStatut } from "@/lib/joueurs/statut-labels";

export type ParsedEcheance = {
  ref: string;
  nomPrenom: string;
  montant: number;
  date: string; // YYYY-MM-DD
  statut: PrelevementStatut;
};

const HEADER_ALIASES = {
  date: ["date"],
  ref: ["ref.", "ref", "reference", "référence"],
  nomPrenom: ["nom prenom", "nom prénom"],
  nature: ["nature"],
  statut: ["statut"],
  montant: ["montant"],
} as const;

type Field = keyof typeof HEADER_ALIASES;

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function detectColumns(headers: string[]): Partial<Record<Field, string>> {
  const mapping: Partial<Record<Field, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      Field,
      readonly string[],
    ][]) {
      if (mapping[field]) continue;
      if ((aliases as readonly string[]).includes(normalized)) {
        mapping[field] = header;
      }
    }
  }
  return mapping;
}

/** "15/11/2026 à 07h00" -> "2026-11-15" (l'heure n'est pas conservée). */
function parseDateTimeFr(value: unknown): string | null {
  const str = String(value ?? "").trim();
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

const STATUT_MAPPING: Record<string, PrelevementStatut | null> = {
  planifiée: "prevu",
  "en succès": "preleve",
  "en échec": "echec",
  annulée: null,
};

export type PrelevementParseResult = {
  echeances: ParsedEcheance[];
  ignoredRetraits: number;
  ignoredAnnulees: number;
  errors: string[];
};

/**
 * Lit l'export "Transactions" de la plateforme de paiement en ligne. Ne
 * garde que les lignes "Versement" (les "Retrait" sont des mouvements de
 * fonds du club vers sa banque, sans joueur associé) et exclut les
 * échéances "Annulée" (jamais prélevées, rien à suivre).
 */
export async function parsePrelevementFile(
  file: File
): Promise<PrelevementParseResult> {
  const { headers, rows } = await parseSpreadsheet(file);
  const mapping = detectColumns(headers);

  const missing = (
    ["date", "ref", "nomPrenom", "nature", "statut", "montant"] as Field[]
  ).filter((f) => !mapping[f]);
  if (missing.length > 0) {
    return {
      echeances: [],
      ignoredRetraits: 0,
      ignoredAnnulees: 0,
      errors: [
        `Colonnes introuvables dans le fichier : ${missing.join(", ")}`,
      ],
    };
  }

  const echeances: ParsedEcheance[] = [];
  let ignoredRetraits = 0;
  let ignoredAnnulees = 0;
  const errors: string[] = [];

  for (const [i, raw] of rows.entries()) {
    const nature = String(raw[mapping.nature!] ?? "").trim();
    if (nature !== "Versement") {
      if (nature === "Retrait") ignoredRetraits++;
      continue;
    }

    const ref = String(raw[mapping.ref!] ?? "").trim();
    const nomPrenom = String(raw[mapping.nomPrenom!] ?? "").trim();
    const statutRaw = String(raw[mapping.statut!] ?? "").trim();
    const statutKey = statutRaw.toLowerCase();
    const montant = Number(raw[mapping.montant!]);
    const date = parseDateTimeFr(raw[mapping.date!]);

    if (!ref || !nomPrenom) {
      errors.push(`Ligne ${i + 2} : nom ou référence manquant, ignorée.`);
      continue;
    }
    if (!(statutKey in STATUT_MAPPING)) {
      errors.push(
        `Ligne ${i + 2} (${nomPrenom}) : statut "${statutRaw}" inconnu, ignorée.`
      );
      continue;
    }
    const statut = STATUT_MAPPING[statutKey];
    if (statut === null) {
      ignoredAnnulees++;
      continue;
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      errors.push(`Ligne ${i + 2} (${nomPrenom}) : montant invalide, ignorée.`);
      continue;
    }
    if (!date) {
      errors.push(`Ligne ${i + 2} (${nomPrenom}) : date invalide, ignorée.`);
      continue;
    }

    echeances.push({ ref, nomPrenom, montant, date, statut });
  }

  return { echeances, ignoredRetraits, ignoredAnnulees, errors };
}
