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
-- ever changes the x/y of a player-character token whose character belongs to the caller, inside a running combat.
create or replace function public.move_battle_token(p_campaign uuid, p_token text, p_x int, p_y int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b jsonb;
  v_cols int;
  v_rows int;
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
    raise exception 'There is no combat running.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(b -> 'tokens') t where t ->> 'id' = p_token and t ->> 'kind' = 'pc'
  ) then
    raise exception 'That token is not on the map.';
  end if;

  v_cols := coalesce((b ->> 'cols')::int, 24);
  v_rows := coalesce((b ->> 'rows')::int, 16);

  update public.campaigns
  set battle = jsonb_set(b, '{tokens}', coalesce((
    select jsonb_agg(
      case when t ->> 'id' = p_token
        then t || jsonb_build_object('x', greatest(0, least(v_cols - 2, p_x)), 'y', greatest(0, least(v_rows - 2, p_y)))
        else t end)
    from jsonb_array_elements(b -> 'tokens') t
  ), '[]'::jsonb))
  where id = p_campaign;
end;
$$;

revoke all on function public.move_battle_token(uuid, text, int, int) from public;
revoke all on function public.move_battle_token(uuid, text, int, int) from anon;
grant execute on function public.move_battle_token(uuid, text, int, int) to authenticated;
