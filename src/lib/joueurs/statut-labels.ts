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

export const PLAYER_STATUT_LABEL: Record<string, string> = {
  tous: "Tous statuts",
  paye: "Payé",
  partiel: "Partiel",
  impaye: "Impayé",
  reste_a_payer: "Reste à payer",
};
