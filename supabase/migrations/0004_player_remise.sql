-- Remise appliquée à un joueur, toujours accompagnée d'un motif.
alter table public.players
  add column remise numeric(10, 2) not null default 0,
  add column remise_motif text check (remise_motif in ('parente', 'autre'));

alter table public.players
  add constraint remise_requires_motif check (
    (remise = 0 and remise_motif is null) or
    (remise > 0 and remise_motif is not null)
  );
