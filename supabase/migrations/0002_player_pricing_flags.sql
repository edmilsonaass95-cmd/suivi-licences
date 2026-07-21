-- Ajoute les informations nécessaires au calcul automatique du prix de la licence.
alter table public.players
  add column mute boolean not null default false,
  add column hors_sarcelles boolean not null default false;
