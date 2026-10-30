  -- ============================================================
  -- Numérotation des reçus de paiement (PDF remis aux parents)
  -- ============================================================
  -- Un joueur garde le même numéro de reçu pour une saison donnée, quel que
  -- soit le nombre de fois où le reçu est regénéré. Les numéros se suivent par
  -- saison : 2026-0001, 2026-0002, etc.
  
  create table if not exists public.receipt_numbers (
    player_id uuid not null references public.players (id) on delete cascade,
    saison_start int not null check (saison_start >= 2026),
    seq int not null check (seq > 0),
    created_at timestamptz not null default now(),
    primary key (player_id, saison_start),
    unique (saison_start, seq)
  );
  
  alter table public.receipt_numbers enable row level security;
  
  create policy "receipt_numbers_select" on public.receipt_numbers
    for select to authenticated
    using (true);
  
  create policy "receipt_numbers_insert" on public.receipt_numbers
    for insert to authenticated
    with check (public.is_admin_or_manager(auth.uid()));
  
  -- Renvoie le numéro du reçu du joueur pour la saison, en le créant au besoin.
  -- Le verrou évite que deux reçus générés en même temps reçoivent le même numéro.
  create or replace function public.get_receipt_number(
    _player_id uuid,
    _saison_start int
  )
  returns int
  language plpgsql
  security invoker
  set search_path = public
  as $$
  declare
    n int;
  begin
    select seq into n
    from public.receipt_numbers
    where player_id = _player_id and saison_start = _saison_start;
  
    if n is not null then
      return n;
    end if;
  
    perform pg_advisory_xact_lock(hashtext('receipt_numbers_' || _saison_start::text));
  
    select seq into n
    from public.receipt_numbers
    where player_id = _player_id and saison_start = _saison_start;
  
    if n is not null then
      return n;
    end if;
  
    insert into public.receipt_numbers (player_id, saison_start, seq)
    select _player_id, _saison_start, coalesce(max(seq), 0) + 1
    from public.receipt_numbers
    where saison_start = _saison_start
    returning seq into n;
  
    return n;
  end;
  $$;
  
  grant execute on function public.get_receipt_number(uuid, int) to authenticated;
