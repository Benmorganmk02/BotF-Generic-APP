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

