-- ============================================================
-- Validation des comptes par un administrateur avant accès
-- ============================================================

-- Ajouté avec défaut true : tous les comptes existants sont backfillés
-- comme déjà approuvés. On bascule ensuite le défaut à false pour que
-- les prochaines inscriptions démarrent bloquées.
alter table public.profiles
  add column approved boolean not null default true;

alter table public.profiles
  alter column approved set default false;

-- Personne ne peut modifier cette colonne directement, même sur son propre
-- profil : elle ne passe que par la fonction set_user_approved ci-dessous.
revoke update (approved) on public.profiles from authenticated;

create or replace function public.set_user_approved(_user_id uuid, _approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Seuls les administrateurs peuvent valider un compte.';
  end if;

  update public.profiles set approved = _approved where id = _user_id;
end;
$$;

grant execute on function public.set_user_approved(uuid, boolean) to authenticated;

-- Le tout premier compte (déjà auto-admin) reste auto-approuvé ; tous les
-- suivants démarrent non approuvés et attendent la validation d'un admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.user_roles) into is_first_user;

  insert into public.profiles (id, email, full_name, approved)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', is_first_user);

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    (case when is_first_user then 'admin' else 'viewer' end)::public.app_role
  );

  return new;
end;
$$;
