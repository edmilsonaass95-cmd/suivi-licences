-- ============================================================
-- Suivi des licences — schéma initial
-- ============================================================

-- ---------- Types ----------

create type public.app_role as enum ('admin', 'manager', 'viewer');

create type public.payment_mode as enum (
  'cheque', 'espece', 'virement', 'prelevement',
  'labaz', 'pass_aglo', 'pass_sport'
);

create type public.cheque_statut as enum ('a_encaisser', 'encaisse', 'impaye');

create type public.prelevement_statut as enum ('prevu', 'preleve', 'echec');

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  date_naissance date not null,
  sexe text not null check (sexe in ('M', 'F')),
  email text,
  telephone text,
  adresse text,
  licence_price numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create unique index players_nom_prenom_naissance_key
  on public.players (lower(nom), lower(prenom), date_naissance);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mode public.payment_mode not null,
  amount numeric(10, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table public.cheques (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  numero_ordre int not null check (numero_ordre between 1 and 4),
  montant numeric(10, 2) not null,
  date_encaissement date not null,
  statut public.cheque_statut not null default 'a_encaisser',
  banque text
);

create table public.prelevements (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  numero_echeance int not null check (numero_echeance between 1 and 4),
  montant numeric(10, 2) not null,
  date_prelevement date not null,
  statut public.prelevement_statut not null default 'prevu'
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete cascade,
  file_path text not null,
  filename text not null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint attachment_has_owner check (
    player_id is not null or payment_id is not null
  )
);

-- ---------- Fonction utilitaire : a-t-on ce rôle ? ----------
-- SECURITY DEFINER pour éviter la récursion RLS quand on vérifie
-- le rôle depuis une policy sur user_roles elle-même.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_admin_or_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'manager')
$$;

-- ---------- Premier utilisateur inscrit = admin, les suivants = viewer ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  select not exists (select 1 from public.user_roles) into is_first_user;

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    (case when is_first_user then 'admin' else 'viewer' end)::public.app_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Vue des soldes par joueur ----------

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
  where pay.mode in ('espece', 'virement', 'labaz', 'pass_aglo', 'pass_sport')
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

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.players enable row level security;
alter table public.payments enable row level security;
alter table public.cheques enable row level security;
alter table public.prelevements enable row level security;
alter table public.attachments enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.user_roles, public.players,
  public.payments, public.cheques, public.prelevements, public.attachments
  to authenticated;

-- profiles : chacun voit/modifie son propre profil, l'admin voit tout
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id);

-- user_roles : chacun voit son rôle, l'admin voit et gère tous les rôles
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- players : lecture pour tous les connectés, écriture admin/manager, suppression admin
create policy "players_select" on public.players
  for select to authenticated
  using (true);

create policy "players_insert" on public.players
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "players_update" on public.players
  for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "players_delete" on public.players
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- payments
create policy "payments_select" on public.payments
  for select to authenticated
  using (true);

create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "payments_update" on public.payments
  for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "payments_delete" on public.payments
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- cheques
create policy "cheques_select" on public.cheques
  for select to authenticated
  using (true);

create policy "cheques_insert" on public.cheques
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "cheques_update" on public.cheques
  for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "cheques_delete" on public.cheques
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- prelevements
create policy "prelevements_select" on public.prelevements
  for select to authenticated
  using (true);

create policy "prelevements_insert" on public.prelevements
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "prelevements_update" on public.prelevements
  for update to authenticated
  using (public.is_admin_or_manager(auth.uid()));

create policy "prelevements_delete" on public.prelevements
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- attachments
create policy "attachments_select" on public.attachments
  for select to authenticated
  using (true);

create policy "attachments_insert" on public.attachments
  for insert to authenticated
  with check (public.is_admin_or_manager(auth.uid()));

create policy "attachments_delete" on public.attachments
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
