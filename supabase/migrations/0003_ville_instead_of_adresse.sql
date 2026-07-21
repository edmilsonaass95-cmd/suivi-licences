-- Remplace l'adresse libre par la ville, utilisée pour calculer
-- automatiquement le supplément "hors Sarcelles".
alter table public.players rename column adresse to ville;
