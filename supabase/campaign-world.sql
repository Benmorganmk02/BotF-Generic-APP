-- The campaign type (its world: Aetherastra, Malconia...), picked by the GM when the campaign is made. Run this once in
-- the Supabase SQL editor (it is safe to run again). The existing policies already cover it.
alter table public.campaigns
  add column if not exists world text;
