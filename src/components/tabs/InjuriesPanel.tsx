import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import {
  InjuryLocation, InjuryLevel, INJURY_LOCATIONS, INJURY_LOCATION_LABELS,
} from '../../types/character';
import {
  resolveHitVsArmor, isLimb, getInjuries,
  getTotalInjuryDiceLoss, INJURY_LEVELS, HitResolution, applyArmorDegrade, ARMOR_SLOTS_FOR_LOCATION,
} from '../../utils/armorInjury';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Dices, Shield, Skull, X } from 'lucide-react';

const LEVEL_BADGE_CLASS: Record<Exclude<InjuryLevel, 'none'>, string> = {
  fleshWound: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  minor: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  maiming: 'bg-destructive/15 text-destructive border-destructive/30',
  dismembered: 'bg-destructive/25 text-destructive border-destructive/40',
  dead: 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white',
};

export default function InjuriesPanel() {
  const { character: c, setCharacter } = useChar();
  const [calcLocation, setCalcLocation] = useState<InjuryLocation>('torso');
  const [successesStr, setSuccessesStr] = useState('');
  const [allowHard, setAllowHard] = useState(false);
  const [result, setResult] = useState<HitResolution | null>(null);

  const totalDiceLoss = getTotalInjuryDiceLoss(c.injuries);

  // Rebuilt fresh from INJURY_LOCATIONS every write (not spread from
  // p.injuries directly) so a character saved before this system existed --
  // a single level string, or the original {internal, external} shape --
  // gets normalized to the real (array-per-location) shape on the first
  // edit instead of accumulating a stale hybrid of old and new keys.
  const addInjury = (location: InjuryLocation, level: Exclude<InjuryLevel, 'none'>) => {
    setCharacter(p => {
      const normalized = Object.fromEntries(INJURY_LOCATIONS.map(loc => [loc, getInjuries(p.injuries, loc)])) as Record<InjuryLocation, Exclude<InjuryLevel, 'none'>[]>;
      return { ...p, injuries: { ...normalized, [location]: [...normalized[location], level] } };
    });
  };
  const removeInjury = (location: InjuryLocation, index: number) => {
    setCharacter(p => {
      const normalized = Object.fromEntries(INJURY_LOCATIONS.map(loc => [loc, getInjuries(p.injuries, loc)])) as Record<InjuryLocation, Exclude<InjuryLevel, 'none'>[]>;
      return { ...p, injuries: { ...normalized, [location]: normalized[location].filter((_, i) => i !== index) } };
    });
  };

  const handleCompute = () => {
    const raw = Math.max(0, parseInt(successesStr) || 0);
    setResult(resolveHitVsArmor(c, raw, calcLocation, allowHard));
  };

  // Applying now does BOTH steps for real: degrades the actual outermost
  // eligible layer (armor damage is automatic, no more "go adjust it
  // yourself") and adds the new injury to the location's list -- every
  // landed hit gets recorded, even a repeat of a level already there
  // (two separate Flesh Wounds each still cost their own -1 die).
  const handleApply = () => {
    if (!result) return;
    setCharacter(p => {
      let next = p;
      if (result.armorDegradeTarget) {
        next = { ...next, armor: applyArmorDegrade(next, result.armorDegradeTarget) };
      }
      if (result.injuryLevel !== 'none') {
        const normalized = Object.fromEntries(INJURY_LOCATIONS.map(loc => [loc, getInjuries(next.injuries, loc)])) as Record<InjuryLocation, Exclude<InjuryLevel, 'none'>[]>;
        next = { ...next, injuries: { ...normalized, [calcLocation]: [...normalized[calcLocation], result.injuryLevel] } };
      }
      return next;
    });
    setResult(null);
    setSuccessesStr('');
  };

  return (
    <div className="p-4 space-y-5">
      {totalDiceLoss > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive">−{totalDiceLoss} dice to all attacks</span>
          <span className="text-xs text-muted-foreground">from active injuries below</span>
        </div>
      )}

      {/* Per-location status grid -- a location can carry several injuries
          at once, so this lists every entry rather than just one level. */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> Injuries by Location
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INJURY_LOCATIONS.map(loc => {
            const list = getInjuries(c.injuries, loc);
            return (
              <div key={loc} className="bg-card border border-border rounded-lg p-2.5 space-y-1.5">
                <span className="text-xs font-medium text-foreground">{INJURY_LOCATION_LABELS[loc]}</span>
                {list.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Uninjured</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {list.map((level, i) => (
                      <Badge key={i} className={`text-[10px] gap-1 ${LEVEL_BADGE_CLASS[level]}`}>
                        {INJURY_LEVELS[level].label}
                        <button onClick={() => removeInjury(loc, i)} title="Heal / remove this injury" className="hover:opacity-70">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Select value="" onValueChange={(v) => addInjury(loc, v as Exclude<InjuryLevel, 'none'>)}>
                  <SelectTrigger className="h-6 text-[10px] w-full">
                    <SelectValue placeholder="+ Add injury" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(INJURY_LEVELS) as Exclude<InjuryLevel, 'none'>[]).map(l => (
                      <SelectItem key={l} value={l} className="text-xs">{INJURY_LEVELS[l].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Click × on a badge to heal that specific injury, or add one directly to record a hit without the calculator below.
        </p>
      </div>

      {/* Hit calculator */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Dices className="h-3.5 w-3.5 text-primary" /> Resolve a Hit
        </p>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Location</label>
            <Select value={calcLocation} onValueChange={(v) => { setCalcLocation(v as InjuryLocation); setResult(null); }}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INJURY_LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc} className="text-xs">{INJURY_LOCATION_LABELS[loc]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Successes rolled</label>
            <Input
              type="number" min={0} value={successesStr}
              onChange={e => setSuccessesStr(e.target.value)}
              onFocus={e => e.target.select()}
              className="h-8 text-xs w-24"
              placeholder="0"
            />
          </div>
          <label className="flex items-center gap-1.5 h-8 text-[10px] text-muted-foreground">
            <Switch checked={allowHard} onCheckedChange={setAllowHard} />
            Heavy weapon / armor-breaker
          </label>
          <Button size="sm" className="h-8 text-xs" onClick={handleCompute}>Compute</Button>
        </div>

        {result && (
          <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5 text-xs">
            <p>Armor at {INJURY_LOCATION_LABELS[calcLocation]} ({ARMOR_SLOTS_FOR_LOCATION[calcLocation].length > 1 ? 'combined' : 'own slot'}): <span className="font-semibold text-foreground">{result.armorValue}</span></p>
            {result.absorbed ? (
              <p className="text-primary">Fully absorbed — no damage.</p>
            ) : (
              <p>Successes through: <span className="font-semibold text-foreground">{result.successesThrough}</span></p>
            )}
            {result.armorDegradeTarget ? (
              <p className="text-amber-500">Armor takes 1 point of damage at {result.armorDegradeTarget.slot} ({result.armorDegradeTarget.layer}) -- applied automatically.</p>
            ) : (result.armorValue > 0 && !result.absorbed) ? (
              <p className="text-muted-foreground italic">All eligible armor there is hard and this wasn't a Heavy/armor-breaker hit -- no degradation.</p>
            ) : null}
            {result.injuryLevel !== 'none' && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                {result.injuryLevel === 'dead' && <Skull className="h-3.5 w-3.5 text-destructive" />}
                <Badge className={`text-[10px] ${LEVEL_BADGE_CLASS[result.injuryLevel]}`}>{INJURY_LEVELS[result.injuryLevel].label}</Badge>
                <span className="text-muted-foreground">{INJURY_LEVELS[result.injuryLevel].description}</span>
                {result.injuryLevel === 'maiming' && !isLimb(calcLocation) && (
                  <span className="text-[10px] text-muted-foreground italic">(not a limb — no lost-limb effect)</span>
                )}
              </div>
            )}
            <div className="pt-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={handleApply}>
                Apply to {INJURY_LOCATION_LABELS[calcLocation]}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
