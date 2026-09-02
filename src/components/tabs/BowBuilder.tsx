import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BOW_STYLES, BOW_DRAW_WEIGHTS, getBowMultiplier, getBowDie } from '../../utils/rangedData';
import type { BowStyle, BowDrawWeight } from '../../utils/rangedData';
import type { Bow } from '../../types/character';
import { genId } from '../../utils/defaults';

interface Props {
  onSave: (bow: Bow) => void;
  onCancel?: () => void;
  initialBow?: Bow;
}

export default function BowBuilder({ onSave, onCancel, initialBow }: Props) {
  const [name, setName] = useState(initialBow?.name ?? '');
  const [style, setStyle] = useState<BowStyle>(initialBow?.style ?? 'longbow');
  const [drawWeight, setDrawWeight] = useState<BowDrawWeight>(initialBow?.drawWeight ?? 'hunting');

  const mult = getBowMultiplier(style, drawWeight);
  const die = getBowDie(drawWeight);
  const wData = BOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!;
  const sData = BOW_STYLES.find(s => s.id === style)!;

  const handleSave = () => {
    if (!name.trim()) return;
    const bow: Bow = {
      id: initialBow?.id ?? genId(),
      name: name.trim(), style, drawWeight,
      linkedProficiencyId: initialBow?.linkedProficiencyId,
    };
    onSave(bow);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialBow ? 'Edit Bow' : 'New Bow'}
      </span>

      <Input value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Bow name..." className="h-8" />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Style</p>
          <Select value={style} onValueChange={v => setStyle(v as BowStyle)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOW_STYLES.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}{s.multBonus > 0 ? ` (+${s.multBonus}×)` : ' (base)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Draw Weight</p>
          <Select value={drawWeight} onValueChange={v => setDrawWeight(v as BowDrawWeight)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOW_DRAW_WEIGHTS.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.label} ({d.lbs})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs space-y-0.5 flex-1">
            <div>
              <span className="text-muted-foreground">Damage: </span>
              <span className="font-semibold text-foreground">{die} × {mult}×</span>
              <span className="text-muted-foreground ml-1.5 text-[10px]">
                (1× + {sData.multBonus}× {sData.label} + {wData.multBonus}× {wData.label})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Min STR: </span>
              <span className="font-semibold text-foreground">{wData.minStr}</span>
              <span className="text-muted-foreground ml-3">Wpn Bonus: </span>
              <span className="font-semibold text-primary">+{wData.weaponBonus}</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {onCancel && <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={onCancel}>Cancel</Button>}
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={!name.trim()}>
              {initialBow ? 'Save Changes' : 'Create Bow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
