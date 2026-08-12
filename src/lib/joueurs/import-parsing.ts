import * as XLSX from "xlsx";

export type ImportedRow = {
  nom: string;
  prenom: string;
  date_naissance: string; // YYYY-MM-DD
  sexe: "M" | "F";
  email: string;
  telephone: string;
  ville: string;
};

export type ParsedRow = {
  raw: Record<string, unknown>;
  data: ImportedRow | null;
  errors: string[];
};

const HEADER_ALIASES: Record<keyof ImportedRow, string[]> = {
  nom: ["nom"],
  prenom: ["prenom", "prénom"],
  date_naissance: [
    "date de naissance",
    "date naissance",
    "datedenaissance",
    "naissance",
    "ne(e) le",
    "ne le",
    "nee le",
    "ddn",
  ],
  sexe: ["sexe", "genre"],
  email: ["email", "e-mail", "mail"],
  telephone: ["telephone", "téléphone", "tel", "tél"],
  ville: ["ville", "commune"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Associe chaque colonne du fichier à un champ connu, à partir de l'en-tête. */
export function detectColumnMapping(
  headers: string[]
): Partial<Record<keyof ImportedRow, string>> {
  const mapping: Partial<Record<keyof ImportedRow, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof ImportedRow,
      string[],
    ][]) {
      if (mapping[field]) continue;
      if (aliases.includes(normalized)) {
        mapping[field] = header;
      }
    }
  }
  return mapping;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Convertit une date de multiples formats (texte ou numéro de série Excel) en "YYYY-MM-DD". */
export function parseFlexibleDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    return `${date.y}-${pad(date.m)}-${pad(date.d)}`;
  }

  const str = String(value).trim();

  let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) {
    return `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`;
  }

  return null;
}

export function parseFlexibleSexe(value: unknown): "M" | "F" | null {
  const str = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["m", "masculin", "garcon", "garçon", "homme", "h"].includes(str)) {
    return "M";
  }
  if (["f", "feminin", "féminin", "fille", "femme"].includes(str)) {
    return "F";
  }
  return null;
}

export async function parseSpreadsheet(
  file: File
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  // Les fichiers CSV sont lus comme texte pour préserver l'encodage UTF-8
  // (les accents) ; XLSX.read sur un buffer brut suppose du binaire.
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });
  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : ((XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          range: 0,
        })[0] as string[]) ?? []);
  return { headers, rows };
}

export function normalizeKey(
  nom: string,
  prenom: string,
  dateNaissance: string
): string {
  return `${nom.trim().toLowerCase()}|${prenom.trim().toLowerCase()}|${dateNaissance}`;
}

/**
 * Clé plus large que normalizeKey : ne compare que l'année de naissance,
 * pas la date exacte. Sert à repérer les homonymes probables (même nom,
 * prénom et année) même quand la date précise diffère d'une saisie à
 * l'autre, sans les considérer comme un doublon certain.
 */
export function normalizeYearKey(
  nom: string,
  prenom: string,
  dateNaissance: string
): string {
  return `${nom.trim().toLowerCase()}|${prenom.trim().toLowerCase()}|${dateNaissance.slice(0, 4)}`;
}

export function mapRow(
  raw: Record<string, unknown>,
  mapping: Partial<Record<keyof ImportedRow, string>>
): ParsedRow {
  const errors: string[] = [];

  const nom = mapping.nom ? String(raw[mapping.nom] ?? "").trim() : "";
  const prenom = mapping.prenom
    ? String(raw[mapping.prenom] ?? "").trim()
    : "";
  const dateNaissanceRaw = mapping.date_naissance
    ? raw[mapping.date_naissance]
    : undefined;
  const sexeRaw = mapping.sexe ? raw[mapping.sexe] : undefined;
  const email = mapping.email ? String(raw[mapping.email] ?? "").trim() : "";
  const telephone = mapping.telephone
    ? String(raw[mapping.telephone] ?? "").trim()
    : "";
  const ville = mapping.ville
    ? String(raw[mapping.ville] ?? "").trim()
    : "Sarcelles";

  if (!nom) errors.push("Nom manquant");
  if (!prenom) errors.push("Prénom manquant");

  const dateNaissance = parseFlexibleDate(dateNaissanceRaw);
  if (!dateNaissance) errors.push("Date de naissance invalide ou manquante");

  const sexe = parseFlexibleSexe(sexeRaw);
  if (!sexe) errors.push("Sexe invalide ou manquant (M/F)");

  if (errors.length > 0 || !dateNaissance || !sexe) {
    return { raw, data: null, errors };
  }

  return {
    raw,
    data: {
      nom,
      prenom,
      date_naissance: dateNaissance,
      sexe,
      email,
      telephone,
      ville: ville || "Sarcelles",
    },
    errors: [],
  };
}
