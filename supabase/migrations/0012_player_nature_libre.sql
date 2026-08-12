-- ============================================================
-- Ajoute la nature "libre" (joueur sans licence la saison précédente)
-- ============================================================
-- Traitée comme un renouvellement pour le calcul du prix (pas de
-- supplément mutation), cf. getLicencePrice dans src/lib/joueurs/pricing.ts.

alter table public.players drop constraint players_nature_check;
alter table public.players add constraint players_nature_check
  check (nature in (
    'renouvellement', 'libre', 'changement_inter_ligue', 'changement_intra_ligue'
  ));

alter table public.player_seasons drop constraint player_seasons_nature_check;
alter table public.player_seasons add constraint player_seasons_nature_check
  check (nature in (
    'renouvellement', 'libre', 'changement_inter_ligue', 'changement_intra_ligue'
  ));
