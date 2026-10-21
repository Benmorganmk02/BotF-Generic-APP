import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createDefaultCharacter } from '../utils/defaults';
import { Character } from '../types/character';
import { WORLDS, getWorld, raceAllowed, backgroundAllowed } from '../data/worlds';

interface Props { open: boolean; onClose: () => void; onCreate: (char: Character) => void; }

type Mode = 'archetype' | 'custom';
const DEFAULT_WORLD = WORLDS[0].id;

export default function CreateCharacterDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [player, setPlayer] = useState('');
  const [type, setType] = useState<'normal' | 'gm'>('normal');
  const [worldId, setWorldId] = useState(DEFAULT_WORLD);
  const [mode, setMode] = useState<Mode>('archetype');
  const [archetypeId, setArchetypeId] = useState('');
  const [raceId, setRaceId] = useState('');
  const [backgroundId, setBackgroundId] = useState('');

  const world = getWorld(worldId)!;
  const hasContent = world.races.length > 0 || world.backgrounds.length > 0;
  const archetype = world.archetypes.find(a => a.id === archetypeId);

  // Archetype heroes only see what crosses over with their archetype and race;
  // custom heroes can be any race with any background.
  const races = !archetype ? [] : mode === 'custom' ? world.races : world.races.filter(r => raceAllowed(archetype, r));
  const race = races.find(r => r.id === raceId);
  const backgrounds = !archetype || !race ? []
    : mode === 'custom' ? world.backgrounds : world.backgrounds.filter(b => backgroundAllowed(b, archetype, race));
  const background = backgrounds.find(b => b.id === backgroundId);

  const reset = () => {
    setName(''); setPlayer(''); setType('normal'); setWorldId(DEFAULT_WORLD);
    setMode('archetype'); setArchetypeId(''); setRaceId(''); setBackgroundId('');
  };
  const clearPicks = () => { setArchetypeId(''); setRaceId(''); setBackgroundId(''); };

  const changeWorld = (id: string) => { setWorldId(id); clearPicks(); };
  const changeMode = (m: Mode) => { setMode(m); setRaceId(''); setBackgroundId(''); };
  const changeArchetype = (id: string) => { setArchetypeId(id); setRaceId(''); setBackgroundId(''); };
  const changeRace = (id: string) => { setRaceId(id); setBackgroundId(''); };

  const complete = !hasContent || (
    !!archetype
    && (races.length === 0 || !!race)
    && (backgrounds.length === 0 || !!background)
  );

  const handleCreate = () => {
    if (!complete) return;
    const char = createDefaultCharacter(type, name.trim() || 'New Character', player.trim(), {
      world: world.id,
      archetype: archetype?.name,
      race: race?.name,
      background: background?.name,
    });
    onCreate(char);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create New Character</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Character Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter character name..." autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Player Name</Label>
            <Input value={player} onChange={e => setPlayer(e.target.value)} placeholder="Your name..." />
          </div>
          <div className="space-y-1">
            <Label>Character Type</Label>
            <Select value={type} onValueChange={v => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal — Standard point-buy</SelectItem>
                <SelectItem value="gm">GM/NPC — Infinite points, no restrictions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>World</Label>
            <Select value={worldId} onValueChange={changeWorld}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORLDS.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}{w.races.length === 0 && w.backgrounds.length === 0 ? ' — no races or backgrounds yet' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasContent ? (
            <>
              <div className="space-y-1">
                <Label>Build</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={mode === 'archetype' ? 'default' : 'outline'} onClick={() => changeMode('archetype')}>Archetype</Button>
                  <Button type="button" variant={mode === 'custom' ? 'default' : 'outline'} onClick={() => changeMode('custom')}>Custom</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === 'archetype'
                    ? 'Your archetype limits which races and backgrounds fit it.'
                    : 'Any archetype with any race and any background. The archetype you choose still gives its small benefit.'}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Archetype</Label>
                <Select value={archetypeId} onValueChange={changeArchetype}>
                  <SelectTrigger><SelectValue placeholder="Choose an archetype..." /></SelectTrigger>
                  <SelectContent>
                    {world.archetypes.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {archetype?.guideline && <p className="text-xs text-muted-foreground">{archetype.guideline}</p>}
              </div>

              {archetype && (
                <div className="space-y-1">
                  <Label>Race</Label>
                  <Select value={raceId} onValueChange={changeRace}>
                    <SelectTrigger><SelectValue placeholder="Choose a race..." /></SelectTrigger>
                    <SelectContent>
                      {races.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.tag ? ` — ${r.tag}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {archetype && race && (
                <div className="space-y-1">
                  <Label>Background</Label>
                  <Select value={backgroundId} onValueChange={setBackgroundId}>
                    <SelectTrigger><SelectValue placeholder="Choose a background..." /></SelectTrigger>
                    <SelectContent>
                      {backgrounds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {backgrounds.length === 0 && (
                    <p className="text-xs text-muted-foreground">No backgrounds fit this archetype and race yet.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {world.name} has no races or backgrounds yet. You can still create a character here and fill in the details by hand.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!complete}>Create Character</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
