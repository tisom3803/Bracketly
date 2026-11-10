-- Bracketly v6 (2.8.0): challenge ladder guard + USTA # / ratings on player cards.
-- Additive only: new nullable columns, new check constraints on those columns, two guard triggers. No existing data changes.

-- ---------- player cards: USTA # and ratings ----------
alter table public.player_cards
  add column if not exists usta text,
  add column if not exists ntrp numeric(2,1),
  add column if not exists ntrp_type text,
  add column if not exists wtn_s numeric(3,1),
  add column if not exists wtn_d numeric(3,1),
  add column if not exists utr numeric(4,2),
  add column if not exists verified jsonb not null default '{}'::jsonb;

alter table public.player_cards
  add constraint player_cards_usta_check check (usta is null or usta ~ '^[0-9]{1,15}$'),
  add constraint player_cards_ntrp_check check (ntrp is null or (ntrp >= 1 and ntrp <= 7)),
  add constraint player_cards_ntrp_type_check check (ntrp_type is null or ntrp_type in ('C','S','A','T','M','D')),
  add constraint player_cards_wtn_s_check check (wtn_s is null or (wtn_s >= 1 and wtn_s <= 40)),
  add constraint player_cards_wtn_d_check check (wtn_d is null or (wtn_d >= 1 and wtn_d <= 40)),
  add constraint player_cards_utr_check check (utr is null or (utr >= 1 and utr <= 16.5)),
  add constraint player_cards_verified_check check (jsonb_typeof(verified) = 'object' and pg_column_size(verified) < 2000);

-- Only a director can mark a rating verified. Changing a rating clears its check.
-- When the director turns off "players edit their own card", players can't change their ratings either.
create or replace function public.cards_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm boolean := is_admin(NEW.trip_id);
  selfok boolean;
  ov jsonb := '{}'::jsonb;
  nv jsonb := coalesce(NEW.verified, '{}'::jsonb);
  k text; newv numeric; oldv numeric;
begin
  -- An upsert of an existing card: let the UPDATE pass (which sees OLD) do the work
  if TG_OP = 'INSERT' and exists (select 1 from player_cards where trip_id = NEW.trip_id and player_id = NEW.player_id) then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' then ov := coalesce(OLD.verified, '{}'::jsonb); end if;
  if jsonb_typeof(nv) <> 'object' then nv := '{}'::jsonb; end if;
  if not adm then
    select coalesce(value->'brand'->'cards'->>'self', 'true') <> 'false' into selfok from trip_kv where trip_id = NEW.trip_id and key = 'config';
    if not coalesce(selfok, true) then
      if TG_OP = 'UPDATE' then
        NEW.usta := OLD.usta; NEW.ntrp := OLD.ntrp; NEW.ntrp_type := OLD.ntrp_type; NEW.wtn_s := OLD.wtn_s; NEW.wtn_d := OLD.wtn_d; NEW.utr := OLD.utr;
      else
        NEW.usta := null; NEW.ntrp := null; NEW.ntrp_type := null; NEW.wtn_s := null; NEW.wtn_d := null; NEW.utr := null;
      end if;
    end if;
    nv := ov;   -- players can't add, change or remove a verification
  end if;
  foreach k in array array['ntrp', 'wtn_s', 'wtn_d', 'utr'] loop
    newv := case k when 'ntrp' then NEW.ntrp when 'wtn_s' then NEW.wtn_s when 'wtn_d' then NEW.wtn_d else NEW.utr end;
    oldv := case when TG_OP = 'UPDATE' then (case k when 'ntrp' then OLD.ntrp when 'wtn_s' then OLD.wtn_s when 'wtn_d' then OLD.wtn_d else OLD.utr end) end;
    if not (nv ? k) then continue; end if;
    if newv is null then nv := nv - k;
    elsif TG_OP = 'UPDATE' and newv is distinct from oldv and (not adm or (ov->k) is not distinct from (nv->k)) then nv := nv - k;   -- value changed, not re-verified
    elsif adm and (ov->k) is distinct from (nv->k) then nv := jsonb_set(nv, array[k], jsonb_build_object('by', auth.uid(), 'at', now()));  -- stamp who and when
    end if;
  end loop;
  NEW.verified := coalesce((select jsonb_object_agg(key, value) from jsonb_each(nv) where key in ('ntrp', 'wtn_s', 'wtn_d', 'utr')), '{}'::jsonb);
  NEW.updated_by := auth.uid();
  return NEW;
end $$;
revoke all on function public.cards_guard() from public, anon, authenticated;

drop trigger if exists cards_guard on public.player_cards;
create trigger cards_guard before insert or update on public.player_cards for each row execute function public.cards_guard();

-- ---------- ladder challenges: lc:<eventId>:<challengeId> in trip_kv ----------
create or replace function public.lc_side(team text, pid text) returns boolean
language sql immutable set search_path = public as $$
  select pid is not null and pid = any(string_to_array(regexp_replace(coalesce(team, ''), '^T', ''), '.'));
$$;

create or replace function public.lc_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n jsonb; o jsonb; pid text;
  deny constant text := 'Only the players in this ladder challenge (or a director) can change it';
  newly constant text[] := array['accepted', 'declined', 'postponed', 'cancelled', 'confirmed'];
  f text;
