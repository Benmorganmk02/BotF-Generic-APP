import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import {
  getHandleSizes, getWeaponModDisplay, handednessLabel,
  getMultiplierDisplay, getDamageDie, HEAD_CATEGORIES,
} from '../../utils/weaponData';
import {
  SWORD_PROFICIENCIES, SWORD_THICKNESSES, HEAD_STYLES,
  getSwordProfDef, getSwordThickness, thicknessSummary, SWORD_CLASSIFICATION,
} from '../../utils/swordData';
import type { Weapon } from '../../types/character';
import { genId } from '../../utils/defaults';

interface Props {
  onSave: (w: Weapon) => void;
  onCancel?: () => void;
  initialWeapon?: Weapon;
}

const SWORD_HEADS = HEAD_CATEGORIES.find(c => c.id === 'swords')!;

/** Picks `current` if it's still allowed, otherwise the first allowed option. */
function pick(current: string | undefined, allowed: string[]): string {
  return current && allowed.includes(current) ? current : allowed[0] ?? '';
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="h-8 px-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" /> {value}
      </div>
    </div>
  );
}

export default function SwordBuilder({ onSave, onCancel, initialWeapon }: Props) {
  const { character: c } = useChar();
  const initKey = initialWeapon?.swordProfKey ?? '';
  const initDef = getSwordProfDef(initKey);

  const [name, setName] = useState(initialWeapon?.name ?? '');
  const cls = SWORD_CLASSIFICATION;
  const [profKey, setProfKey] = useState(initKey);
  const [handle, setHandle] = useState(initDef ? pick(initialWeapon?.handleSize, initDef.handles) : '');
  const [blade, setBlade] = useState(initDef ? pick(initialWeapon?.heads?.[0]?.subType, initDef.bladeLengths) : '');
  const [thickness, setThickness] = useState(initDef ? pick(initialWeapon?.bladeThickness, initDef.thicknesses) : '');
  const [headStyle, setHeadStyle] = useState(initDef ? pick(initialWeapon?.headStyle, initDef.headStyles) : '');

  const def = getSwordProfDef(profKey);
  const ownsProf = !!def && c.proficiencies.some(p => p.swordKey === def.key);

  const changeProf = (key: string) => {
    const d = getSwordProfDef(key);
    if (!d) return;
    setProfKey(key);
    setHandle(pick(handle, d.handles));
    setBlade(pick(blade, d.bladeLengths));
    setThickness(pick(thickness, d.thicknesses));
    setHeadStyle(pick(headStyle, d.headStyles));
  };

  const allSizes = getHandleSizes('sword');
  const handleOptions = def ? allSizes.filter(s => def.handles.includes(s.id)) : [];
  const bladeOptions = def ? SWORD_HEADS.subTypes.filter(s => def.bladeLengths.includes(s.id)) : [];
  const thicknessOptions = def ? SWORD_THICKNESSES.filter(t => def.thicknesses.includes(t.id)) : [];
  const styleOptions = def ? HEAD_STYLES.filter(h => def.headStyles.includes(h.id)) : [];

  const sizeOpt = allSizes.find(s => s.id === handle);
  const handedness = sizeOpt?.handedness ?? 'small';
  const weight: 'regular' | 'heavy' = sizeOpt?.heavy ? 'heavy' : 'regular';
  const thick = getSwordThickness(thickness);
  const complete = !!def && !!handle && !!blade && !!thickness && !!headStyle;

  const handleSave = () => {
    if (!name.trim() || !complete) return;
    onSave({
      id: initialWeapon?.id ?? genId(),
      name: name.trim(),
      classification: cls,
      handleType: 'sword',
      handleSize: handle,
      heads: [{ category: 'swords', subType: blade }],
      handedness,
      weight,
      swordProfKey: profKey,
      bladeThickness: thickness,
      headStyle,
      currentGrip: initialWeapon?.currentGrip,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialWeapon ? 'Edit Sword' : 'New Sword'}
      </span>

      <div className="flex gap-2 flex-wrap">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sword name..."
          className="h-8 flex-1 min-w-[140px]" />
        <Badge variant="default" className="h-8 px-3 text-xs">Martial (+1d6)</Badge>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1">Sword Proficiency</p>
        <Select value={profKey} onValueChange={changeProf}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick the proficiency this sword is for..." /></SelectTrigger>
          <SelectContent>
            {SWORD_PROFICIENCIES.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {def && (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            {def.baseFeature}
            {!ownsProf && (
              <span className="block text-amber-500 mt-0.5">
                You haven't taken {def.name} yet — add it in the Proficiencies tab for this sword to roll attacks.
              </span>
            )}
          </p>
        )}
      </div>

      {!def ? (
        <p className="text-xs text-muted-foreground italic">
          Pick a proficiency first — it decides which handle, blade, thickness and head style you can build with.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {handleOptions.length === 1 ? (
              <LockedField label="Handle Size" value={`${handleOptions[0].label} (${handleOptions[0].range})`} />
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Handle Size</p>
                <Select value={handle} onValueChange={setHandle}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {handleOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.label} ({s.range})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {bladeOptions.length === 1 ? (
              <LockedField label="Blade Length" value={`${bladeOptions[0].label} — ${bladeOptions[0].die}`} />
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Blade Length</p>
                <Select value={blade} onValueChange={setBlade}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bladeOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.label} — {s.die}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Blade Thickness</p>
              <Select value={thickness} onValueChange={setThickness}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {thicknessOptions.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label} ({thicknessSummary(t)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Head Style</p>
              <Select value={headStyle} onValueChange={setHeadStyle}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {styleOptions.map(h => <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Derived:</span>
            <Badge variant="outline" className="text-xs">{handednessLabel(handedness)}</Badge>
            <Badge variant={weight === 'heavy' ? 'destructive' : 'secondary'} className="text-xs">
              {weight === 'heavy' ? '⚠ Heavy' : 'Regular'}
            </Badge>
          </div>
        </>
      )}

      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs space-y-0.5 flex-1">
            <div>
              <span className="text-muted-foreground">Weapon Modifier: </span>
              <span className="font-semibold text-foreground">{getWeaponModDisplay(cls, handedness, weight)}</span>
              <span className="text-muted-foreground ml-1 text-[11px]">
                ({cls === 'martial' ? 'Martial +1' : 'Simple +0'}, {handednessLabel(handedness)}{weight === 'heavy' ? ', Heavy +2' : ''})
              </span>
            </div>
            {complete && (
              <>
                <div>
                  <span className="text-muted-foreground">Damage: </span>
                  <span className="font-semibold text-foreground">
                    {getDamageDie('swords', blade)} × {getMultiplierDisplay('swords', blade, handedness)}
                  </span>
                </div>
                {thick && (
                  <div>
                    <span className="text-muted-foreground">Thickness: </span>
                    <span className="font-semibold text-foreground">{thicknessSummary(thick)}</span>
                  </div>
                )}
              </>
            )}
            {!complete && <div className="text-muted-foreground italic">Pick a proficiency to see damage.</div>}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {onCancel && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={onCancel}>Cancel</Button>
            )}
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={!name.trim() || !complete}>
              {initialWeapon ? 'Save Changes' : 'Create Sword'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
