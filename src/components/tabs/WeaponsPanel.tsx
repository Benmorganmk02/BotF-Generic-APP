import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import type { Weapon, Bow, Crossbow } from '../../types/character';
import WeaponBuilder from './WeaponBuilder';
import BowBuilder from './BowBuilder';
import CrossbowBuilder from './CrossbowBuilder';
import BowCard from './BowCard';
import CrossbowCard from './CrossbowCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit2, Plus, Link, Unlink, ArrowUp, ArrowDown } from 'lucide-react';
import {
  getTotalMultiplierForHandedness, getMultiplierDisplay, getDamageDie,
  getWeaponModifier,
  handednessLabel, getHandleTypeLabel, getHandleSizes, HEAD_CATEGORIES, parseDieSides,
} from '../../utils/weaponData';
import { getProfDice } from '../../utils/mechanics';
import RollButton from '../dice/RollButton';
import DamageRollButton from '../dice/DamageRollButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// ── Helpers ───────────────────────────────────────────────────────────────────
function weaponSummaryLine(w: Weapon): string {
  const ht = getHandleTypeLabel(w.handleType);
  const sizes = getHandleSizes(w.handleType as Parameters<typeof getHandleSizes>[0]);
  const sizeLabel = sizes.find(s => s.id === w.handleSize)?.label ?? w.handleSize;
  const sizeRange = sizes.find(s => s.id === w.handleSize)?.range ?? '';
  const headParts = w.heads.map(h => {
    const catLabel = HEAD_CATEGORIES.find(c => c.id === h.category)?.label ?? h.category;
    const subLabel = HEAD_CATEGORIES.find(c => c.id === h.category)?.subTypes.find(s => s.id === h.subType)?.label ?? h.subType;
    return `${catLabel} (${subLabel})`;
  }).join(' + ');
  return `${ht} Handle — ${sizeLabel} (${sizeRange})${headParts ? ` · ${headParts}` : ''}`;
}

