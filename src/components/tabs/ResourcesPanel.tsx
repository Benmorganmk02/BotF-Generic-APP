import { useChar } from '../../context/CharacterContext';
import BoxTracker from '../sheet/BoxTracker';
import { useEffect } from 'react';
import { getStaminaMax, getManaMax, getHPMax } from '../../utils/mechanics';
import { manaPoolFormula, magicRollFormula } from '../../utils/magic';
import { Input } from '@/components/ui/input';
import BerzerkPanel from '../sheet/BerzerkPanel';
import TurnTracker from '../sheet/TurnTracker';

export default function ResourcesPanel() {
  const { character: c, setCharacter } = useChar();
  const staminaMax = getStaminaMax(c);
  const fpMax = getManaMax(c);
  const hpMax = getHPMax(c.level);

  const setHP = (curr: number) => setCharacter(p => ({ ...p, hitPoints: { ...p.hitPoints, current: Math.min(curr, hpMax) } }));

  // The max HP formula changed (50 + 10 per level): bring older characters' stored values in line.
  useEffect(() => {
    if (c.hitPoints.max !== hpMax || c.hitPoints.current > hpMax) {
      setCharacter(p => ({ ...p, hitPoints: { current: Math.min(p.hitPoints.current, hpMax), max: hpMax } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpMax]);
  const setStamina = (curr: number) => setCharacter(p => ({ ...p, stamina: { ...p.stamina, current: curr, max: staminaMax } }));
  const setMana = (curr: number) => setCharacter(p => ({ ...p, mana: { ...p.mana, current: curr, max: fpMax } }));
  const setDP = (curr: number) => setCharacter(p => ({ ...p, destinyPoints: curr }));


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4">
      {/* Action Economy */}
      <TurnTracker variant="card" />

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Hit Points</h4>
        <div className="flex items-center gap-2">
          <Input type="number" value={c.hitPoints.current} onChange={e => setHP(+e.target.value)}
            onFocus={e => e.target.select()}
            className="w-20 text-center text-lg font-bold" />
          <span className="text-muted-foreground">/</span>
          <span className="text-lg font-bold text-foreground">{hpMax}</span>
        </div>
        <p className="text-xs text-muted-foreground">Max HP = 50 + (level × 10), up to 350 at level 30</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Stamina</h4>
        <BoxTracker current={c.stamina.current} max={staminaMax} onChange={setStamina} filledClass="bg-emerald-500" />
        <p className="text-xs text-muted-foreground">3 + STR + Endurance = {staminaMax}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Mana</h4>
        <BoxTracker current={c.mana.current} max={fpMax} onChange={setMana} filledClass="bg-blue-500" />
        <p className="text-xs text-muted-foreground">Pool: {manaPoolFormula(c)}</p>
        <p className="text-xs text-muted-foreground">Magic roll: {magicRollFormula(c)}</p>
      </div>

      {/* Berzerk toggle — only shows when ability is taken */}
      <BerzerkPanel />

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Destiny Points</h4>
        <BoxTracker current={c.destinyPoints} max={5} onChange={setDP} filledClass="bg-amber-500" />
        <p className="text-xs text-muted-foreground">
          Maximum 5. Opposite of Stamina/Mana above — filled boxes are points you{' '}
          <span className="font-medium text-foreground">have</span>, not points spent. Empty means zero, not full.
        </p>
      </div>
    </div>
  );
}
