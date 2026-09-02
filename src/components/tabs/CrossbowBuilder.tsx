import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CROSSBOW_DRAW_WEIGHTS, getCrossbowMultiplier, getCrossbowDie } from '../../utils/rangedData';
import type { CrossbowDrawWeight } from '../../utils/rangedData';
import type { Crossbow } from '../../types/character';
import { genId } from '../../utils/defaults';

interface Props {
  onSave: (xbow: Crossbow) => void;
  onCancel?: () => void;
  initialCrossbow?: Crossbow;
}

export default function CrossbowBuilder({ onSave, onCancel, initialCrossbow }: Props) {
  const [name, setName] = useState(initialCrossbow?.name ?? '');
  const [drawWeight, setDrawWeight] = useState<CrossbowDrawWeight>(initialCrossbow?.drawWeight ?? 'hunting');

  const xbData = CROSSBOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!;
  const mult = getCrossbowMultiplier(drawWeight);
  const die = getCrossbowDie(drawWeight);

  const handleSave = () => {
    if (!name.trim()) return;
    const xbow: Crossbow = {
      id: initialCrossbow?.id ?? genId(),
      name: name.trim(), drawWeight,
      linkedProficiencyId: initialCrossbow?.linkedProficiencyId,
    };
    onSave(xbow);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialCrossbow ? 'Edit Crossbow' : 'New Crossbow'}
      </span>

      <Input value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Crossbow name..." className="h-8" />

      <div>
        <p className="text-xs text-muted-foreground mb-1">Draw Weight</p>
        <Select value={drawWeight} onValueChange={v => setDrawWeight(v as CrossbowDrawWeight)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CROSSBOW_DRAW_WEIGHTS.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {d.label} — {d.lbs} ({d.mechanism === 'windlass' ? 'W' : 'L'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs space-y-0.5 flex-1">
            <div>
              <span className="text-muted-foreground">Damage: </span>
              <span className="font-semibold text-foreground">{die} × {mult}×</span>
              <span className="text-muted-foreground ml-1.5 text-[10px]">(1× + {xbData.multBonus}× {xbData.label})</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-muted-foreground">Wpn Bonus: </span>
                <span className="font-semibold text-primary">+{xbData.weaponBonus}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] py-0">
                  {xbData.mechanism === 'windlass' ? 'Windlass (W)' : 'Lever (L)'}
                </Badge>
                <span className="text-muted-foreground text-[10px]">Reload: {xbData.reloadCost}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {onCancel && <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={onCancel}>Cancel</Button>}
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={!name.trim()}>
              {initialCrossbow ? 'Save Changes' : 'Create Crossbow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
