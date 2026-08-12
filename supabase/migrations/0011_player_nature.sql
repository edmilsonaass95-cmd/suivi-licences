-- ============================================================
-- Remplace le drapeau booléen "mute" par une "nature" à trois valeurs
-- ============================================================
-- Permet de distinguer un renouvellement d'un changement de club (inter
-- ligue ou dans la ligue), et d'appliquer le supplément de mutation
-- existant (pricing.mutation) dès que la nature n'est pas "renouvellement".

alter table public.players
  add column nature text not null default 'renouvellement'
  check (nature in ('renouvellement', 'changement_inter_ligue', 'changement_intra_ligue'));

-- Backfill : les joueurs déjà marqués "mute" étaient forcément un changement
-- de club, mais le type précis (inter/intra ligue) n'était pas distingué à
-- l'époque. Choix arbitraire par défaut (inter ligue) sans impact sur le
-- prix (même montant de mutation pour les deux cas) ; à corriger au cas par
-- cas si besoin de distinguer précisément ces dossiers existants.
update public.players set nature = 'changement_inter_ligue' where mute = true;

alter table public.player_seasons
  add column nature text not null default 'renouvellement'
  check (nature in ('renouvellement', 'changement_inter_ligue', 'changement_intra_ligue'));

update public.player_seasons set nature = 'changement_inter_ligue' where mute = true;

alter table public.players drop column mute;
alter table public.player_seasons drop column mute;
