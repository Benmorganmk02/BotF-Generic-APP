import { useState } from 'react';
import { chainTargetCount, clamp, MAX_FOLLOW_SIZE, followBlastRadius, followConePool } from '../../utils/spellGeometry';
import { useChar } from '../../context/CharacterContext';
import { AbilityEntry } from '../../types/character';
import { getAvailAbilityPts, getManaMax } from '../../utils/mechanics';
import {
  MAGIC_SCHOOLS, checkStormPrereq, checkDynamicIllusionPrereq,
} from '../../utils/magicTrees';
import type { MagicAbility, MagicSchool } from '../../utils/magicTrees';
import { Button } from '@/components/ui/button';
import BoxTracker from '../sheet/BoxTracker';
import SpellMap from './SpellMap';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, CheckCircle2, Lock, Circle,
  Flame, Zap, Snowflake, Skull, Sparkles, Brain, Hammer,
  Minus, Plus, Heart, ScrollText,
} from 'lucide-react';

// ── Icon mapping ──────────────────────────────────────────────────────────────
const SCHOOL_ICONS: Record<string, React.ReactNode> = {
  Flame: <Flame className="h-4 w-4 text-primary" />,
  Brain: <Brain className="h-4 w-4 text-primary" />,
  Hammer: <Hammer className="h-4 w-4 text-primary" />,
  ScrollText: <ScrollText className="h-4 w-4 text-primary" />,
};

const ELEMENT_ICONS: Record<string, React.ReactNode> = {
  Fire: <Flame className="h-3.5 w-3.5 text-destructive" />,
  Lightning: <Zap className="h-3.5 w-3.5 text-primary" />,
  Frost: <Snowflake className="h-3.5 w-3.5 text-accent-foreground" />,
  Poison: <Skull className="h-3.5 w-3.5 text-secondary-foreground" />,
  Arcane: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  Advanced: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  Inscribing: <ScrollText className="h-3.5 w-3.5 text-primary" />,
  Transcribing: <ScrollText className="h-3.5 w-3.5 text-primary" />,
  Matrices: <ScrollText className="h-3.5 w-3.5 text-primary" />,
  Scribing: <ScrollText className="h-3.5 w-3.5 text-primary" />,
};

function normalizeAbility(a: string | AbilityEntry): AbilityEntry {
  if (typeof a === 'string') return { id: crypto.randomUUID(), name: a, description: '' };
  return a;
}

