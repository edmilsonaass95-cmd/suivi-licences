import { cookies } from "next/headers";
import { getSaisonStart } from "@/lib/categorie-fff";
import { FIRST_SAISON_START } from "@/lib/saison-selection";

export const SAISON_COOKIE = "saison_selectionnee";

export async function getSelectedSaisonStart(
  maxSaisonStart: number
): Promise<number> {
  const store = await cookies();
  const raw = store.get(SAISON_COOKIE)?.value;
  const parsed = raw ? Number(raw) : NaN;
  if (
    Number.isInteger(parsed) &&
    parsed >= FIRST_SAISON_START &&
    parsed <= maxSaisonStart
  ) {
    return parsed;
  }
  return getSaisonStart();
}
