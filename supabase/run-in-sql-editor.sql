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
