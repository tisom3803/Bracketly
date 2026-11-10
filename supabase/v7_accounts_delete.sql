-- Bracketly v7 (2.9.0): accounts like Roundly (quiet per-device sign-in + optional email code / Google / Apple account),
-- moving a device's tournaments into the account, "remove from my list", delete my account, and media cleanup on delete.
-- Additive only: new tables, new functions, one new storage policy. Nothing existing is changed or dropped.

-- 1) Account profile (one row per signed-in account; anonymous device sessions never get one)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text check (char_length(name) <= 80),
  usta text check (char_length(usta) <= 20),
  ntrp text check (char_length(ntrp) <= 8),
  ntrp_type text check (char_length(ntrp_type) <= 4),
  phone text check (char_length(phone) <= 30),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists profiles_own_write on public.profiles;
create policy profiles_own_write on public.profiles for insert to authenticated
  with check (user_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
drop policy if exists profiles_own_delete on public.profiles;
create policy profiles_own_delete on public.profiles for delete to authenticated using (user_id = auth.uid());
revoke all on public.profiles from anon;

-- 2) One-time tokens that carry a device's tournaments into the account it signs in to (same idea as Roundly)
create table if not exists public.merge_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '2 hours'
);
alter table public.merge_tokens enable row level security;   -- no policies: only the functions below touch it
revoke all on public.merge_tokens from anon, authenticated;

create or replace function public.make_merge_token()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false then return null; end if;
  delete from merge_tokens where user_id = auth.uid() or expires_at < now();
  t := encode(gen_random_bytes(24), 'hex');
  insert into merge_tokens (token, user_id) values (t, auth.uid());
  return t;
end $$;

create or replace function public.claim_merge(p_token text)
returns integer language plpgsql security definer set search_path = public as $$
declare src uuid; me uuid := auth.uid(); n integer := 0;
begin
  if me is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Sign in first'; end if;
  delete from merge_tokens where token = p_token and expires_at > now() returning user_id into src;
  if src is null or src = me then return 0; end if;
  -- only ever move from an anonymous device session, never from another real account
  if not exists (select 1 from auth.users u where u.id = src and u.is_anonymous) then return 0; end if;
  insert into trip_members (trip_id, user_id, role, player_id, joined_at)
    select m.trip_id, me, m.role, m.player_id, m.joined_at from trip_members m where m.user_id = src
  on conflict (trip_id, user_id) do update
    set role = case when trip_members.role = 'admin' or excluded.role = 'admin' then 'admin' else trip_members.role end,
        player_id = coalesce(trip_members.player_id, excluded.player_id);
  get diagnostics n = row_count;
  delete from trip_members where user_id = src;
  update trips set created_by = me where created_by = src;
  update invites set accepted_by = me where accepted_by = src;
  update invites set created_by = me where created_by = src;
  insert into invite_seen (invite_id, user_id, seen_at) select invite_id, me, seen_at from invite_seen where user_id = src on conflict do nothing;
  delete from invite_seen where user_id = src;
  update push_subscriptions set user_id = me where user_id = src;
  return n;
end $$;

-- 3) Take a tournament off your own list (it stays for everyone else; rejoin any time with the code)
create or replace function public.leave_trip(p_trip uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  delete from trip_members where trip_id = p_trip and user_id = auth.uid();
  delete from push_subscriptions where trip_id = p_trip and user_id = auth.uid();
  return true;
end $$;

-- 4) Delete my account (signed-in accounts only). Tournaments stay for everyone else; memberships go with the account.
create or replace function public.delete_my_account()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Sign in first'; end if;
  delete from auth.users where id = auth.uid();
  return true;
end $$;

revoke all on function public.make_merge_token() from public, anon;
revoke all on function public.claim_merge(text) from public, anon;
revoke all on function public.leave_trip(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.make_merge_token() to authenticated;
grant execute on function public.claim_merge(text) to authenticated;
grant execute on function public.leave_trip(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- 5) Directors may delete their tournament's uploaded photos/videos (used by "Delete tournament" before the row goes)
drop policy if exists "bracketly media director delete" on storage.objects;
create policy "bracketly media director delete" on storage.objects for delete to authenticated
  using (bucket_id in ('bracketly-media', 'trip-images')
    and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
             then public.is_admin(((storage.foldername(name))[1])::uuid) else false end);
