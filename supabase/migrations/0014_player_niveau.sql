-- ============================================================
-- Ajoute le niveau (compétition spéciale) du joueur
-- ============================================================
-- Par défaut "standard" : le prix reste celui de la catégorie (comme
-- aujourd'hui). Un niveau spécial remplace le tarif de base par un montant
-- fixe pour la saison (cf. NIVEAU_BASE_PRICE dans src/lib/joueurs/pricing.ts) ;
-- le supplément mutation (selon la catégorie), le supplément hors Sarcelles
-- et la remise continuent de s'appliquer par-dessus.

alter table public.players
  add column niveau text not null default 'standard'
  check (niveau in ('standard', 'u17_nat', 'u19_nat', 'u19_nat_f', 'd3f', 'senior_1'));

alter table public.player_seasons
  add column niveau text not null default 'standard'
  check (niveau in ('standard', 'u17_nat', 'u19_nat', 'u19_nat_f', 'd3f', 'senior_1'));
