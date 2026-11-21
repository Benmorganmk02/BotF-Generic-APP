import { useEffect, useRef, useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { useDiceRoll } from '../../context/DiceRollContext';
import { useCombat } from '../../context/CombatContext';
import { usePersistedState } from '../../utils/usePersistedState';
import { getMagicRollDice } from '../../utils/mechanics';
import { MAGIC_SCHOOLS } from '../../utils/magicTrees';
import { ABILITY_TREES, describeUse } from '../../utils/abilityTrees';
import type { AbilityUse } from '../../utils/abilityTrees';
import {
  INJURY_LEVELS, getArmorForLocation, getInjuries, getTotalInjuryDiceLoss, resolveHitVsArmor, applyArmorDegrade,
} from '../../utils/armorInjury';
import { INJURY_LOCATIONS, INJURY_LOCATION_LABELS } from '../../types/character';
import type { AbilityEntry, InjuryLevel, InjuryLocation } from '../../types/character';
import { SpellBuilder } from '../tabs/MagicTab';
import BerzerkPanel from '../sheet/BerzerkPanel';
import BoxTracker from '../sheet/BoxTracker';
import RollButton from '../dice/RollButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MAGIC_ROLL_LABEL = 'Magic roll';
type RealLevel = Exclude<InjuryLevel, 'none'>;

const abilityEntries = (abilities: (string | AbilityEntry)[]): AbilityEntry[] =>
  abilities.map(a => (typeof a === 'string' ? { id: a, name: a, description: '' } : a));
const isMagic = (a: AbilityEntry) => MAGIC_SCHOOLS.some(s => s.id === a.treeId);

// ── Magic: the magic roll and its pool, the spells known, and the spell builder to cast ─────────────
export function NpcMagic() {
  const { character: c, setCharacter } = useChar();
  const { currentRoll } = useDiceRoll();
  const { turnKey } = useCombat();
  // Same key as the sheet's Magic tab, so the pool is the same wherever the NPC is run from
  const [river, setRiver] = usePersistedState(`botv_river:${c.cloudId ?? c.id}`, 0);
  useEffect(() => { if (currentRoll && currentRoll.label === MAGIC_ROLL_LABEL) setRiver(currentRoll.successes); }, [currentRoll, setRiver]);
  const firstTurnKey = useRef(turnKey);
  useEffect(() => { if (turnKey !== firstTurnKey.current) setRiver(0); }, [turnKey, setRiver]);
  const [casting, setCasting] = useState(false);

  const dice = getMagicRollDice(c);
  const spells = abilityEntries(c.abilities).filter(isMagic);
  const takenIds = new Set(spells.map(a => a.treeAbilityId!).filter(Boolean));
  if (dice === 0 && spells.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No magic. Give this character a power option or spells on the full sheet.</p>;
  }
  return (
    <div className="space-y-2">
      {dice > 0 && (
        <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs"><span className="text-muted-foreground">Magic roll </span><span className="font-bold text-foreground">{dice}d6</span></span>
            <div className="flex items-center gap-1">
              {river > 0 && <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setRiver(0)}>Clear</Button>}
              <RollButton label={MAGIC_ROLL_LABEL} diceCount={dice} size="sm" />
            </div>
          </div>
          <BoxTracker current={river} max={Math.max(dice, river)} onChange={setRiver} filledClass="bg-cyan-500" />
          <p className="text-[11px] text-muted-foreground">Successes are free mana for the next spell, spent before the mana pool.</p>
        </div>
      )}
      {spells.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {spells.map(s => <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>)}
        </div>
      )}
      <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setCasting(v => !v)}>
        {casting ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}Cast a spell
      </button>
      {casting && (
        <SpellBuilder
          takenIds={takenIds}
          currentMana={c.mana.current}
          onSpendMana={cost => setCharacter(p => ({ ...p, mana: { ...p.mana, current: Math.max(0, p.mana.current - cost) } }))}
          riverMana={river}
          onRiverChange={setRiver}
        />
      )}
    </div>
  );
}

