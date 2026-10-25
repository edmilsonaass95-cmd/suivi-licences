-- ============================================================
-- Note facultative sur la remise d'un joueur
-- ============================================================
-- Permet de préciser pourquoi une remise est accordée (lien de parenté,
-- geste commercial, etc.). Vide quand il n'y a pas de remise.

alter table public.players
  add column if not exists remise_note text;
