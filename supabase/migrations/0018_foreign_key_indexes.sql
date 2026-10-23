-- ============================================================
-- Index sur les clés étrangères (suppression en masse trop lente)
-- ============================================================
-- Postgres n'indexe pas automatiquement les colonnes qui référencent une
-- autre table. Sans index, supprimer un joueur oblige à parcourir en entier
-- les tables payments, cheques, prelevements, attachments et players (lien
-- de parenté) pour retrouver les lignes liées : la suppression d'un grand
-- nombre de joueurs dépassait le délai maximal d'une requête et s'arrêtait
-- en cours de route. Ces index accélèrent aussi l'affichage des fiches.

create index if not exists payments_player_id_idx
  on public.payments (player_id);

create index if not exists cheques_payment_id_idx
  on public.cheques (payment_id);

create index if not exists prelevements_payment_id_idx
  on public.prelevements (payment_id);

create index if not exists attachments_player_id_idx
  on public.attachments (player_id);

create index if not exists attachments_payment_id_idx
  on public.attachments (payment_id);

create index if not exists players_remise_lien_joueur_id_idx
  on public.players (remise_lien_joueur_id);
