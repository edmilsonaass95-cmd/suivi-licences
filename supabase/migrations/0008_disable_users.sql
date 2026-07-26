-- ============================================================
-- Désactivation de comptes utilisateurs (admin)
-- ============================================================

alter table public.profiles
  add column disabled boolean not null default false;

-- Personne ne peut modifier cette colonne directement, même sur son propre
-- profil : elle ne passe que par la fonction set_user_disabled ci-dessous.
revoke update (disabled) on public.profiles from authenticated;

create or replace function public.set_user_disabled(_user_id uuid, _disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Seuls les administrateurs peuvent modifier ce champ.';
  end if;

  if _user_id = auth.uid() and _disabled then
    raise exception 'Vous ne pouvez pas désactiver votre propre compte.';
  end if;

  update public.profiles set disabled = _disabled where id = _user_id;
end;
$$;

grant execute on function public.set_user_disabled(uuid, boolean) to authenticated;
