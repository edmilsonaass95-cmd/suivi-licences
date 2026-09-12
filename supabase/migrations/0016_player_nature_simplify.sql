-- ============================================================
-- Simplifie la nature du joueur à 3 valeurs
-- ============================================================
-- Remplace les 5 valeurs précédentes (renouvellement, libre, nouvelle
-- demande, changement de club inter ligue, changement de club dans la
-- ligue) par 3 : renouvellement, nouvelle_demande, changement_club. Seul
-- "changement_club" applique désormais le supplément mutation, cf.
-- NATURES_AVEC_MUTATION dans src/lib/joueurs/pricing.ts.
--
-- Aucune ligne existante n'utilise "libre", "changement_inter_ligue" ou
-- "changement_intra_ligue" au moment de cette migration (vérifié en
-- production) : pas de correction de données nécessaire avant de resserrer
-- la contrainte.

alter table public.players drop constraint players_nature_check;
alter table public.players add constraint players_nature_check
  check (nature in ('renouvellement', 'nouvelle_demande', 'changement_club'));

alter table public.player_seasons drop constraint player_seasons_nature_check;
alter table public.player_seasons add constraint player_seasons_nature_check
  check (nature in ('renouvellement', 'nouvelle_demande', 'changement_club'));
