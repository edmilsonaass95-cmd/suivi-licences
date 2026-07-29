-- ============================================================
-- Historique figé des tarifs de licence par saison
-- ============================================================

-- ---------- Table : instantané tarifaire par joueur et par saison ----------

create table public.player_seasons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  saison_start int not null check (saison_start >= 2026),
  categorie text not null,
  licence_price numeric(10, 2) not null default 0,
  mute boolean not null default false,
  hors_sarcelles boolean not null default false,
  remise numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, saison_start)
);

create index player_seasons_saison_start_idx
  on public.player_seasons (saison_start);

-- ---------- payments : saison réelle d'enregistrement du paiement ----------
-- Toujours la saison réelle du jour de saisie (getSaisonStart() côté TS),
-- jamais la saison actuellement consultée dans l'UI. Ne change jamais après coup.

alter table public.payments
  add column saison_start int;

-- Backfill : l'application n'a existé jusqu'ici que pour la saison 2026/2027.
update public.payments set saison_start = 2026 where saison_start is null;

alter table public.payments
  alter column saison_start set not null,
  add constraint payments_saison_start_check check (saison_start >= 2026);

create index payments_saison_start_idx
  on public.payments (saison_start);

-- ---------- Backfill des joueurs existants (saison 2026/2027) ----------
-- Avant cette fonctionnalité, il n'existait aucun historique : on fige
-- l'état actuel de chaque joueur comme instantané de la saison 2026,
-- en recalculant la catégorie FFF (même règle que getCategorieFFF côté TS,
-- dupliquée ici uniquement pour ce backfill ponctuel).

insert into public.player_seasons
  (player_id, saison_start, categorie, licence_price, mute, hors_sarcelles, remise)
select
  p.id,
  2026,
  case
    when (2026 + 1 - extract(year from p.date_naissance)::int) <= 20 then
      case when p.sexe = 'F'
        then 'U' || (2026 + 1 - extract(year from p.date_naissance)::int) || 'F'
        else 'U' || (2026 + 1 - extract(year from p.date_naissance)::int)
      end
    else
      case
        when (
          2026 - extract(year from p.date_naissance)::int -
          case
            when make_date(2026, 9, 2) <
                 make_date(2026, extract(month from p.date_naissance)::int, extract(day from p.date_naissance)::int)
            then 1 else 0
          end
        ) >= 35
        then case when p.sexe = 'F' then 'Vétéran F' else 'Vétéran' end
        else case when p.sexe = 'F' then 'Senior F' else 'Senior' end
      end
  end,
  p.licence_price,
  p.mute,
  p.hors_sarcelles,
  p.remise
from public.players p
on conflict (player_id, saison_start) do nothing;

-- ---------- Fonction : total payé par joueur pour une saison ----------
-- Réutilise exactement les mêmes règles de statut chèque/prélèvement que
-- la vue public.player_balances (0001_init.sql), filtrées sur saison_start.

create or replace function public.saison_paid_totals(_saison_start int)
returns table (player_id uuid, paid numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select parts.player_id, sum(parts.total) as paid
  from (
    select pay.player_id, sum(pay.amount) as total
    from public.payments pay
    where pay.saison_start = _saison_start
      and pay.mode in ('espece', 'virement', 'labaz', 'pass_aglo', 'pass_sport')
    group by pay.player_id

    union all

    select pay.player_id, sum(c.montant) as total
    from public.payments pay
    join public.cheques c on c.payment_id = pay.id
    where pay.saison_start = _saison_start
      and pay.mode = 'cheque'
      and (
        c.statut = 'encaisse'
        or (c.statut = 'a_encaisser' and c.date_encaissement >= current_date)
      )
    group by pay.player_id

    union all

    select pay.player_id, sum(pr.montant) as total
    from public.payments pay
    join public.prelevements pr on pr.payment_id = pay.id
    where pay.saison_start = _saison_start
      and pay.mode = 'prelevement'
      and pr.statut = 'preleve'
    group by pay.player_id
  ) parts
  group by parts.player_id
$$;

grant execute on function public.saison_paid_totals(int) to authenticated;

-- ---------- RLS ----------

alter table public.player_seasons enable row level security;

grant select, insert, update, delete on public.player_seasons to authenticated;

create policy "player_seasons_select" on public.player_seasons
  for select to authenticated
  using (true);

create policy "player_seasons_insert" on public.player_seasons
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "player_seasons_update" on public.player_seasons
  for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "player_seasons_delete" on public.player_seasons
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
