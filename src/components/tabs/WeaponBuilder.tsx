import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import {
  getHandleSizes, getAllowedCategories, getMultiplierDisplay, getDamageDie,
  getWeaponModifier, getWeaponModDisplay, handednessLabel, HEAD_CATEGORIES,
  type HandleType,
} from '../../utils/weaponData';
import type { Weapon } from '../../types/character';
import { genId } from '../../utils/defaults';

interface Props {
  onSave: (w: Weapon) => void;
  onCancel?: () => void;
  initialWeapon?: Weapon;
}

const HANDLE_TYPES: { id: HandleType; label: string }[] = [
  { id: 'polearm', label: 'Polearm' },
  { id: 'standard', label: 'Standard' },
  { id: 'sword', label: 'Sword' },
];

function HeadRow({ head, index, allowedCats, onChange, onRemove, removable }: {
  head: { category: string; subType: string };
  index: number;
  allowedCats: ReturnType<typeof getAllowedCategories>;
  onChange: (cat: string, sub: string) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const cat = allowedCats.find(c => c.id === head.category);
  return (
    <div className="flex gap-1.5 items-center">
      <Select value={head.category} onValueChange={v => onChange(v, '')}>
        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Head type..." /></SelectTrigger>
        <SelectContent>
          {allowedCats.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.label} ({c.baseMultiplier > 0 ? '+' : ''}{c.baseMultiplier}× cat)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={head.subType} onValueChange={v => onChange(head.category, v)} disabled={!head.category}>
        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Sub-type..." /></SelectTrigger>
        <SelectContent>
          {cat?.subTypes.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
              {s.addMultiplier !== 0 ? ` (${s.addMultiplier > 0 ? '+' : ''}${s.addMultiplier}×)` : ''}
              {s.twoHandedAddMultiplier ? ` / +${s.twoHandedAddMultiplier}× 2H` : ''}
              {' — '}{s.die}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {removable ? (
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      ) : <div className="w-8 shrink-0" />}
    </div>
  );
}

export default function WeaponBuilder({ onSave, onCancel, initialWeapon }: Props) {
  const initHT: HandleType = (initialWeapon?.handleType as HandleType) ?? 'standard';
  const initSizes = getHandleSizes(initHT);

  const [name, setName] = useState(initialWeapon?.name ?? '');
  const [cls, setCls] = useState<'simple' | 'martial'>(initialWeapon?.classification ?? 'simple');
  const [ht, setHt] = useState<HandleType>(initHT);
  const [hs, setHs] = useState(initialWeapon?.handleSize ?? initSizes[0]?.id ?? '');
  const [heads, setHeads] = useState<Array<{ category: string; subType: string }>>(
    initialWeapon?.heads?.length ? initialWeapon.heads : [{ category: '', subType: '' }]
  );
  const [handednessOvr, setHandednessOvr] = useState<string | null>(null);
  const [weightOvr, setWeightOvr] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(initialWeapon?.advancedMode ?? false);
  const [attackModOvr, setAttackModOvr] = useState(
    initialWeapon?.attackModOverride != null ? String(initialWeapon.attackModOverride) : ''
  );

  const sizes = getHandleSizes(ht);
  const sizeOpt = sizes.find(s => s.id === hs);
  const derivedHandedness = sizeOpt?.handedness ?? 'small';
  const derivedWeight: 'regular' | 'heavy' = sizeOpt?.heavy ? 'heavy' : 'regular';
  const effectiveHandedness = handednessOvr ?? derivedHandedness;
  const effectiveWeight = (weightOvr ?? derivedWeight) as 'regular' | 'heavy';

  const allowedCats = getAllowedCategories(ht, advanced);
  const multiHead = ht === 'polearm' || ht === 'standard';
  const canAddHead = multiHead && heads.length < 2;

  const weaponMod = advanced && attackModOvr !== ''
    ? (parseInt(attackModOvr) || 0)
    : getWeaponModifier(cls, effectiveHandedness, effectiveWeight);
  const modDisplay = advanced && attackModOvr !== ''
    ? `+${attackModOvr}d6 (override)`
    : getWeaponModDisplay(cls, effectiveHandedness, effectiveWeight);

  const changeHt = (newHt: HandleType) => {
    const newSizes = getHandleSizes(newHt);
    setHt(newHt);
    setHs(newSizes[0]?.id ?? '');
    setHeads([{ category: '', subType: '' }]);
    setHandednessOvr(null);
    setWeightOvr(null);
  };

  const updateHead = (i: number, cat: string, sub: string) =>
    setHeads(prev => prev.map((h, j) => j === i ? { category: cat, subType: sub } : h));

  const handleSave = () => {
    if (!name.trim()) return;
    const weapon: Weapon = {
      id: initialWeapon?.id ?? genId(),
      name: name.trim(),
      classification: cls,
      handleType: ht,
      handleSize: hs,
      heads: heads.filter(h => h.category && h.subType),
      handedness: (effectiveHandedness) as Weapon['handedness'],
      weight: effectiveWeight,
      linkedProficiencyId: initialWeapon?.linkedProficiencyId,
      advancedMode: advanced || undefined,
      attackModOverride: advanced && attackModOvr !== '' ? parseInt(attackModOvr) || 0 : undefined,
    };
    onSave(weapon);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {initialWeapon ? 'Edit Weapon' : 'New Weapon'}
        </span>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="adv-toggle">Advanced</Label>
          <Switch id="adv-toggle" checked={advanced} onCheckedChange={setAdvanced} />
        </div>
      </div>

      {/* Name + Classification */}
      <div className="flex gap-2 flex-wrap">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Weapon name..."
          className="h-8 flex-1 min-w-[140px]" />
        <div className="flex gap-1">
          {(['simple', 'martial'] as const).map(c => (
            <Button key={c} size="sm" variant={cls === c ? 'default' : 'outline'} className="h-8 px-2.5 text-xs capitalize"
              onClick={() => setCls(c)}>
              {c === 'simple' ? 'Simple (+0)' : 'Martial (+1d6)'}
            </Button>
          ))}
        </div>
      </div>

      {/* Handle type + size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Handle Type</p>
          <Select value={ht} onValueChange={v => changeHt(v as HandleType)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HANDLE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Handle Size</p>
          <Select value={hs} onValueChange={v => { setHs(v); setHandednessOvr(null); setWeightOvr(null); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sizes.map(s => <SelectItem key={s.id} value={s.id}>{s.label} ({s.range})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Derived / override handedness + weight */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">Derived:</span>
        {!advanced ? (
          <>
            <Badge variant="outline" className="text-xs">{handednessLabel(effectiveHandedness)}</Badge>
            <Badge variant={effectiveWeight === 'heavy' ? 'destructive' : 'secondary'} className="text-xs">
              {effectiveWeight === 'heavy' ? '⚠ Heavy' : 'Regular'}
            </Badge>
          </>
        ) : (
          <>
            <Select value={effectiveHandedness} onValueChange={v => setHandednessOvr(v)}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="1h">1H</SelectItem>
                <SelectItem value="1h2h">1H / 2H</SelectItem>
                <SelectItem value="2h">2H</SelectItem>
              </SelectContent>
            </Select>
            <Select value={effectiveWeight} onValueChange={v => setWeightOvr(v)}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Weapon heads */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Weapon Head{multiHead ? 's' : ''}
          {allowedCats.length === 1 && <span className="ml-1 text-[11px]">({allowedCats[0].label} only)</span>}
        </p>
        {heads.map((head, i) => (
          <HeadRow
            key={i}
            head={head}
            index={i}
            allowedCats={allowedCats}
            onChange={(cat, sub) => updateHead(i, cat, sub)}
            onRemove={() => setHeads(prev => prev.filter((_, j) => j !== i))}
            removable={i > 0}
          />
        ))}
        {canAddHead && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 w-full"
            onClick={() => setHeads(prev => [...prev, { category: '', subType: '' }])}>
            <Plus className="h-3 w-3" /> Add Second Head
          </Button>
        )}
      </div>

      {/* Advanced attack mod override */}
      {advanced && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Override Attack Mod</span>
          <Input type="number" value={attackModOvr} onChange={e => setAttackModOvr(e.target.value)}
            placeholder="auto" className="h-7 w-20 text-xs text-center" />
          <span className="text-xs text-muted-foreground">d6</span>
        </div>
      )}

      {/* Summary bar */}
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs space-y-0.5 flex-1">
            <div>
              <span className="text-muted-foreground">Weapon Modifier: </span>
              <span className="font-semibold text-foreground">{modDisplay}</span>
              <span className="text-muted-foreground ml-1 text-[11px]">
                ({cls === 'martial' ? 'Martial +1' : 'Simple +0'}, {handednessLabel(effectiveHandedness)}{effectiveWeight === 'heavy' ? ', Heavy +2' : ''})
              </span>
            </div>
            {heads.filter(h => h.category && h.subType).length === 0 && (
              <div className="text-muted-foreground italic">No heads selected — add a weapon head to see damage</div>
            )}
            {heads.filter(h => h.category && h.subType).map((head, i) => {
              const multDisplay = getMultiplierDisplay(head.category, head.subType, effectiveHandedness);
              const die = getDamageDie(head.category, head.subType);
              const catLabel = HEAD_CATEGORIES.find(c => c.id === head.category)?.label ?? '';
              const subLabel = HEAD_CATEGORIES.find(c => c.id === head.category)?.subTypes.find(s => s.id === head.subType)?.label ?? '';
              return (
                <div key={i}>
                  <span className="text-muted-foreground">Damage{heads.filter(h => h.category && h.subType).length > 1 ? ` (Head ${i + 1})` : ''}: </span>
                  <span className="font-semibold text-foreground">{die} × {multDisplay}</span>
                  <span className="text-muted-foreground ml-1 text-[11px]">({catLabel} — {subLabel})</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {onCancel && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={onCancel}>Cancel</Button>
            )}
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={!name.trim()}>
              {initialWeapon ? 'Save Changes' : 'Create Weapon'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
