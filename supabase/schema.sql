-- Generic character-sheet app — Supabase schema
-- Users / Characters / FriendRequests / Campaigns / CampaignCharacters.
-- Deliberately has no Star-Wars-specific content and no dueling tables --
-- this project is a fresh, separate Supabase project from the private
-- Star Wars app; run this once in this project's Supabase SQL Editor.

-- 1. PROFILES ----------------------------------------------------------
-- Supabase Auth already provides auth.users (id, email). We mirror the
-- fields your app needs (first/last name) into a public profiles table,
-- kept in sync automatically whenever a new user signs up.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. CHARACTERS ----------------------------------------------------------

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  character_name text not null default 'Unnamed',
  owner uuid not null references public.profiles(id) on delete cascade,
  character_type text not null default 'Normal'
    check (character_type in ('Normal', 'GM/NPC')),
  level integer not null default 0,
  character_data text not null default '{}',
  shared_with uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. FRIEND REQUESTS ------------------------------------------------------

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  receiver uuid references public.profiles(id) on delete cascade,
  receiver_email text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- 4. CAMPAIGNS ------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  gm uuid not null references public.profiles(id) on delete cascade,
  members uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 5. CAMPAIGN CHARACTERS ---------------------------------------------------
-- A per-campaign copy of a character (so GM edits during a session don't
-- overwrite the player's master copy) — mirrors Zite's originalCharacter link.

create table if not exists public.campaign_characters (
  id uuid primary key default gen_random_uuid(),
  character_name text not null default 'Unnamed',
  campaign uuid not null references public.campaigns(id) on delete cascade,
  original_character uuid references public.characters(id) on delete set null,
  player uuid not null references public.profiles(id) on delete cascade,
  character_data text not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. ROW LEVEL SECURITY -----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.friend_requests enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_characters enable row level security;

-- Profiles: anyone signed in can look up basic profile info (needed to
-- resolve friend/campaign member names); users can only edit their own row.
create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

-- Characters: owner has full access; anyone in the character's shared_with
-- list can view it.
create policy "owner has full access to their characters"
  on public.characters for all
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create policy "shared users can view characters"
  on public.characters for select
  to authenticated
  using (auth.uid() = any(shared_with));

-- Friends can view each other's characters (powers the "Characters" button
-- on the Friends tab). Nothing in the app ever populates shared_with above,
-- so without this, that view has always come back empty.
create policy "friends can view each other's characters"
  on public.characters for select
  to authenticated
  using (
    exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender = auth.uid() and fr.receiver = owner)
          or (fr.receiver = auth.uid() and fr.sender = owner))
    )
  );

-- Friend requests: sender or receiver can view; sender can create;
-- receiver can update status; either can delete.
create policy "involved users can view friend requests"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() = sender or auth.uid() = receiver);

create policy "users can send friend requests"
  on public.friend_requests for insert
  to authenticated
  with check (auth.uid() = sender);

create policy "receiver can respond to friend requests"
  on public.friend_requests for update
  to authenticated
  using (auth.uid() = receiver);

create policy "involved users can delete friend requests"
  on public.friend_requests for delete
  to authenticated
  using (auth.uid() = sender or auth.uid() = receiver);

-- Campaigns: GM has full access; members can view.
create policy "gm has full access to their campaigns"
  on public.campaigns for all
  to authenticated
  using (auth.uid() = gm)
  with check (auth.uid() = gm);

create policy "members can view their campaigns"
  on public.campaigns for select
  to authenticated
  using (auth.uid() = any(members));

-- Campaign characters: GM of the parent campaign or the assigned player
-- can view/edit.
create policy "gm or player can access campaign characters"
  on public.campaign_characters for all
  to authenticated
  using (
    auth.uid() = player
    or auth.uid() in (select gm from public.campaigns where id = campaign)
  )
  with check (
    auth.uid() = player
    or auth.uid() in (select gm from public.campaigns where id = campaign)
  );

-- 7. CAMPAIGN SYNC -----------------------------------------------------------
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

-- 8. CAMPAIGN CHARACTER VISIBILITY ---------------------------------------------
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

-- 9. CAMPAIGN NPC MARK ----------------------------------------------------------
-- Lets the GM mark any campaign character as an NPC for that campaign (so the GM does not have to use the
-- GM/NPC character type). The mark belongs to the campaign copy, so the same character can be a player in one
-- campaign and an NPC in another. Run this once in the Supabase SQL editor (it is safe to run again).
alter table public.campaign_characters
  add column if not exists is_npc boolean not null default false;

-- 10. CAMPAIGN BATTLE MAP --------------------------------------------------------
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