// ── Weapon Card ───────────────────────────────────────────────────────────────
function WeaponCard({ weapon, onEdit, onDelete, onMoveUp, onMoveDown }: {
  weapon: Weapon;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { character: c, setCharacter } = useChar();
  const weaponProfs = c.proficiencies.filter(p => p.profType === 'weapon' && !p.isForceSchool);
  const linkedProf = weapon.linkedProficiencyId ? c.proficiencies.find(p => p.id === weapon.linkedProficiencyId) : undefined;
  const profDice = linkedProf ? getProfDice(c, linkedProf) : 0;
  const grip = weapon.handedness === '1h2h' ? (weapon.currentGrip ?? '1h') : weapon.handedness;
  const weaponMod = weapon.attackModOverride != null
    ? weapon.attackModOverride
    : getWeaponModifier(weapon.classification, grip, weapon.weight);
  const totalAttackDice = profDice + weaponMod;
  const validHeads = weapon.heads.filter(h => h.category && h.subType);

  const toggleGrip = (g: '1h' | '2h') => {
    setCharacter(p => ({
      ...p,
      weapons: p.weapons.map(w => w.id === weapon.id ? { ...w, currentGrip: g } : w),
    }));
  };

  const linkProf = (profId: string) => {
    const newId = profId === '__none__' ? undefined : profId;
    setCharacter(p => ({
      ...p,
      weapons: p.weapons.map(w => w.id === weapon.id ? { ...w, linkedProficiencyId: newId } : w),
    }));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm text-foreground">{weapon.name}</span>
            <Badge variant={weapon.classification === 'martial' ? 'default' : 'outline'} className="text-xs">
              {weapon.classification === 'martial' ? 'Martial' : 'Simple'}
            </Badge>
            <Badge variant="secondary" className="text-xs">{handednessLabel(weapon.handedness)}</Badge>
            {weapon.weight === 'heavy' && <Badge variant="destructive" className="text-xs">Heavy</Badge>}
            {weapon.handedness === '1h2h' && (
              <div className="inline-flex rounded-md border border-border overflow-hidden ml-1">
                <button onClick={() => toggleGrip('1h')} className={`px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${grip === '1h' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>1H</button>
                <button onClick={() => toggleGrip('2h')} className={`px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${grip === '2h' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>2H</button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{weaponSummaryLine(weapon)}</p>
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
                <AlertDialogTitle>Delete {weapon.name}?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the weapon from your character.</AlertDialogDescription>
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
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-muted-foreground">Weapon Mod: </span>
            <span className="font-semibold text-foreground">+{weaponMod}d6</span>
            {linkedProf && (
              <span className="text-muted-foreground ml-1.5">
                → Atk: <span className="font-bold text-foreground">{totalAttackDice}d6</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {linkedProf ? (
              <RollButton label={`${weapon.name} Attack (${linkedProf.name})`} diceCount={totalAttackDice} size="sm" />
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Link prof for attack</span>
            )}
          </div>
        </div>

        {validHeads.map((h, i) => {
          const mult = getTotalMultiplierForHandedness(h.category, h.subType, grip);
          const multDisplay = getMultiplierDisplay(h.category, h.subType, grip);
          const die = getDamageDie(h.category, h.subType);
          const catLabel = HEAD_CATEGORIES.find(cat => cat.id === h.category)?.label ?? h.category;
          const subLabel = HEAD_CATEGORIES.find(cat => cat.id === h.category)?.subTypes.find(s => s.id === h.subType)?.label ?? h.subType;
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Dmg{validHeads.length > 1 ? ` H${i + 1}` : ''}: </span>
                <span className="font-semibold text-foreground">{die} × {multDisplay}</span>
                <span className="text-muted-foreground text-[10px] ml-1">({catLabel} — {subLabel})</span>
              </div>
              <DamageRollButton
                label={`${weapon.name} — ${catLabel} (${subLabel})`}
                multiplier={mult}
                dieSides={parseDieSides(die)}
                size="sm"
              />
            </div>
          );
        })}
        {validHeads.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">No heads configured — edit to add damage.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {linkedProf ? <Link className="h-3 w-3 text-primary shrink-0" /> : <Unlink className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-xs text-muted-foreground shrink-0">Proficiency:</span>
        <Select value={weapon.linkedProficiencyId ?? '__none__'} onValueChange={linkProf}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Unlinked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unlinked</SelectItem>
            {weaponProfs.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
type BuilderMode = 'weapon' | 'bow' | 'crossbow' | null;

export default function WeaponsPanel() {
  const { character: c, setCharacter } = useChar();
  const weapons = c.weapons ?? [];
  const bows = c.bows ?? [];
  const crossbows = c.crossbows ?? [];
  const [builderMode, setBuilderMode] = useState<BuilderMode>(null);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | undefined>(undefined);
  const [editingBow, setEditingBow] = useState<Bow | undefined>(undefined);
  const [editingCrossbow, setEditingCrossbow] = useState<Crossbow | undefined>(undefined);

  const saveWeapon = (w: Weapon) => {
    setCharacter(p => { const ws = p.weapons ?? []; const idx = ws.findIndex(x => x.id === w.id); return { ...p, weapons: idx >= 0 ? ws.map((x, i) => i === idx ? w : x) : [...ws, w] }; });
    setBuilderMode(null); setEditingWeapon(undefined);
  };
  const saveBow = (b: Bow) => {
    setCharacter(p => { const bs = p.bows ?? []; const idx = bs.findIndex(x => x.id === b.id); return { ...p, bows: idx >= 0 ? bs.map((x, i) => i === idx ? b : x) : [...bs, b] }; });
    setBuilderMode(null); setEditingBow(undefined);
  };
  const saveCrossbow = (x: Crossbow) => {
    setCharacter(p => { const xs = p.crossbows ?? []; const idx = xs.findIndex(c => c.id === x.id); return { ...p, crossbows: idx >= 0 ? xs.map((c, i) => i === idx ? x : c) : [...xs, x] }; });
    setBuilderMode(null); setEditingCrossbow(undefined);
  };

  const deleteWeapon = (id: string) => setCharacter(p => ({ ...p, weapons: (p.weapons ?? []).filter(w => w.id !== id) }));
  const deleteBow = (id: string) => setCharacter(p => ({ ...p, bows: (p.bows ?? []).filter(b => b.id !== id) }));
  const deleteCrossbow = (id: string) => setCharacter(p => ({ ...p, crossbows: (p.crossbows ?? []).filter(x => x.id !== id) }));

  const swapAt = <T,>(arr: T[], i: number, j: number): T[] => {
    const next = [...arr]; [next[i], next[j]] = [next[j], next[i]]; return next;
  };
  const moveWeapon = (idx: number, dir: -1 | 1) => {
    const t = idx + dir; if (t < 0 || t >= weapons.length) return;
    setCharacter(p => ({ ...p, weapons: swapAt(p.weapons ?? [], idx, t) }));
  };
  const moveBow = (idx: number, dir: -1 | 1) => {
    const t = idx + dir; if (t < 0 || t >= bows.length) return;
    setCharacter(p => ({ ...p, bows: swapAt(p.bows ?? [], idx, t) }));
  };
  const moveCrossbow = (idx: number, dir: -1 | 1) => {
    const t = idx + dir; if (t < 0 || t >= crossbows.length) return;
    setCharacter(p => ({ ...p, crossbows: swapAt(p.crossbows ?? [], idx, t) }));
  };

  const cancelBuilder = () => { setBuilderMode(null); setEditingWeapon(undefined); setEditingBow(undefined); setEditingCrossbow(undefined); };

  const hasNothing = weapons.length === 0 && bows.length === 0 && crossbows.length === 0;

  return (
    <div className="p-4 space-y-4">
      {builderMode === 'weapon' && <WeaponBuilder onSave={saveWeapon} onCancel={cancelBuilder} initialWeapon={editingWeapon} />}
      {builderMode === 'bow' && <BowBuilder onSave={saveBow} onCancel={cancelBuilder} initialBow={editingBow} />}
      {builderMode === 'crossbow' && <CrossbowBuilder onSave={saveCrossbow} onCancel={cancelBuilder} initialCrossbow={editingCrossbow} />}

      {!builderMode && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 h-9 flex-1 min-w-[120px]" onClick={() => setBuilderMode('weapon')}>
            <Plus className="h-4 w-4" /> Add Weapon
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-9 flex-1 min-w-[100px]" onClick={() => setBuilderMode('bow')}>
            <Plus className="h-4 w-4" /> Add Bow
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-9 flex-1 min-w-[120px]" onClick={() => setBuilderMode('crossbow')}>
            <Plus className="h-4 w-4" /> Add Crossbow
          </Button>
        </div>
      )}

      {!builderMode && weapons.length > 0 && (
        <div className="space-y-3">
          {weapons.map((w, idx) => (
            <WeaponCard key={w.id} weapon={w}
              onEdit={() => { setEditingWeapon(w); setBuilderMode('weapon'); }}
              onDelete={() => deleteWeapon(w.id)}
              onMoveUp={idx > 0 ? () => moveWeapon(idx, -1) : undefined}
              onMoveDown={idx < weapons.length - 1 ? () => moveWeapon(idx, 1) : undefined}
            />
          ))}
        </div>
      )}

      {!builderMode && bows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bows</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {bows.map((b, idx) => (
            <BowCard key={b.id} bow={b}
              onEdit={() => { setEditingBow(b); setBuilderMode('bow'); }}
              onDelete={() => deleteBow(b.id)}
              onMoveUp={idx > 0 ? () => moveBow(idx, -1) : undefined}
              onMoveDown={idx < bows.length - 1 ? () => moveBow(idx, 1) : undefined}
            />
          ))}
        </div>
      )}

      {!builderMode && crossbows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Crossbows</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {crossbows.map((x, idx) => (
            <CrossbowCard key={x.id} crossbow={x}
              onEdit={() => { setEditingCrossbow(x); setBuilderMode('crossbow'); }}
              onDelete={() => deleteCrossbow(x.id)}
              onMoveUp={idx > 0 ? () => moveCrossbow(idx, -1) : undefined}
              onMoveDown={idx < crossbows.length - 1 ? () => moveCrossbow(idx, 1) : undefined}
            />
          ))}
        </div>
      )}

      {!builderMode && hasNothing && (
        <p className="text-sm text-muted-foreground italic text-center py-6">No weapons yet. Build one above.</p>
      )}
    </div>
  );
}
