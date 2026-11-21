import { useEffect, useRef, useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { useDiceRoll } from '../../context/DiceRollContext';
import { useCombat } from '../../context/CombatContext';
import type { Bow, Crossbow, Firearm, Weapon } from '../../types/character';
import {
  getProfDice, getBowAttackDice, getCrossbowAttackDice,
} from '../../utils/mechanics';
import {
  getWeaponModifier, getTotalMultiplierForHandedness, getMultiplierDisplay, getDamageDie, parseDieSides, HEAD_CATEGORIES,
} from '../../utils/weaponData';
import { getWeaponProficiency, getSwordProfDef, getSwordBonusTotals, getSwordBonusDice, getMultiOpponentDice } from '../../utils/swordData';
import { getBowMultiplier, getBowDie, getCrossbowMultiplier, getCrossbowDie } from '../../utils/rangedData';
import {
  getGunAttackDice, getLoadedAmmo, getLoadedRound, getMagazineSize, getRoundsLeft, ammoDice,
} from '../../utils/gunData';
import RollButton from '../dice/RollButton';
import DamageRollButton from '../dice/DamageRollButton';
import { GunDamageButton } from '../tabs/GunCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dices } from 'lucide-react';

/** One weapon on one line: its name, the attack roll and the damage roll. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap py-1.5 border-t border-border/50 first:border-t-0">
      <span className="text-xs font-semibold text-foreground min-w-[7rem] flex-1 truncate">{name}</span>
      {children}
    </div>
  );
}
const Chip = ({ label, value }: { label: string; value: string }) => (
  <span className="text-xs"><span className="text-muted-foreground">{label} </span><span className="font-bold text-foreground">{value}</span></span>
);

function MeleeRow({ w }: { w: Weapon }) {
  const { character: c, setCharacter } = useChar();
  const { rollCombined } = useDiceRoll();
  // How many opponents the NPC is fighting: one shared counter on the card
  const { opponents } = useCombat();
  const prof = getWeaponProficiency(c, w);
  const grip = w.handedness === '1h2h' ? (w.currentGrip ?? '1h') : w.handedness;
  const mod = w.attackModOverride != null ? w.attackModOverride : getWeaponModifier(w.swordProfKey ? 'martial' : w.classification, grip, w.weight);
  const swordDef = getSwordProfDef(w.swordProfKey ?? prof?.swordKey);
  const totals = prof && swordDef ? getSwordBonusTotals(swordDef, prof.level) : undefined;
  const bonus = totals ? getSwordBonusDice(totals, { twoHanded: grip === '2h', opponents }) : 0;
  const dice = prof ? getProfDice(c, prof) + mod + bonus : 0;
  const multiDice = totals ? getMultiOpponentDice(totals, opponents) : 0;
  const heads = w.heads.filter(h => h.category && h.subType);
  const setGrip = (g: '1h' | '2h') => setCharacter(p => ({ ...p, weapons: p.weapons.map(x => x.id === w.id ? { ...x, currentGrip: g } : x) }));

  return (
    <Row name={w.name}>
      {w.handedness === '1h2h' ? (
        <div className="inline-flex rounded-md border border-border overflow-hidden" title="This weapon can be held in one hand or two">
          {(['1h', '2h'] as const).map(g => (
            <button key={g} onClick={() => setGrip(g)}
              className={`px-1.5 py-0.5 text-[10px] font-semibold ${grip === g ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>{g.toUpperCase()}</button>
          ))}
        </div>
      ) : (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground" title="This weapon can only be held this way">
          {grip === '2h' ? '2H' : grip === '1h' ? '1H' : 'Small'}
        </span>
      )}
      {prof ? (
        <span className="flex items-center gap-0.5"><Chip label="Atk" value={`${dice}d6`} />{multiDice > 0 && <span className="text-[10px] text-muted-foreground">(+{multiDice}d6 extra opponents)</span>}<RollButton label={`${w.name} Attack`} diceCount={dice} size="sm" /></span>
      ) : (
        <span className="text-[11px] text-muted-foreground italic">no proficiency linked</span>
      )}
      {heads.map((h, i) => {
        const cat = HEAD_CATEGORIES.find(x => x.id === h.category);
        const sub = cat?.subTypes.find(s => s.id === h.subType);
        const die = getDamageDie(h.category, h.subType);
        return (
          <span key={i} className="flex items-center gap-0.5">
            <Chip label={heads.length > 1 ? `Dmg ${sub?.label ?? ''}` : 'Dmg'} value={`${die} × ${getMultiplierDisplay(h.category, h.subType, grip)}`} />
            <DamageRollButton label={`${w.name} — ${cat?.label ?? h.category}`} multiplier={getTotalMultiplierForHandedness(h.category, h.subType, grip)} dieSides={parseDieSides(die)} size="sm" />
          </span>
        );
      })}
      {totals && totals.defenseAdvantageDice > 0 && dice > 0 && (
        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1" title={`One roll: offense, and defense with advantage on ${totals.defenseAdvantageDice} dice`}
          onClick={() => rollCombined(`${w.name} — Offense + Defense`, dice, Math.min(totals.defenseAdvantageDice, dice))}>
          <Dices className="h-3 w-3" />Off + Def
        </Button>
      )}
      {totals && totals.challenge > 0 && <span className="text-[10px] text-muted-foreground">+{totals.challenge} Challenge to Hit</span>}
    </Row>
  );
}

function BowRow({ b }: { b: Bow }) {
  const { character: c } = useChar();
  const prof = b.linkedProficiencyId ? c.proficiencies.find(p => p.id === b.linkedProficiencyId) : undefined;
  const dice = getBowAttackDice(c, prof);
  const die = getBowDie(b.drawWeight);
  const mult = getBowMultiplier(b.style, b.drawWeight);
  return (
    <Row name={b.name}>
      <span className="flex items-center gap-0.5"><Chip label="Atk" value={`${dice}d6`} /><RollButton label={`${b.name} — Attack`} diceCount={dice} size="sm" /></span>
      <span className="flex items-center gap-0.5"><Chip label="Dmg" value={`${die} × ${mult}`} /><DamageRollButton label={b.name} multiplier={mult} dieSides={parseDieSides(die)} size="sm" /></span>
    </Row>
  );
}

function CrossbowRow({ x }: { x: Crossbow }) {
  const { character: c } = useChar();
  const dice = getCrossbowAttackDice(c);
  const die = getCrossbowDie(x.drawWeight);
  const mult = getCrossbowMultiplier(x.drawWeight);
  return (
    <Row name={x.name}>
      <span className="flex items-center gap-0.5"><Chip label="Atk" value={`${dice}d6`} /><RollButton label={`${x.name} — Attack`} diceCount={dice} size="sm" /></span>
      <span className="flex items-center gap-0.5"><Chip label="Dmg" value={`${die} × ${mult}`} /><DamageRollButton label={x.name} multiplier={mult} dieSides={parseDieSides(die)} size="sm" /></span>
    </Row>
  );
}

function GunRow({ g }: { g: Firearm }) {
  const { character: c, setCharacter } = useChar();
  const { currentRoll } = useDiceRoll();
  const [challenge, setChallenge] = useState(1);
  const ammo = getLoadedAmmo(g);
  const round = getLoadedRound(g);
  const size = getMagazineSize(g);
  const left = getRoundsLeft(g);
  const dice = getGunAttackDice(c, g);

  // Every shot uses a round (burst and full-auto are not built yet)
  const seen = useRef(currentRoll?.id);
  useEffect(() => {
    if (!currentRoll || currentRoll.id === seen.current) return;
    seen.current = currentRoll.id;
    if (currentRoll.label === `${g.name} Attack`) {
      setCharacter(p => ({ ...p, firearms: (p.firearms ?? []).map(x => x.id === g.id ? { ...x, rounds: Math.max(0, getRoundsLeft(x) - 1) } : x) }));
    }
  }, [currentRoll, g.id, g.name, setCharacter]);

  // An NPC reloads for free: refill the magazine
  const reload = () => setCharacter(p => ({ ...p, firearms: (p.firearms ?? []).map(x => x.id === g.id ? { ...x, rounds: getMagazineSize(x) } : x) }));

  return (
    <Row name={g.name}>
      {left > 0 ? (
        <span className="flex items-center gap-0.5">
          <Chip label="Atk" value={`${dice}d6`} />
          <RollButton label={`${g.name} Attack`} diceCount={dice} size="sm"
            extras={{ hitTierChallenge: challenge, hitTierRound: ammo && round ? { multiplier: round.multiplier, baseInjury: ammo.baseInjury } : undefined }} />
        </span>
      ) : <span className="text-[11px] text-destructive font-semibold">empty</span>}
      <span className="flex items-center gap-1" title="The target's Challenge to Hit: successes against it decide a graze, flesh wound, solid hit or vital hit">
        <span className="text-[10px] text-muted-foreground">vs</span>
        <Input type="number" min={1} value={challenge} onChange={e => setChallenge(Math.max(1, parseInt(e.target.value) || 1))} className="h-6 w-10 text-xs px-1 text-center" aria-label={`${g.name} challenge to hit`} />
      </span>
      {ammo && round && (
        <span className="flex items-center gap-0.5">
          <Chip label="Dmg" value={`${ammoDice(ammo)} ×${round.multiplier}`} />
          <GunDamageButton label={`${g.name} (${ammo.label} ${round.label})`} ammo={ammo} round={round} />
        </span>
      )}
      <span className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground">{left}/{size}</span>
        <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={reload} disabled={left >= size}>Reload</Button>
      </span>
    </Row>
  );
}

/** A compact list of an NPC's weapons: for each, the attack roll and the damage roll (and the defense roll where the
 * weapon has one). Builders, proficiency links and everything else stay on the full sheet. */
export default function NpcAttacks() {
  const { character: c } = useChar();
  const weapons = c.weapons ?? [], bows = c.bows ?? [], crossbows = c.crossbows ?? [], guns = c.firearms ?? [];
  if (weapons.length + bows.length + crossbows.length + guns.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No weapons yet. Add them on the full sheet.</p>;
  }
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5">
      {weapons.map(w => <MeleeRow key={w.id} w={w} />)}
      {bows.map(b => <BowRow key={b.id} b={b} />)}
      {crossbows.map(x => <CrossbowRow key={x.id} x={x} />)}
      {guns.map(g => <GunRow key={g.id} g={g} />)}
    </div>
  );
}
