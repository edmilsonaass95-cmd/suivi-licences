-- Quand la remise est motivée par un lien de parenté, on enregistre
-- avec quel autre joueur/joueuse ce lien existe.
alter table public.players
  add column remise_lien_joueur_id uuid references public.players (id) on delete set null;

alter table public.players
  add constraint remise_parente_requires_lien check (
    remise_motif is distinct from 'parente' or remise_lien_joueur_id is not null
  );