// ── Abilities: each non-magic ability with its cost and Use buttons (spend stamina and reactions) ───
export function NpcAbilities() {
  const { character: c, setCharacter } = useChar();
  const { reactionsLeft, spendReaction } = useCombat();
  const entries = abilityEntries(c.abilities).filter(a => !isMagic(a));

  const use = (name: string, u: AbilityUse) => {
    if (c.stamina.current < u.sta) { toast.error(`Not enough stamina for ${name} (needs ${u.sta} STA, ${c.name} has ${c.stamina.current}).`); return; }
    if (u.reactions > reactionsLeft) { toast.error(`Not enough reactions for ${name} (needs ${u.reactions}, ${reactionsLeft} left this turn).`); return; }
    if (u.reactions > 0) spendReaction(u.reactions);
    setCharacter(p => ({ ...p, stamina: { ...p.stamina, current: p.stamina.current - u.sta } }));
    toast.success(`${name}${u.label ? ` (${u.label})` : ''}`, { description: `${describeUse(u)} spent` });
  };

  return (
    <div className="space-y-2">
      <BerzerkPanel />
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No abilities. Add them on the full sheet.</p>
      ) : (
        <div className="rounded-md border border-border bg-muted/20 px-2.5">
          {entries.map(a => {
            const tree = ABILITY_TREES.find(t => t.id === a.treeId)?.abilities.find(x => x.id === a.treeAbilityId);
            return (
              <div key={a.id} className="flex items-center gap-x-3 gap-y-1 flex-wrap py-1.5 border-t border-border/50 first:border-t-0">
                <span className="text-xs font-semibold text-foreground min-w-[7rem] flex-1 truncate" title={tree?.summary ?? a.description}>{a.name}</span>
                {tree?.cost && <span className="text-[11px] text-muted-foreground">{tree.cost}</span>}
                {tree?.uses?.map((u, i) => (
                  <Button key={i} size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => use(a.name, u)}>
                    Use{u.label ? `: ${u.label}` : ''} · {describeUse(u)}
                  </Button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Armor: armor per location, injuries, and a one-step "apply a hit" ────────────────────────────
export function NpcArmor() {
  const { character: c, setCharacter } = useChar();
  const [loc, setLoc] = useState<InjuryLocation>('torso');
  const [succ, setSucc] = useState('');
  const [heavy, setHeavy] = useState(false);
  const diceLoss = getTotalInjuryDiceLoss(c.injuries);

  // Rebuilt from INJURY_LOCATIONS on every write, like the sheet's injuries panel
  const normalized = (inj: unknown) => Object.fromEntries(INJURY_LOCATIONS.map(l => [l, getInjuries(inj, l)])) as Record<InjuryLocation, RealLevel[]>;
  const addInjury = (l: InjuryLocation, level: RealLevel) =>
    setCharacter(p => { const n = normalized(p.injuries); return { ...p, injuries: { ...n, [l]: [...n[l], level] } }; });
  const removeInjury = (l: InjuryLocation, i: number) =>
    setCharacter(p => { const n = normalized(p.injuries); return { ...p, injuries: { ...n, [l]: n[l].filter((_, k) => k !== i) } }; });

  const applyHit = () => {
    const raw = Math.max(0, parseInt(succ) || 0);
    const res = resolveHitVsArmor(c, raw, loc, heavy);
    setCharacter(p => {
      let next = p;
      if (res.armorDegradeTarget) next = { ...next, armor: applyArmorDegrade(next, res.armorDegradeTarget) };
      if (res.injuryLevel !== 'none') { const n = normalized(next.injuries); next = { ...next, injuries: { ...n, [loc]: [...n[loc], res.injuryLevel as RealLevel] } }; }
      return next;
    });
    toast(`${INJURY_LOCATION_LABELS[loc]}: armor ${res.armorValue}`, {
      description: `${res.absorbed ? 'Fully absorbed.' : `${res.successesThrough} through: ${res.injuryLevel === 'none' ? 'no injury' : INJURY_LEVELS[res.injuryLevel as RealLevel].label}.`}${res.armorDegradeTarget ? ' Armor worn down.' : ''}`,
    });
    setSucc('');
  };

  return (
    <div className="space-y-2">
      {diceLoss > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" />-{diceLoss} dice to attacks from injuries (apply it to its attack rolls by hand)</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {INJURY_LOCATIONS.map(l => {
          const list = getInjuries(c.injuries, l);
          return (
            <div key={l} className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{INJURY_LOCATION_LABELS[l]}</span>
                <span className="text-[11px] text-muted-foreground">armor <span className="font-bold text-foreground">{getArmorForLocation(c, l)}</span></span>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[1rem]">
                {list.length === 0 ? <span className="text-[10px] text-muted-foreground italic">Uninjured</span> : list.map((level, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                    {INJURY_LEVELS[level].label}
                    <button onClick={() => removeInjury(l, i)} title="Heal this injury" className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
                  </Badge>
                ))}
              </div>
              <select value="" onChange={e => { if (e.target.value) addInjury(l, e.target.value as RealLevel); }} aria-label={`Add an injury to ${INJURY_LOCATION_LABELS[l]}`}
                className="h-6 w-full rounded-md border border-input bg-background px-1 text-[10px] text-muted-foreground">
                <option value="">+ injury</option>
                {(Object.keys(INJURY_LEVELS) as RealLevel[]).map(level => <option key={level} value={level}>{INJURY_LEVELS[level].label}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 flex-wrap rounded-md border border-border bg-muted/20 p-2">
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Hit location</label>
          <select value={loc} onChange={e => setLoc(e.target.value as InjuryLocation)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs block" aria-label="Hit location">
            {INJURY_LOCATIONS.map(l => <option key={l} value={l}>{INJURY_LOCATION_LABELS[l]}</option>)}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Successes</label>
          <Input type="number" min={0} value={succ} onChange={e => setSucc(e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="h-7 w-16 text-xs" aria-label="Hit successes" />
        </div>
        <label className="flex items-center gap-1 h-7 text-[11px] text-muted-foreground cursor-pointer" title="A heavy weapon or armor-breaker can wear down hard armor">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={heavy} onChange={e => setHeavy(e.target.checked)} />Heavy
        </label>
        <Button size="sm" className="h-7 text-xs" onClick={applyHit}>Apply hit</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Apply hit takes the successes against this location's armor, wears the armor down and records the injury. Edit the armor pieces themselves on the full sheet.</p>
    </div>
  );
}
