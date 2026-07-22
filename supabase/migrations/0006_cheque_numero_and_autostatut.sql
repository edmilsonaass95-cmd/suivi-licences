-- Numéro du chèque (référence bancaire), distinct du numéro d'ordre (1 à 4).
alter table public.cheques add column numero_cheque text;
