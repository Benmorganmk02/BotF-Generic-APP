import { useChar } from '../../context/CharacterContext';
import { SkillKey, SKILL_LABELS, ATTRIBUTE_INFO, SKILL_TO_ATTR } from '../../types/character';
import { getStatChangeCost, getAvailSkillPts, calcCostToLevel, effAttr, effSkill } from '../../utils/mechanics';
import StatModifier from './StatModifier';
import RollButton from '../dice/RollButton';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

const MAX_SKILL = 5; const MIN_SKILL = -3;

/** Returns 0 (normal), 1 (5+), 2 (6 only), or 'auto-fail' based on combined attr+skill value */
function getSkillDisadvLevel(combined: number): 0 | 1 | 2 | 'auto-fail' {
  if (combined <= -5) return 'auto-fail';
  if (combined <= -3) return 2;
  if (combined <= -1) return 1;
  return 0;
}

export default function SkillCard({ skillKey }: { skillKey: SkillKey }) {
  const { character: c, setCharacter } = useChar();
  const label = SKILL_LABELS[skillKey];
  const attrKey = SKILL_TO_ATTR[skillKey];
  const attrAbbr = ATTRIBUTE_INFO[attrKey].abbr;
  const base = c.skills[skillKey];
  const mod = c.modifiers.skills[skillKey];
  const effA = effAttr(c, attrKey);
  const effS = effSkill(c, skillKey);
  const combined = effA + effS; // raw combined, before adding the base 3
  const diceCount = Math.max(3, 3 + combined); // never below 3d6
  const disadvLvl = getSkillDisadvLevel(combined);
  const isAutoFail = disadvLvl === 'auto-fail';
  const isGM = c.characterType === 'gm';
  const avail = getAvailSkillPts(c);
  const incCost = getStatChangeCost(base, 1);
  const canInc = base < MAX_SKILL && (isGM || avail >= incCost);
  const canDec = base > MIN_SKILL;

  const update = (v: number) => setCharacter(p => ({ ...p, skills: { ...p.skills, [skillKey]: v } }));
  const setMod = (v: number) => setCharacter(p => ({ ...p, modifiers: { ...p.modifiers, skills: { ...p.modifiers.skills, [skillKey]: v } } }));
  const totalSpent = calcCostToLevel(Math.abs(base));
  const sign = (n: number) => n >= 0 ? `+${n}` : `${n}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-2.5 py-1.5 bg-muted/50 border-b border-border flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{attrAbbr}</span>
      </div>
      <div className="p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => update(base + 1)} disabled={!canInc}><ChevronUp className="h-3 w-3" /></Button>
            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => update(base - 1)} disabled={!canDec}><ChevronDown className="h-3 w-3" /></Button>
          </div>
          <div className="text-2xl font-bold text-foreground min-w-[2.5rem] text-center">{base >= 0 ? `+${base}` : base}</div>
          <div className="ml-auto text-right">
            {isAutoFail ? (
              <div>
                <div className="text-sm font-bold text-destructive">AUTO-FAIL</div>
                <div className="text-xs text-muted-foreground">3d6 · −5 or worse</div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-sm font-semibold text-foreground">{diceCount}d6</span>
                  {disadvLvl > 0 && (
                    <span className="text-xs font-medium text-destructive">Dis{disadvLvl}</span>
                  )}
                  <RollButton
                    label={label}
                    diceCount={diceCount}
                    size="sm"
                    inherentDisadvLvl={disadvLvl as number}
                    extras={{ inherentDisadvLvl: disadvLvl as number }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">3 {sign(effA)} {sign(effS)}</div>
              </>
            )}
            {!isGM && <div className="text-xs text-muted-foreground">Cost: {totalSpent}</div>}
          </div>
        </div>
        <StatModifier value={mod} onChange={setMod} label="Mod" />
      </div>
    </div>
  );
}