begin
  if TG_OP = 'DELETE' then
    -- deleting the whole tournament cascades here (nested trigger): allow that
    if OLD.key like 'lc:%' and pg_trigger_depth() <= 1 and not is_admin(OLD.trip_id) then raise exception 'Only a director can delete a ladder challenge' using errcode = '42501'; end if;
    return OLD;
  end if;
  if NEW.key not like 'lc:%' or is_admin(NEW.trip_id) then return NEW; end if;
  if TG_OP = 'INSERT' and exists (select 1 from trip_kv where trip_id = NEW.trip_id and key = NEW.key) then return NEW; end if;  -- upsert: the UPDATE pass checks it
  n := NEW.value;
  if n is null or jsonb_typeof(n) <> 'object' or pg_column_size(n) > 20000 then raise exception 'Bad ladder challenge' using errcode = '42501'; end if;
  if NEW.key <> 'lc:' || coalesce(n->>'ev', '') || ':' || coalesce(n->>'id', '') then raise exception 'Bad ladder challenge key' using errcode = '42501'; end if;
  select player_id into pid from trip_members where trip_id = NEW.trip_id and user_id = auth.uid();
  if pid is null or not (coalesce(n->'pids', '[]'::jsonb) ? pid) then raise exception '%', deny using errcode = '42501'; end if;
  -- only directors record walkovers, reverse results or confirm as director
  if TG_OP = 'INSERT' then
    if not lc_side(n->>'a', pid) then raise exception 'You can only send a challenge from your own spot' using errcode = '42501'; end if;
    if coalesce(n->'walkover', 'null'::jsonb) <> 'null'::jsonb or coalesce(n->'reversed', 'null'::jsonb) <> 'null'::jsonb or coalesce(n->'confirmed', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(n->'accepted', 'null'::jsonb) <> 'null'::jsonb or coalesce(n->'report', 'null'::jsonb) <> 'null'::jsonb then
      raise exception 'A new challenge starts empty' using errcode = '42501';
    end if;
    -- the pids list must be exactly the two sides
    if (select count(*) from jsonb_array_elements_text(n->'pids') x where not (lc_side(n->>'a', x) or lc_side(n->>'b', x))) > 0 then raise exception 'Bad ladder challenge' using errcode = '42501'; end if;
    return NEW;
  end if;
  o := OLD.value;
  if o is null or not (coalesce(o->'pids', '[]'::jsonb) ? pid) then raise exception '%', deny using errcode = '42501'; end if;
  if (n->'a') is distinct from (o->'a') or (n->'b') is distinct from (o->'b') or (n->'pids') is distinct from (o->'pids')
     or (n->'ev') is distinct from (o->'ev') or (n->'id') is distinct from (o->'id') or (n->'created') is distinct from (o->'created') then
    raise exception 'Who is in a challenge can''t be changed' using errcode = '42501';
  end if;
  if (n->'walkover') is distinct from (o->'walkover') or (n->'reversed') is distinct from (o->'reversed') then
    raise exception 'Only a director can record a walkover or reverse a result' using errcode = '42501';
  end if;
  if (n->'confirmed') is distinct from (o->'confirmed') and coalesce(n->'confirmed'->>'dir', 'false') = 'true' then
    raise exception 'Only a director can confirm as director' using errcode = '42501';
  end if;
  if (n->'cancelled') is distinct from (o->'cancelled') and coalesce(n->'cancelled'->>'dir', 'false') = 'true' then
    raise exception 'Only a director can cancel for both players' using errcode = '42501';
  end if;
  -- who may do what: the defender answers, the challenger withdraws, the other side confirms a score, a reporter is themselves
  foreach f in array newly loop
    if coalesce(n->f, 'null'::jsonb) <> 'null'::jsonb and (n->f) is distinct from (o->f) then
      if f in ('accepted', 'declined', 'postponed') and not lc_side(n->>'b', pid) then
        raise exception 'Only the player who was challenged can answer' using errcode = '42501';
      elsif f = 'cancelled' and not lc_side(n->>'a', pid) then
        raise exception 'Only the challenger can withdraw' using errcode = '42501';
      elsif f = 'confirmed' and (n->'report'->>'by') is not null and
            ((lc_side(n->>'a', pid) and lc_side(n->>'a', n->'report'->>'by')) or (lc_side(n->>'b', pid) and lc_side(n->>'b', n->'report'->>'by'))) then
        raise exception 'The other side confirms a score' using errcode = '42501';
      end if;
    end if;
  end loop;
  if coalesce(n->'report', 'null'::jsonb) <> 'null'::jsonb and (n->'report') is distinct from (o->'report') and (n->'report'->>'by') is distinct from pid then
    raise exception 'Report a score as yourself' using errcode = '42501';
  end if;
  return NEW;
end $$;
revoke all on function public.lc_guard() from public, anon, authenticated;

drop trigger if exists lc_guard on public.trip_kv;
create trigger lc_guard before insert or update or delete on public.trip_kv for each row execute function public.lc_guard();
