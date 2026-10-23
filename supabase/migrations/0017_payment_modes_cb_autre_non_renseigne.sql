-- ============================================================
-- Nouveaux modes de règlement : CB, Autre, Non renseigné
-- ============================================================
-- Ces modes se comportent comme espèces/virement : le montant saisi compte
-- comme payé. Pour que tout futur mode « simple » soit compté sans avoir à
-- relire cette liste, on traite désormais comme « simple » tout mode qui
-- n'est ni chèque ni prélèvement (ces deux-là ont leurs propres échéances).

alter type public.payment_mode add value if not exists 'cb';
alter type public.payment_mode add value if not exists 'autre';
alter type public.payment_mode add value if not exists 'non_renseigne';

create or replace view public.player_balances
with (security_invoker = true) as
select
  p.id as player_id,
  p.licence_price as expected,
  coalesce(simple.total, 0)
    + coalesce(cheque_total.total, 0)
    + coalesce(prelevement_total.total, 0) as paid,
  p.licence_price - (
    coalesce(simple.total, 0)
    + coalesce(cheque_total.total, 0)
    + coalesce(prelevement_total.total, 0)
  ) as solde
from public.players p
left join (
  select pay.player_id, sum(pay.amount) as total
  from public.payments pay
  where pay.mode::text not in ('cheque', 'prelevement')
  group by pay.player_id
) simple on simple.player_id = p.id
left join (
  select pay.player_id, sum(c.montant) as total
  from public.payments pay
  join public.cheques c on c.payment_id = pay.id
  where pay.mode = 'cheque'
    and (
      c.statut = 'encaisse'
      or (c.statut = 'a_encaisser' and c.date_encaissement >= current_date)
    )
  group by pay.player_id
) cheque_total on cheque_total.player_id = p.id
left join (
  select pay.player_id, sum(pr.montant) as total
  from public.payments pay
  join public.prelevements pr on pr.payment_id = pay.id
  where pay.mode = 'prelevement'
    and pr.statut = 'preleve'
  group by pay.player_id
) prelevement_total on prelevement_total.player_id = p.id;

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
      and pay.mode::text not in ('cheque', 'prelevement')
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
