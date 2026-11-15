import { useState, useEffect, useRef } from 'react';
import { useChar } from '../../context/CharacterContext';
import { useDiceRoll } from '../../context/DiceRollContext';
import type { Firearm } from '../../types/character';
import { getProfDice, effAttr } from '../../utils/mechanics';
import {
  getAmmo, ammoDice, getGunProfDef, resolveGunProf, getGunWeaponBonus, getGunBonusParts, getGunReceiver, describeGun,
  getTierDamage, hitTierLabel, DAMAGE_TIERS, getLoadedAmmo, getLoadedRound, getLoadOptions, fmtMult, fmtAp,
  type HitTierKey, type Ammo, type AmmoRound,
} from '../../utils/gunData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Link, Unlink, ArrowUp, ArrowDown, Minus, Plus, Swords } from 'lucide-react';
import RollButton from '../dice/RollButton';
import { useCombat } from '../../context/CombatContext';

/** Damage by hit tier: graze = the base dice; flesh x round multiplier; solid x (multiplier + 0.5); vital x (multiplier + 2). */
function GunDamageButton({ label, ammo, round }: { label: string; ammo: Ammo; round: AmmoRound }) {
  const { rollDamage, log } = useDiceRoll();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<HitTierKey>('graze');

  // Pre-fill from the most recent firearm attack that hit
  useEffect(() => {
    if (!open) return;
    const last = log.find(e => e.hitTier && e.hitTier.key !== 'miss');
    if (last?.hitTier) setTier(last.hitTier.key);
  }, [open, log]);

  const td = getTierDamage(tier, round.multiplier, ammo.baseInjury)!;
  const avg = ammo.count * ((ammo.sides + 1) / 2);
  const mult = td.multiplier;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
          title={`Roll damage: ${ammoDice(ammo)} by hit tier`}>
          <Swords className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" align="center">
        <p className="text-xs font-medium text-foreground mb-2 truncate">{label}</p>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {DAMAGE_TIERS.map(k => (
            <button key={k} onClick={() => setTier(k)}
              className={`px-2 py-1 rounded-md border text-xs transition-colors ${tier === k ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              {hitTierLabel(k)}
            </button>
          ))}
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-muted-foreground">{ammoDice(ammo)} × {mult}</span><span className="font-bold text-destructive">≈ {Math.round(avg * mult)} dmg</span></div>
          <p className="text-muted-foreground">{td.effect}</p>
          <p className="text-muted-foreground">{ammo.label} {round.label}: {fmtMult(round.multiplier)}, {fmtAp(round.ap)} (armor pierce is shown, not applied for you).</p>
          <p className="text-muted-foreground italic">The critical effect's lethal or non-lethal type isn't set yet.</p>
        </div>
        <Button size="sm" variant="destructive" className="w-full h-7 text-xs gap-1.5 mt-2"
          onClick={() => { rollDamage(`${label} — ${hitTierLabel(tier)}`, ammo.sides, mult, 1, ammo.count); setOpen(false); }}>
          <Swords className="h-3 w-3" /> Roll Damage
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface Props { gun: Firearm; onEdit: () => void; onDelete: () => void; onMoveUp?: () => void; onMoveDown?: () => void }

export default function GunCard({ gun, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  const { character: c, setCharacter } = useChar();
  const { currentRoll } = useDiceRoll();
  // Stabilizing takes a reaction and removes every barrel-length and ammo-size penalty, on the first shot only.
  const [stabilized, setStabilized] = useState(false);
  const { turnKey, reactionsLeft, spendReaction, refundReaction } = useCombat();
  // Stabilizing spends a reaction from the turn's pool; taking it back refunds it.
  const toggleStabilize = () => {
    if (stabilized) { setStabilized(false); refundReaction(); }
    else if (spendReaction()) setStabilized(true);
  };
  // A new turn (or combat starting or ending) refills the reactions and clears the stabilize
  useEffect(() => { setStabilized(false); }, [turnKey]);
  const seenRoll = useRef(currentRoll?.id);
  useEffect(() => {
    if (!currentRoll || currentRoll.id === seenRoll.current) return;
    seenRoll.current = currentRoll.id;
    if (currentRoll.label === `${gun.name} Attack`) setStabilized(false);
  }, [currentRoll, gun.name]);
  const [challenge, setChallenge] = useState(1);

  const fit = resolveGunProf(c, gun);
  const prof = fit.prof;
  const profDef = getGunProfDef(fit.key ?? (fit.fits[0]?.key));
  const penalty = stabilized ? 0 : fit.penalty;
  const ammo = getAmmo(gun.ammoId);
  const loaded = getLoadedAmmo(gun);
  const round = getLoadedRound(gun);
  const setLoad = (v: string) => {
    const [am, ro] = v.split(':');
    setCharacter(p => ({ ...p, firearms: (p.firearms ?? []).map(g => g.id === gun.id ? { ...g, loadedAmmoId: am === g.ammoId ? undefined : am, roundId: ro } : g) }));
  };
  const receiver = getGunReceiver(gun.receiver);
  const bonus = getGunWeaponBonus(gun);
  // With the proficiency: its dice (3 + DEX + INT/WIS + level + modifiers). Without: just 3 + INT or WIS (no DEX).
  const mental = prof?.mentalStat === 'wis' || prof?.mentalStat === 'int' ? prof.mentalStat : (gun.mentalStat ?? 'int');
  const profDice = prof ? Math.max(0, getProfDice(c, prof) - penalty) : Math.max(0, 3 + effAttr(c, mental));
  const attackDice = profDice + bonus;
  const setMental = (m: 'int' | 'wis') => setCharacter(p => ({ ...p, firearms: (p.firearms ?? []).map(g => g.id === gun.id ? { ...g, mentalStat: m } : g) }));
  const bonusText = getGunBonusParts(gun).filter(p => p.value !== 0).map(p => `${p.label}(${p.value})`).join(' + ');

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm text-foreground">{gun.name}</span>
            <Badge variant="secondary" className="text-xs">{receiver?.label ?? gun.receiver}</Badge>
            {ammo && <Badge variant="outline" className="text-xs">{ammo.label}</Badge>}
            {loaded && round && <Badge variant="outline" className="text-xs">{loaded.label} {round.label}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{describeGun(gun)}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(onMoveUp !== undefined || onMoveDown !== undefined) && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp} disabled={!onMoveUp}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown} disabled={!onMoveDown}><ArrowDown className="h-3 w-3" /></Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {gun.name}?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the firearm from your character.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="rounded bg-muted/30 border border-border/50 px-2.5 py-2 space-y-1.5">
        {(
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Atk: </span>
                <span className="font-bold text-foreground">{attackDice}d6</span>
              </div>
              <RollButton label={`${gun.name} Attack`} diceCount={attackDice} size="sm"
                extras={{ hitTierChallenge: challenge, hitTierRound: loaded && round ? { multiplier: round.multiplier, baseInjury: loaded.baseInjury } : undefined }} />
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {prof ? `Prof(${profDice}d6${penalty ? `, -${penalty}: ${fit.reason}` : ''})` : `3 + ${mental.toUpperCase()}(${effAttr(c, mental)})`} + Weapon(+{bonus}d6: {bonusText})
            </div>
            {prof && fit.penalty > 0 && (
              <button onClick={toggleStabilize} disabled={!stabilized && reactionsLeft <= 0}
                className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors ${stabilized ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                title="Stabilizing takes a reaction from this turn's pool. It removes every barrel-length and ammo-size penalty on the first shot.">
                {stabilized ? `Stabilized (reaction spent): -${fit.penalty} removed for the first shot` : reactionsLeft <= 0 ? 'Stabilize: no reactions left this turn' : `Stabilize (1 reaction): removes the -${fit.penalty} on the first shot`}
              </button>
            )}
            {!prof && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Mental stat:</span>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  {(['int', 'wis'] as const).map(m => (
                    <button key={m} onClick={() => setMental(m)}
                      className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${mental === m ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>{m.toUpperCase()}</button>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">no proficiency needed</span>
              </div>
            )}
            <div className="flex items-center gap-1" title="The target's Challenge to Hit: matching it is a graze, 1-2 over a flesh wound, 3-4 a solid hit, 5+ a vital hit">
              <span className="text-xs text-muted-foreground shrink-0">Challenge to Hit:</span>
              <Button size="icon" variant="outline" className="h-6 w-6 shrink-0" onClick={() => setChallenge(Math.max(1, challenge - 1))} disabled={challenge <= 1}>
                <Minus className="h-3 w-3" />
              </Button>
              <Input type="number" min={1} value={challenge}
                onChange={e => setChallenge(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-6 w-11 text-xs px-1 text-center" />
              <Button size="icon" variant="outline" className="h-6 w-6 shrink-0" onClick={() => setChallenge(challenge + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Successes vs the challenge: equal = graze (base dice), +1-2 = flesh wound, +3-4 = solid hit, +5 or more = vital hit. The damage button applies the tier.
            </p>
          </>
        )}

        {loaded && round && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Loaded:</span>
              <Select value={`${loaded.id}:${round.id}`} onValueChange={setLoad}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getLoadOptions(gun.ammoId).map(o => <SelectItem key={`${o.ammoId}:${o.roundId}`} value={`${o.ammoId}:${o.roundId}`}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Dmg: </span>
                <span className="font-semibold text-foreground">{ammoDice(loaded)} {fmtMult(round.multiplier)}</span>
                <span className="text-muted-foreground text-[10px] ml-1">({loaded.label} {round.label}, {fmtAp(round.ap)}, base injury {loaded.baseInjury})</span>
              </div>
              <GunDamageButton label={`${gun.name} (${loaded.label} ${round.label})`} ammo={loaded} round={round} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {prof ? <Link className="h-3 w-3 text-primary shrink-0" /> : <Unlink className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-xs text-muted-foreground shrink-0">Proficiency:</span>
        <span className="text-xs font-medium text-foreground">
          {(prof ? prof.name : null) ?? profDef?.name ?? 'None fits this build'}
          {fit.penalty > 0 && <span className="text-muted-foreground font-normal"> (at -{fit.penalty}{stabilized ? ', stabilized' : ''})</span>}
          {gun.profOverride && <span className="text-muted-foreground font-normal"> (override)</span>}
          {profDef && !prof && <span className="text-muted-foreground font-normal"> (optional, not taken)</span>}
        </span>
      </div>
    </div>
  );
}
