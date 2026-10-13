import { useState } from 'react';
import type { Proficiency, Weapon } from '../../types/character';
import RollButton from '../dice/RollButton';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';
import { useDiceRoll } from '../../context/DiceRollContext';
import { useCombat } from '../../context/CombatContext';
import OpponentCounter from './OpponentCounter';
import {
  getSwordProfDef, getSwordBonusTotals, getSwordBonusDice, getExtraOpponentsCounted, MAX_SWORD_PROF_LEVEL,
} from '../../utils/swordData';

interface Props {
  weapon: Weapon;
  prof: Proficiency;
  profDice: number;
  weaponMod: number;
  grip: string;
}

/** A sword's attack line: proficiency dice + weapon modifier + the proficiency's
 * stacked level bonuses for the current situation (grip, how many opponents,
 * flanked). Shared by the weapon card and the proficiency card so both roll
 * the same number of dice. */
export default function SwordAttackRow({ weapon, prof, profDice, weaponMod, grip }: Props) {
  const { rollCombined } = useDiceRoll();
  const def = getSwordProfDef(weapon.swordProfKey ?? prof.swordKey);
  const totals = getSwordBonusTotals(def, prof.level);
  const { opponents } = useCombat();
  const [flanked, setFlanked] = useState(false);

  const bonus = getSwordBonusDice(totals, { twoHanded: grip === '2h', opponents });
  const total = profDice + weaponMod + bonus;
  const advLevels = flanked ? totals.flankedAdvantage : 0;
  const countedOpponents = getExtraOpponentsCounted(totals, opponents);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Atk: </span>
          <span className="font-bold text-foreground">{total}d6</span>
          {advLevels > 0 && <span className="text-primary ml-1.5">+{advLevels} Advantage</span>}
        </div>
        <RollButton
          label={`${weapon.name} Attack (${prof.name})`}
          diceCount={total}
          size="sm"
          inherentDisadvLvl={-advLevels}
        />
      </div>
      <div className="text-[11px] text-muted-foreground font-mono">
        Prof({profDice}d6) + Weapon(+{weaponMod}d6) + {def?.name ?? 'Sword'} Lv{Math.min(prof.level, MAX_SWORD_PROF_LEVEL)}(+{bonus}d6)
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <OpponentCounter />
        {totals.flankedAdvantage > 0 && (
          <button onClick={() => setFlanked(f => !f)}
            className={`px-1.5 py-0.5 rounded-md border border-border text-[10px] font-semibold transition-colors ${flanked ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
            Flanked by 2 allies
          </button>
        )}
      </div>
      {totals.diceMulti > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {countedOpponents > 0
            ? `+${totals.diceMulti}d6 × ${countedOpponents} extra opponent${countedOpponents === 1 ? '' : 's'} = +${totals.diceMulti * countedOpponents}d6${totals.multiTargetMax && opponents > totals.multiTargetMax ? ` (capped at ${totals.multiTargetMax} opponents total; more earn nothing extra)` : ''}`
            : `Each extra opponent adds +${totals.diceMulti}d6${totals.multiTargetMax ? ` (up to ${totals.multiTargetMax} opponents total)` : ''}`}
        </p>
      )}
      {totals.defenseAdvantageDice > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
            onClick={() => rollCombined(
              `${weapon.name} — Offense + Defense`,
              total,
              Math.min(totals.defenseAdvantageDice, total),
            )}>
            <Dices className="h-3 w-3" />Offense + Defense
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Advantage on {totals.defenseAdvantageDice} defense {totals.defenseAdvantageDice === 1 ? 'die' : 'dice'}
          </span>
        </div>
      )}
      {totals.challenge > 0 && (
        <p className="text-[11px] text-muted-foreground">
          +{totals.challenge} automatic defense success{totals.challenge === 1 ? '' : 'es'} (Challenge to Hit) — track this yourself; it applies automatically in dueling.
        </p>
      )}
    </div>
  );
}
