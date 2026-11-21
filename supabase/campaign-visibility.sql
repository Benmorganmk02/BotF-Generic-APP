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
