import { useChar } from '../../context/CharacterContext';
import { AttributeKey, ATTRIBUTE_INFO } from '../../types/character';
import { getStatChangeCost, getAvailAttrPts, calcCostToLevel, effAttr } from '../../utils/mechanics';
import StatModifier from './StatModifier';
import RollButton from '../dice/RollButton';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

const MAX_ATTR = 8; const MIN_ATTR = -3;

export default function AttributeCard({ attrKey }: { attrKey: AttributeKey }) {
  const { character: c, setCharacter } = useChar();
  const { full, abbr } = ATTRIBUTE_INFO[attrKey];
  const base = c.attributes[attrKey];
  const mod = c.modifiers.attributes[attrKey];
  const eff = effAttr(c, attrKey);
  const isGM = c.characterType === 'gm';
  const avail = getAvailAttrPts(c);
  const incCost = getStatChangeCost(base, 1);
  const canInc = base < MAX_ATTR && (isGM || avail >= incCost);
  const canDec = base > MIN_ATTR;
  const rollDice = Math.max(1, 3 + eff);

  const update = (v: number) => setCharacter(p => ({ ...p, attributes: { ...p.attributes, [attrKey]: v } }));
  const setMod = (v: number) => setCharacter(p => ({ ...p, modifiers: { ...p.modifiers, attributes: { ...p.modifiers.attributes, [attrKey]: v } } }));
  const diceStr = eff > 0 ? `+${eff}d6` : eff < 0 ? `${eff}d6` : '—';
  const totalSpent = calcCostToLevel(Math.abs(base));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-primary/15 border-b border-border flex justify-between items-center">
        <span className="font-bold text-primary">{abbr}</span>
        <div className="flex items-center gap-1.5">
          {attrKey === 'str' && c.berzerkActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
              Berzerk ×2
            </span>
          )}
          <span className="text-xs text-muted-foreground">{full}</span>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-center min-w-[3rem]">
            <div className="text-3xl font-bold text-foreground">{base >= 0 ? `+${base}` : base}</div>
            {mod !== 0 && <div className="text-xs text-teal-400">Mod {mod >= 0 ? '+' : ''}{mod}</div>}
          </div>
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => update(base + 1)} disabled={!canInc}><ChevronUp className="h-3 w-3" /></Button>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => update(base - 1)} disabled={!canDec}><ChevronDown className="h-3 w-3" /></Button>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-base font-semibold text-foreground">{diceStr}</span>
              <RollButton label={`${full} Check`} diceCount={rollDice} size="sm" />
            </div>
            <div className="text-xs text-muted-foreground">3 + eff({eff >= 0 ? `+${eff}` : eff})</div>
            {!isGM && <>
              <div className="text-xs text-muted-foreground">{base < 0 ? `Refund: ${totalSpent}` : `Cost: ${totalSpent}`}</div>
              <div className="text-xs text-muted-foreground">Next: {base < MAX_ATTR ? incCost : '—'}</div>
            </>}
          </div>
        </div>
        <StatModifier value={mod} onChange={setMod} label="Modifier (Species/BG)" />
      </div>
    </div>
  );
}
