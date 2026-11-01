export type ChequeStatut = "a_encaisser" | "encaisse" | "impaye";
export type PrelevementStatut = "prevu" | "preleve" | "echec";

export const CHEQUE_STATUT_LABEL: Record<ChequeStatut, string> = {
  a_encaisser: "À encaisser",
  encaisse: "Encaissé",
  impaye: "Impayé",
};

export const PRELEVEMENT_STATUT_LABEL: Record<PrelevementStatut, string> = {
  prevu: "Prévu",
  preleve: "Prélevé",
  echec: "Échec",
};

/**
 * Statut qu'aura un prélèvement une fois la synchronisation automatique passée :
 * un prélèvement « prévu » dont la date est dépassée devient « prélevé »
 * (cf. syncOverduePrelevements). Sert à comparer un fichier d'import au statut
 * déjà enregistré sans y voir une modification.
 */
export function effectivePrelevementStatut(
  statut: PrelevementStatut,
  date: string
): PrelevementStatut {
  const today = new Date().toISOString().slice(0, 10);
  return statut === "prevu" && date < today ? "preleve" : statut;
}

export const PLAYER_STATUT_LABEL: Record<string, string> = {
  tous: "Tous statuts",
  paye: "Payé",
  partiel: "Partiel",
  impaye: "Impayé",
  reste_a_payer: "Reste à payer",
};
