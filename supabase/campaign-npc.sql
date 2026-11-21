-- Lets the GM mark any campaign character as an NPC for that campaign (so the GM does not have to use the
-- GM/NPC character type). The mark belongs to the campaign copy, so the same character can be a player in one
-- campaign and an NPC in another. Run this once in the Supabase SQL editor (it is safe to run again).
alter table public.campaign_characters
  add column if not exists is_npc boolean not null default false;
