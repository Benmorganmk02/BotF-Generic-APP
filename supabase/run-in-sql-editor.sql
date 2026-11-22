-- Campaign character visibility. Run this once in the Supabase SQL editor (it is safe to run again).
--
-- Every campaign character gets a visibility level: hidden, basic, stats or full. The GM and the character's own
-- player always see everything. Everyone else in the campaign only gets what the level allows, and only through the
-- function below, which hands back a redacted copy of the character (so the extra detail never reaches their
-- browser). The table's own row-level security is unchanged.

alter table public.campaign_characters
  add column if not exists visibility text not null default 'hidden';

alter table public.campaign_characters drop constraint if exists campaign_characters_visibility_check;
alter table public.campaign_characters
  add constraint campaign_characters_visibility_check check (visibility in ('hidden', 'basic', 'stats', 'full'));

create or replace function public.get_visible_campaign_characters(p_campaign uuid)
returns table (id uuid, character_name text, player uuid, visibility text, character_data text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (
    select 1 from public.campaigns c
    where c.id = p_campaign
      and (
        c.gm = uid
        or uid = any(c.members)
        or exists (select 1 from public.campaign_characters m where m.campaign = p_campaign and m.player = uid)
      )
  ) then
    raise exception 'You are not part of this campaign.';
  end if;

  return query
  select
    cc.id,
    cc.character_name,
    cc.player,
    cc.visibility,
    case cc.visibility
      when 'full' then cc.character_data
      when 'stats' then jsonb_build_object(
        'id', j.d -> 'id', 'name', j.d -> 'name', 'player', j.d -> 'player', 'race', j.d -> 'race',
        'level', j.d -> 'level', 'characterType', j.d -> 'characterType', 'world', j.d -> 'world',
        'archetype', j.d -> 'archetype', 'background', j.d -> 'background', 'bodyType', j.d -> 'bodyType', 'age', j.d -> 'age',
        'attributes', j.d -> 'attributes', 'skills', j.d -> 'skills', 'hitPoints', j.d -> 'hitPoints',
        'stamina', j.d -> 'stamina', 'mana', j.d -> 'mana', 'destinyPoints', j.d -> 'destinyPoints',
        'proficiencies', j.d -> 'proficiencies', 'abilities', j.d -> 'abilities', 'magicSource', j.d -> 'magicSource'
      )::text
      else jsonb_build_object(
        'id', j.d -> 'id', 'name', j.d -> 'name', 'player', j.d -> 'player', 'race', j.d -> 'race',
        'level', j.d -> 'level', 'characterType', j.d -> 'characterType', 'world', j.d -> 'world',
        'archetype', j.d -> 'archetype', 'background', j.d -> 'background', 'bodyType', j.d -> 'bodyType', 'age', j.d -> 'age'
      )::text
    end
  from public.campaign_characters cc
  cross join lateral (select cc.character_data::jsonb as d) j
  where cc.campaign = p_campaign
    and cc.visibility <> 'hidden'
    and cc.player is distinct from uid;
end;
$$;

revoke all on function public.get_visible_campaign_characters(uuid) from public;
revoke all on function public.get_visible_campaign_characters(uuid) from anon;
grant execute on function public.get_visible_campaign_characters(uuid) to authenticated;
-- Lets the GM of a campaign update the master copy of a character that sits in that campaign, so that a
-- campaign copy and the character in the main menu stay the same when the GM edits it. Run this once in the
-- Supabase SQL editor (it is safe to run again).
drop policy if exists "gm can update characters in their campaigns" on public.characters;
create policy "gm can update characters in their campaigns"
  on public.characters for update
  to authenticated
  using (
    exists (
      select 1 from public.campaign_characters cc
      join public.campaigns c on c.id = cc.campaign
      where cc.original_character = characters.id and c.gm = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaign_characters cc
      join public.campaigns c on c.id = cc.campaign
      where cc.original_character = characters.id and c.gm = auth.uid()
    )
  );

-- Safety: a GM may edit the character's sheet, but only the owner can ever change who owns it.
create or replace function public.protect_character_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner is distinct from old.owner and auth.uid() is distinct from old.owner then
    raise exception 'Only the owner can change who owns a character.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_character_owner on public.characters;
create trigger protect_character_owner
  before update on public.characters
  for each row execute function public.protect_character_owner();


-- Lets the GM mark any campaign character as an NPC for that campaign (so the GM does not have to use the
-- GM/NPC character type). The mark belongs to the campaign copy, so the same character can be a player in one
-- campaign and an NPC in another. Run this once in the Supabase SQL editor (it is safe to run again).
alter table public.campaign_characters
  add column if not exists is_npc boolean not null default false;

-- The campaign's battle map: one shared state (is combat running, and where each token stands), written by the
-- GM and read by everyone in the campaign. Run this once in the Supabase SQL editor (it is safe to run again).
-- No new policy is needed: the GM already has full access to their campaign and invited players can read it.
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

-- 11. CAMPAIGN TYPE (WORLD) -----------------------------------------------------
-- The campaign type (its world: Aetherastra, Malconia...), picked by the GM when the campaign is made. Run this once in
-- the Supabase SQL editor (it is safe to run again). The existing policies already cover it.
alter table public.campaigns
  add column if not exists world text;
