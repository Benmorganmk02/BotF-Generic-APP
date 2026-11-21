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