// ── Stepper control ───────────────────────────────────────────────────────────
function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (v: number) => void; min?: number; label?: string }) {
  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-xs text-muted-foreground mr-0.5">{label}</span>}
      <button onClick={() => onChange(Math.max(min, value - 1))} className="h-5 w-5 rounded border border-border text-xs flex items-center justify-center hover:bg-muted">
        <Minus className="h-3 w-3" />
      </button>
      <span className="text-xs font-bold w-6 text-center">{value}</span>
      <button onClick={() => onChange(value + 1)} className="h-5 w-5 rounded border border-border text-xs flex items-center justify-center hover:bg-muted">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Compute actual modifier effect text ───────────────────────────────────────
function computeModEffect(modId: string, manaSpent: number): string {
  const extra = manaSpent - 1; // first mana activates the base effect
  switch (modId) {
    case 'blast': {
      const radius = 2 + extra;
      return `${radius} m radius AoE explosion`;
    }
    case 'chain': {
      const targets = 1 + extra;
      return `Chains to ${targets} additional target${targets !== 1 ? 's' : ''}`;
    }
    case 'wave_cone': {
      const waveRadius = 1 + extra;
      return `Wave: ${waveRadius} m out from you (marker on you = 360°) · Cone: ${10 + extra * 2} m total, where the marker reaches sets the length and the rest is the width at the end (at least 2 m wide)`;
    }
    case 'shield':
      return 'Shield effect (details TBD)';
    case 'storm':
      return 'Massive elemental storm (details TBD)';
    default:
      return '';
  }
}

// ── Spell Builder ─────────────────────────────────────────────────────────────
function SpellBuilder({ takenIds, currentMana, onSpendMana }: { takenIds: Set<string>; currentMana: number; onSpendMana: (cost: number) => void }) {
  const school = MAGIC_SCHOOLS.find(s => s.id === 'elements_arcane')!;
  const bolts = school.abilities.filter(a => a.isBolt);
  const modifiers = school.abilities.filter(a => a.isModifier);

  const unlockedBolts = bolts.filter(b => takenIds.has(b.id));
  const [selectedBoltId, setSelectedBoltId] = useState<string | null>(null);
  const [rawModifiers, setActiveModifiers] = useState<Record<string, number>>({});
  // Advanced molding: a second shape (Blast or Wave) that follows Chain, and how many chained hits it fires from
  const [followShape, setFollowShape] = useState<'blast' | 'cone' | null>(null);
  const [followMana, setFollowMana] = useState(1);
  const [followSize, setFollowSize] = useState(0);
  const [empowerMana, setEmpowerMana] = useState(0);
  // Cone splitter state: how much of the pool goes to length vs width

  const selectedBolt = bolts.find(b => b.id === selectedBoltId);
  const isHealing = selectedBoltId === 'healing';
  const unlockedModifiers = modifiers.filter(m => takenIds.has(m.id));

  // Spell Molding: with no levels a bolt can only be empowered; level 1 allows one shape at a time; level 2+ several.
  const SHAPE_IDS = ['blast', 'chain', 'wave_cone'];
  const moldingLevel = takenIds.has('spell_molding_3') ? 3 : takenIds.has('spell_molding_2') ? 2 : takenIds.has('spell_molding_1') ? 1 : 0;
  const activeModifiers: Record<string, number> = { ...rawModifiers };
  if (moldingLevel === 0) SHAPE_IDS.forEach(id => delete activeModifiers[id]);
  else if (moldingLevel === 1) {
    const keep = SHAPE_IDS.find(id => (activeModifiers[id] ?? 0) > 0);
    SHAPE_IDS.forEach(id => { if (id !== keep) delete activeModifiers[id]; });
  }

  const toggleModifier = (modId: string) => {
    setActiveModifiers(prev => {
      const cur = prev[modId] ?? 0;
      if (cur > 0) {
        const next = { ...prev };
        delete next[modId];
        return next;
      }
      const base = moldingLevel === 1 && SHAPE_IDS.includes(modId)
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => !SHAPE_IDS.includes(k)))
        : prev;
      return { ...base, [modId]: 1 };
    });
  };

  const adjustModifierMana = (modId: string, delta: number) => {
    setActiveModifiers(prev => {
      const cur = prev[modId] ?? 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[modId];
        return copy;
      }
      return { ...prev, [modId]: next };
    });
  };

  // Calculate totals
  const baseMana = selectedBolt ? 1 : 0;
  const baseDmg = selectedBolt ? 6 : 0;
  const empowerDmg = empowerMana * 6;

  // Wave/Cone pool calculation
  const waveConeCount = activeModifiers['wave_cone'] ?? 0;

  // Advanced molding (level 3): Chain followed by a Blast or Wave
  const chainMana = activeModifiers['chain'] ?? 0;
  const chainJumps = chainTargetCount(chainMana);
  const followOptions = ([{ id: 'blast', modId: 'blast', name: 'Blast' }, { id: 'cone', modId: 'wave_cone', name: 'Cone' }] as const)
    .filter(o => takenIds.has(o.modId));
  const followActive = moldingLevel >= 3 && chainMana > 0 && followShape !== null && followOptions.some(o => o.id === followShape);
  const followCount = followActive ? clamp(followMana, 1, chainJumps + 1) : 0;
  const followSteps = followActive ? clamp(followSize, 0, MAX_FOLLOW_SIZE) : 0;

  let modMana = 0;
  interface ModSummary { id: string; label: string; effect: string; mana: number }
  const modSummaries: ModSummary[] = [];
  for (const mod of unlockedModifiers) {
    const count = activeModifiers[mod.id] ?? 0;
    if (count > 0) {
      const cost = count * (mod.modifierManaCost ?? 1);
      modMana += cost;
      const effect = computeModEffect(mod.id, count);
      modSummaries.push({ id: mod.id, label: mod.name, effect, mana: cost });
    }
  }
  if (followActive && followShape) {
    modMana += followCount + followSteps;
    const half = followConePool(followSteps) / 2;
    const what = followShape === 'blast' ? `a ${followBlastRadius(followSteps)} m blast` : `a ${half} m × ${half} m cone (pointing away from where it was hit)`;
    const reach = followCount === 2 ? ' and the first chained hit' : followCount > 2 ? ` and the first ${followCount - 1} chained hits` : '';
    modSummaries.push({
      id: 'follow',
      label: `Then ${followShape === 'blast' ? 'Blast' : 'Cone'}${followCount > 1 ? ` ×${followCount}` : ''}${followSteps > 0 ? ` (size +${followSteps})` : ''}`,
      effect: `Fires ${what}, starting at the main target${reach}, ${isHealing ? 'healing' : 'dealing'} ${baseDmg + empowerDmg} ${isHealing ? 'HP' : 'damage'} again to everyone caught (a second set of hits)`,
      mana: followCount + followSteps,
    });
  }
  const totalMana = baseMana + empowerMana + modMana;
  const totalDmg = baseDmg + empowerDmg;

  if (unlockedBolts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Spell Builder</h3>
        <p className="text-xs text-muted-foreground italic">Take a base bolt spell to start building spells.</p>
      </div>
    );
  }

  const elementName = selectedBolt
    ? school.abilities.find(a => a.id === selectedBolt.id)?.element?.toLowerCase() ?? 'elemental'
    : '';

  const hasAnyActive = empowerMana > 0 || modSummaries.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Spell Builder</h3>

      {/* Bolt picker */}
      <div className="flex gap-2 flex-wrap">
        {bolts.map(b => {
          const unlocked = takenIds.has(b.id);
          const selected = selectedBoltId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => unlocked && setSelectedBoltId(selected ? null : b.id)}
              disabled={!unlocked}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : unlocked
                    ? 'border-border text-muted-foreground hover:border-primary/50'
                    : 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
              }`}
            >
              {b.id === 'healing' ? <Heart className="h-3.5 w-3.5 text-secondary-foreground" /> : ELEMENT_ICONS[b.element] ?? null}
              {b.name}
            </button>
          );
        })}
      </div>

      {selectedBolt && (
        <>
          {/* Modifier toggles + mana controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {modifiers.filter(m => m.id !== 'storm').map(mod => {
              const unlocked = takenIds.has(mod.id);
              const active = (activeModifiers[mod.id] ?? 0) > 0;
              const extraCount = activeModifiers[mod.id] ?? 0;
              const needsMolding = SHAPE_IDS.includes(mod.id) && moldingLevel < 1;
              return (
                <div key={mod.id} className="flex items-center gap-1">
                  <label
                    className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${
                      !unlocked ? 'text-muted-foreground opacity-40 cursor-not-allowed' : active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => unlocked && !needsMolding && toggleModifier(mod.id)}
                      disabled={!unlocked || needsMolding}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    {mod.name}
                    {!unlocked ? <span className="text-[10px]">(locked)</span> : needsMolding ? <span className="text-[10px]">(needs Spell Molding)</span> : null}
                  </label>
                  {active && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <Stepper value={extraCount} onChange={v => { const copy = { ...rawModifiers }; if (v <= 0) { delete copy[mod.id]; } else { copy[mod.id] = v; } setActiveModifiers(copy); }} min={0} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {moldingLevel === 0 && <p className="text-[11px] text-muted-foreground">Without Spell Molding a bolt can only be empowered.</p>}
          {moldingLevel === 1 && <p className="text-[11px] text-muted-foreground">Spell Molding (Level 1): one shape at a time.</p>}

          {/* Advanced molding: a second shape that follows Chain */}
          {moldingLevel >= 3 && chainMana > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground">Advanced molding: then, after the Chain</div>
              {followOptions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Take Blast or Wave / Cone to use a follow-up shape.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setFollowShape(null)}
                      className={`px-2 py-1 rounded-md border text-xs ${followShape === null ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>None</button>
                    {followOptions.map(o => (
                      <button key={o.id} onClick={() => setFollowShape(o.id)}
                        className={`px-2 py-1 rounded-md border text-xs ${followShape === o.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>{o.name}</button>
                    ))}
                    {followActive && <Stepper value={followCount} onChange={v => setFollowMana(clamp(v, 1, chainJumps + 1))} min={1} label="hits" />}
                    {followActive && <Stepper value={followSteps} onChange={v => setFollowSize(clamp(v, 0, MAX_FOLLOW_SIZE))} min={0} label="size" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    1 mana fires it from the main target; each extra mana carries it to one more chained hit (up to {chainJumps + 1}). Each one deals the spell's damage again. Size: up to {MAX_FOLLOW_SIZE} steps, 1 mana each (+1 m blast radius, or a bigger cone). A follow-up Cone points away from where it was hit.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Empower */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground">Empower:</span>
            <Stepper value={empowerMana} onChange={setEmpowerMana} min={0} />
            <span className="text-[10px] text-muted-foreground">mana (+6 {isHealing ? 'HP' : 'dmg'} each)</span>
          </div>

          {/* Spell summary — stacked cards */}
          <div className="rounded-md bg-muted/30 border border-border p-3 space-y-2 text-xs">
            {/* Base bolt */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{selectedBolt.name}</span>
                <span className="text-muted-foreground">1 mana</span>
              </div>
              <p className="text-muted-foreground">{isHealing ? '6 HP healed' : `6 ${elementName} damage`}</p>
            </div>

            {/* Empower */}
            {empowerMana > 0 && (
              <>
                <div className="border-t border-border/50" />
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Empower ×{empowerMana}</span>
                    <span className="text-muted-foreground">{empowerMana} mana</span>
                  </div>
                  <p className="text-muted-foreground">
                    {isHealing
                      ? `+${empowerDmg} bonus healing (${empowerMana} × 6 HP)`
                      : `+${empowerDmg} bonus damage (${empowerMana} × 6 dmg)`
                    }
                  </p>
                </div>
              </>
            )}

            {/* Active modifiers */}
            {modSummaries.map(ms => (
              <div key={ms.id}>
                <div className="border-t border-border/50" />
                <div className="space-y-0.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{ms.label}{ms.mana > 1 ? ` ×${ms.mana}` : ''}</span>
                    <span className="text-muted-foreground">{ms.mana} mana</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{ms.effect}</p>
                </div>
              </div>
            ))}

            {/* Total */}
            {(hasAnyActive || selectedBolt) && (
              <>
                <div className="border-t-2 border-border pt-2">
                  <div className="flex items-center justify-between font-bold text-foreground text-sm">
                    <span>Total</span>
                    <span>
                      {isHealing
                        ? `Heal ${totalDmg} HP`
                        : `${totalDmg} ${elementName} dmg`
                      }
                      {' '}· {totalMana} mana
                    </span>
                  </div>
                  {/* Summary of all effects in one line */}
                  {modSummaries.length > 0 && (
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {modSummaries.map(ms => ms.label).join(' + ')}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Cast button */}
            {selectedBolt && (() => {
              const canCast = currentMana >= totalMana && totalMana > 0;
              return (
                <Button
                  size="sm"
                  className="w-full mt-1"
                  disabled={!canCast}
                  onClick={() => {
                    onSpendMana(totalMana);
                    const spellName = selectedBolt.name + (modSummaries.length > 0 ? ` + ${modSummaries.map(m => m.label).join(' + ')}` : '');
                    toast.success(`Cast ${spellName}`, { description: `Spent ${totalMana} mana` });
                    setSelectedBoltId(null);
                    setActiveModifiers({});
                    setEmpowerMana(0);
                    setFollowShape(null);
                    setFollowMana(1);
                    setFollowSize(0);
                  }}
                >
                  {canCast
                    ? <><Zap className="h-3.5 w-3.5 mr-1.5" />Cast · {totalMana} mana</>
                    : `Not enough mana (${currentMana} / ${totalMana})`
                  }
                </Button>
              );
            })()}
          </div>
        </>
      )}

      {/* Spell map: stays mounted between casts so placed tokens are kept */}
      <SpellMap
        boltName={selectedBolt?.name ?? 'Spell'}
        element={selectedBolt?.element ?? ''}
        isHealing={isHealing}
        blastMana={selectedBolt ? activeModifiers['blast'] ?? 0 : 0}
        waveConeMana={selectedBolt ? waveConeCount : 0}
        chainMana={selectedBolt ? activeModifiers['chain'] ?? 0 : 0}
        followShape={selectedBolt && followActive ? followShape : null}
        followCount={selectedBolt ? followCount : 0}
        followSize={selectedBolt ? followSteps : 0}
      />
    </div>
  );
}

// ── Magic ability row ─────────────────────────────────────────────────────────
function MagicAbilityRow({ ability, taken, locked, canTake, onTake, onRemove, removeBlocked }: {
  ability: MagicAbility;
  taken: boolean;
  locked: boolean;
  canTake: boolean;
  onTake: () => void;
  onRemove: () => void;
  removeBlocked: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (taken) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-primary/10 border border-primary/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <button onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
            <span className="text-xs font-semibold text-foreground">{ability.name}</span>
          </button>
          <Button
            size="sm" variant="ghost"
            className="h-6 text-xs text-destructive px-2"
            onClick={onRemove}
            disabled={removeBlocked}
          >
            Remove
          </Button>
        </div>
        {open && <p className="text-xs text-muted-foreground leading-relaxed px-2.5 pl-7">{ability.description}</p>}
      </div>
    );
  }

  if (locked) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border opacity-50 text-left"
        >
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground flex-1">{ability.name}</span>
          <span className="text-xs text-muted-foreground">Locked</span>
        </button>
        {open && <p className="text-xs text-muted-foreground/70 leading-relaxed px-2.5 pl-7">{ability.description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground flex-1">{ability.name}</span>
        </button>
        <Button size="sm" variant="ghost" className="h-6 text-xs text-primary px-2" onClick={onTake} disabled={!canTake}>
          Take
        </Button>
      </div>
      {open && <p className="text-xs text-muted-foreground leading-relaxed px-2.5 pl-7">{ability.description}</p>}
    </div>
  );
}

// ── School panel ──────────────────────────────────────────────────────────────
function SchoolPanel({ school, takenIds, canAdd, onTake, onRemove }: {
  school: MagicSchool;
  takenIds: Set<string>;
  canAdd: boolean;
  onTake: (school: MagicSchool, ability: MagicAbility) => void;
  onRemove: (abilityId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const takenCount = school.abilities.filter(a => takenIds.has(a.id)).length;

  const isLocked = (a: MagicAbility) => {
    // Special prereq: Storm
    if (a.specialPrereq === 'storm') return !checkStormPrereq(takenIds);
    // Special: Dynamic Illusion needs both physical + mental
    if (a.id === 'mind_dynamic_illusion') return !checkDynamicIllusionPrereq(takenIds);
    // Standard prereq
    if (!a.requiresAbilityId) return false;
    return !takenIds.has(a.requiresAbilityId);
  };

  const isRemoveBlocked = (a: MagicAbility) => {
    // Can't remove if a dependent is taken
    const dependents = school.abilities.filter(x => x.requiresAbilityId === a.id);
    if (dependents.some(d => takenIds.has(d.id))) return true;
    // Dynamic illusion depends on both physical & mental
    if (a.id === 'mind_physical_illusion' || a.id === 'mind_mental_illusion') {
      if (takenIds.has('mind_dynamic_illusion')) return true;
    }
    // Storm depends on lightning tree
    if (a.id === 'lightning_bolt' || a.id === 'chain') {
      if (takenIds.has('storm')) return true;
    }
    return false;
  };

  return (
    <div className={`rounded-lg border ${open ? 'border-primary/30' : 'border-border'} bg-card`}>
      <button className="w-full flex items-center justify-between px-3 py-2.5" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          {SCHOOL_ICONS[school.icon] ?? <Sparkles className="h-4 w-4 text-primary" />}
          <span className="text-sm font-semibold text-foreground">{school.name}</span>
          <span className="text-xs text-muted-foreground">{takenCount} / {school.abilities.length} taken</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {school.elements.map(element => {
            const elementAbilities = school.abilities.filter(a => a.element === element);
            if (elementAbilities.length === 0) return null;
            return (
              <div key={element} className="space-y-1.5">
                <div className="flex items-center gap-1.5 pt-1">
                  {ELEMENT_ICONS[element] ?? null}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{element}</span>
                </div>
                {elementAbilities.map(a => (
                  <MagicAbilityRow
                    key={a.id}
                    ability={a}
                    taken={takenIds.has(a.id)}
                    locked={isLocked(a)}
                    canTake={canAdd}
                    onTake={() => onTake(school, a)}
                    onRemove={() => onRemove(a.id)}
                    removeBlocked={isRemoveBlocked(a)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Magic Tab ────────────────────────────────────────────────────────────
export default function MagicTab() {
  const { character: c, setCharacter } = useChar();
  const manaMax = getManaMax(c);
  const avail = getAvailAbilityPts(c);
  const isGM = c.characterType === 'gm';
  const canAdd = isGM || avail > 0;

  const abilities = c.abilities.map(normalizeAbility);
  const takenMagicIds = new Set(
    abilities.filter(a => a.treeId && MAGIC_SCHOOLS.some(s => s.id === a.treeId)).map(a => a.treeAbilityId!)
  );

  const setMana = (v: number) => setCharacter(p => ({ ...p, mana: { ...p.mana, current: v, max: manaMax } }));

  const takeMagicAbility = (school: MagicSchool, ability: MagicAbility) => {
    if (!canAdd) return;
    const entry: AbilityEntry = {
      id: crypto.randomUUID(),
      name: ability.name,
      description: ability.description,
      treeId: school.id,
      treeAbilityId: ability.id,
    };
    setCharacter(p => ({ ...p, abilities: [...p.abilities, entry] }));
  };

  const removeMagicAbility = (magicAbilityId: string) => {
    setCharacter(p => ({
      ...p,
      abilities: p.abilities.filter(a => {
        const norm = normalizeAbility(a);
        return norm.treeAbilityId !== magicAbilityId;
      }),
    }));
  };

  return (
    <div className="p-4 space-y-5">
      {/* Mana tracker */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Mana</h4>
          <p className="text-xs text-muted-foreground">
            {isGM ? '∞ ability pts' : `${avail} ability slot${avail !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <BoxTracker current={c.mana.current} max={manaMax} onChange={setMana} filledClass="bg-primary" />
        <p className="text-xs text-muted-foreground">max(3+INT+AdvKnow, 3+WIS+Intuition) = {manaMax}</p>
      </div>

      {/* Spell Builder */}
      <SpellBuilder takenIds={takenMagicIds} currentMana={c.mana.current} onSpendMana={(cost) => setMana(Math.max(0, c.mana.current - cost))} />

      {/* Schools */}
      <div className="space-y-2">
        {MAGIC_SCHOOLS.map(school => (
          <SchoolPanel
            key={school.id}
            school={school}
            takenIds={takenMagicIds}
            canAdd={canAdd}
            onTake={takeMagicAbility}
            onRemove={removeMagicAbility}
          />
        ))}
      </div>
    </div>
  );
}
