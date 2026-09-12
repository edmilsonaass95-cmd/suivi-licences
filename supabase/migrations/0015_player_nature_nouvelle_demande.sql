-- ============================================================
-- Ajoute la nature "nouvelle_demande" (première demande de licence)
-- ============================================================
-- Comme "libre" et "renouvellement", ne déclenche pas le supplément
-- mutation : seul un "changement de club" (inter ou intra ligue) l'applique,
-- cf. NATURES_AVEC_MUTATION dans src/lib/joueurs/pricing.ts.

alter table public.players drop constraint players_nature_check;
alter table public.players add constraint players_nature_check
  check (nature in (
    'renouvellement', 'libre', 'nouvelle_demande',
    'changement_inter_ligue', 'changement_intra_ligue'
  ));

alter table public.player_seasons drop constraint player_seasons_nature_check;
alter table public.player_seasons add constraint player_seasons_nature_check
  check (nature in (
    'renouvellement', 'libre', 'nouvelle_demande',
    'changement_inter_ligue', 'changement_intra_ligue'
  ));
