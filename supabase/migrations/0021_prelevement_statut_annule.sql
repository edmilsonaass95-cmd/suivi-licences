-- ============================================================
-- Statut "annulé" pour les échéances de prélèvement en ligne
-- ============================================================
-- L'import des paiements en ligne reprend le statut de chaque échéance de la
-- plateforme : planifiée (prevu), en succès (preleve), en échec (echec) et
-- désormais annulée (annule). Seules les échéances « prélevé » comptent comme
-- encaissées (cf. saison_paid_totals) : une échéance annulée ou planifiée
-- n'est jamais comptée.

alter type public.prelevement_statut add value if not exists 'annule';
