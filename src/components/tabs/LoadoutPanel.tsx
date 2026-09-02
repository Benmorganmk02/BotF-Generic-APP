import { useChar } from '../../context/CharacterContext';
import { LoadoutSet } from '../../types/character';
import { Input } from '@/components/ui/input';

const LOADOUT_SLOTS: { key: keyof LoadoutSet; label: string }[] = [
  { key: 'mainHand', label: 'Main Hand' }, { key: 'offhand', label: 'Off Hand' },
  { key: 'back1', label: 'Back 1' }, { key: 'back2', label: 'Back 2' }, { key: 'back3', label: 'Back 3' },
  { key: 'hips4', label: 'Hips 4' }, { key: 'hips5', label: 'Hips 5' },
];

export default function LoadoutPanel() {
  const { character: c, setCharacter } = useChar();
  const update = (set: 'loadout1' | 'loadout2', key: keyof LoadoutSet, v: string) =>
    setCharacter(p => ({ ...p, loadout: { ...p.loadout, [set]: { ...p.loadout[set], [key]: v } } }));

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
      {(['loadout1', 'loadout2'] as const).map((set, si) => (
        <div key={set} className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">Loadout {si + 1}</h4>
          {LOADOUT_SLOTS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
              <Input value={c.loadout[set][key]} onChange={e => update(set, key, e.target.value)}
                className="h-7 text-xs flex-1" placeholder="—" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
