-- ============================================================
-- Référence externe pour l'import des paiements en ligne
-- ============================================================
-- Stocke l'identifiant de transaction de la plateforme de paiement en ligne
-- (colonne "Ref." du fichier exporté) sur chaque échéance importée, pour
-- pouvoir ré-importer un export mis à jour sans dupliquer les échéances :
-- une échéance déjà connue est mise à jour (statut, montant, date) plutôt
-- que recréée. Les échéances saisies manuellement gardent cette colonne à
-- null (plusieurs null n'entrent pas en conflit avec la contrainte unique).

alter table public.prelevements
  add column reference_externe text unique;
