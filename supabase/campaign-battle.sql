-- The campaign's battle map: one shared state (is combat running, and where each token stands), written by the
-- GM and read by everyone in the campaign. Run this once in the Supabase SQL editor (it is safe to run again).
-- The GM already has full access to their campaign and invited players can read it; players move their own tokens
-- through the function at the bottom.
alter table public.campaigns
  add column if not exists battle jsonb;

-- Live updates, like the duels: the campaign row is broadcast over Realtime when it changes, so players see combat
-- start and the tokens move the moment the GM does it, without refreshing.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaigns'
  ) then
    alter publication supabase_realtime add table public.campaigns;
  end if;
end;
$$;

-- Players move their own token. A player cannot write to the campaign row, so this function does it for them: it only
-- ever changes the x/y of a player-character token whose character belongs to the caller, inside a running combat, and a character walks 10 m per turn.
drop function if exists public.move_battle_token(uuid, text, int, int);

create or replace function public.move_battle_token(p_campaign uuid, p_token text, p_x int, p_y int, p_cost int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b jsonb;
  tok jsonb;
  v_cols int;
  v_rows int;
  v_x int;
  v_y int;
  v_moved int;
  v_cost int;
  v_combat boolean;
begin
  if uid is null then
    raise exception 'You are not signed in.';
  end if;
  if not exists (
    select 1 from public.campaign_characters cc
    where cc.id::text = p_token and cc.campaign = p_campaign and cc.player = uid
  ) then
    raise exception 'You can only move your own token.';
  end if;

  select c.battle into b from public.campaigns c where c.id = p_campaign for update;
  if b is null or coalesce((b ->> 'active')::boolean, false) is not true then
    raise exception 'The map is not open.';
  end if;
  select t into tok from jsonb_array_elements(b -> 'tokens') t where t ->> 'id' = p_token and t ->> 'kind' = 'pc' limit 1;
  if tok is null then
    raise exception 'That token is not on the map.';
  end if;

  v_cols := coalesce((b ->> 'cols')::int, 24);
  v_rows := coalesce((b ->> 'rows')::int, 16);
  v_x := greatest(0, least(v_cols - 2, p_x));
  v_y := greatest(0, least(v_rows - 2, p_y));

  -- While combat is running a character walks 10 m per turn (the cost is the metres walked, at least the straight-line
  -- distance). With the map open and no combat, movement is free.
  v_combat := coalesce((b ->> 'combat')::boolean, true);
  v_moved := coalesce((tok ->> 'moved')::int, 0);
  if v_combat then
    v_cost := greatest(coalesce(p_cost, 0), abs(v_x - (tok ->> 'x')::int), abs(v_y - (tok ->> 'y')::int));
    v_moved := v_moved + v_cost;
    if v_moved > 10 then
      raise exception 'You have no movement left this turn (10 m per turn).';
    end if;
  end if;

  update public.campaigns
  set battle = jsonb_set(b, '{tokens}', coalesce((
    select jsonb_agg(
      case when t ->> 'id' = p_token
        then t || jsonb_build_object('x', v_x, 'y', v_y, 'moved', v_moved)
        else t end)
    from jsonb_array_elements(b -> 'tokens') t
  ), '[]'::jsonb))
  where id = p_campaign;
end;
$$;

revoke all on function public.move_battle_token(uuid, text, int, int, int) from public;
revoke all on function public.move_battle_token(uuid, text, int, int, int) from anon;
grant execute on function public.move_battle_token(uuid, text, int, int, int) to authenticated;

-- A player's New Turn gives their own token its 10 m of walking back.
create or replace function public.reset_battle_movement(p_campaign uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b jsonb;
begin
  if uid is null then
    raise exception 'You are not signed in.';
  end if;
  if not exists (
    select 1 from public.campaign_characters cc
    where cc.id::text = p_token and cc.campaign = p_campaign and cc.player = uid
  ) then
    raise exception 'You can only reset your own token.';
  end if;

  select c.battle into b from public.campaigns c where c.id = p_campaign for update;
  if b is null then
    return;
  end if;

  update public.campaigns
  set battle = jsonb_set(b, '{tokens}', coalesce((
    select jsonb_agg(case when t ->> 'id' = p_token then t || jsonb_build_object('moved', 0) else t end)
    from jsonb_array_elements(b -> 'tokens') t
  ), '[]'::jsonb))
  where id = p_campaign;
end;
$$;

revoke all on function public.reset_battle_movement(uuid, text) from public;
revoke all on function public.reset_battle_movement(uuid, text) from anon;
grant execute on function public.reset_battle_movement(uuid, text) to authenticated;
