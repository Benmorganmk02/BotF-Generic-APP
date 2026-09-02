import { useChar } from '../../context/CharacterContext';
import { Proficiency, ATTRIBUTE_INFO, SKILL_LABELS, AttributeKey, SkillKey, ATTRIBUTE_KEYS } from '../../types/character';
import { getWeaponModifier, getWeaponModDisplay, getTotalMultiplierForHandedness, getMultiplierDisplay, getDamageDie, parseDieSides, HEAD_CATEGORIES } from '../../utils/weaponData';
import DamageRollButton from '../dice/DamageRollButton';
import {
  getProfDice, calcCostToLevel, getAvailProfPts, getStatChangeCost,
  effAttr, effSkill,
} from '../../utils/mechanics';
import StatModifier from './StatModifier';
import RollButton from '../dice/RollButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ChevronUp, ChevronDown, Link, Unlink, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props { prof: Proficiency; index: number; onMoveUp?: () => void; onMoveDown?: () => void; }

const SKILL_KEYS = Object.keys(SKILL_LABELS) as SkillKey[];

function WeaponStatPickers({ prof, update }: { prof: Proficiency; update: (p: Partial<Proficiency>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Physical</p>
        <Select value={prof.physicalStat ?? 'str'} onValueChange={v => update({ physicalStat: v as 'str' | 'dex' })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="str">STR</SelectItem><SelectItem value="dex">DEX</SelectItem></SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Mental</p>
        <Select value={prof.mentalStat ?? 'wis'} onValueChange={v => update({ mentalStat: v as 'wis' | 'int' })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="wis">WIS</SelectItem><SelectItem value="int">INT</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BowMentalStatPicker({ prof, update }: { prof: Proficiency; update: (p: Partial<Proficiency>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Physical (locked)</p>
        <div className="h-7 px-2 flex items-center rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">STR</div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Mental (aim/attack)</p>
        <Select value={prof.mentalStat ?? 'dex'} onValueChange={v => update({ mentalStat: v as 'int' | 'dex' })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="int">INT</SelectItem><SelectItem value="dex">DEX</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  );
}

function VocationStatPickers({ prof, update }: { prof: Proficiency; update: (p: Partial<Proficiency>) => void }) {
  const attrVal = prof.attributes[0] ?? '';
  const sk1 = prof.skills[0] ?? '';
  const sk2 = prof.skills[1] ?? '';
  const setAttr = (v: string) => update({ attributes: v ? [v as AttributeKey] : [] });
  const setSkill = (idx: 0 | 1, v: string) => {
    const skills = [...prof.skills] as SkillKey[];
    if (v) skills[idx] = v as SkillKey; else skills.splice(idx, 1);
    update({ skills: skills.slice(0, 2) });
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Attribute</p>
        <Select value={attrVal} onValueChange={setAttr}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {ATTRIBUTE_KEYS.map(k => <SelectItem key={k} value={k}>{ATTRIBUTE_INFO[k].abbr}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Skill 1</p>
        <Select value={sk1} onValueChange={v => setSkill(0, v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {SKILL_KEYS.map(k => <SelectItem key={k} value={k}>{SKILL_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Skill 2</p>
        <Select value={sk2} onValueChange={v => setSkill(1, v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {SKILL_KEYS.map(k => <SelectItem key={k} value={k}>{SKILL_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function buildCalcStr(
  prof: Proficiency, profDice: number,
  c: Parameters<typeof effAttr>[0]
): string {
  if ((prof.profType === 'weapon' || prof.profType === 'bow') && prof.physicalStat && prof.mentalStat) {
    const ps = prof.physicalStat.toUpperCase(); const ms = prof.mentalStat.toUpperCase();
    const suffix = prof.profType === 'bow' ? ' (bow attack)' : '';
    return `3 + ${ps}(${effAttr(c, prof.physicalStat)}) + ${ms}(${effAttr(c, prof.mentalStat)}) + Lv(${prof.level}) + Mod(${prof.modifier}) + Item(${prof.itemBonus}) = ${profDice}d6${suffix}`;
  }
  if (prof.profType === 'crossbow') {
    return `3 + Lv(${prof.level}) + Mod(${prof.modifier}) + Item(${prof.itemBonus}) = ${profDice}d6 (aim bonus)`;
  }
  if (prof.profType === 'firearms') {
    return `3 + Lv(${prof.level}) + Mod(${prof.modifier}) + Item(${prof.itemBonus}) = ${profDice}d6 (aim bonus — placeholder)`;
  }
  if (prof.profType === 'vocation') {
    const attrParts = prof.attributes.map(a => ` + ${ATTRIBUTE_INFO[a].abbr}(${effAttr(c, a)})`).join('');
    const skillParts = prof.skills.map(s => ` + ${SKILL_LABELS[s]}Lv(${effSkill(c, s)})`).join('');
    return `3 + Lv(${prof.level}) + Mod(${prof.modifier}) + Item(${prof.itemBonus})${attrParts}${skillParts} = ${profDice}d6`;
  }
  const attrParts = prof.attributes.map(a => ` + ${ATTRIBUTE_INFO[a].abbr}(${effAttr(c, a)})`).join('');
  const skillParts = prof.skills.map(s => ` + ${SKILL_LABELS[s]}(${effSkill(c, s)})`).join('');
  return `3 + Lv(${prof.level}) + Mod(${prof.modifier}) + Item(${prof.itemBonus})${attrParts}${skillParts} = ${profDice}d6`;
}

function WeaponProfLink({ prof, profDice }: { prof: Proficiency; profDice: number }) {
  const { character: c } = useChar();
  const linkedWeapons = (c.weapons ?? []).filter(w => w.linkedProficiencyId === prof.id);

  return (
    <div className="space-y-2 pt-1 border-t border-border/50">
      {linkedWeapons.length === 0 ? (
        <p className="text-xs text-muted-foreground italic flex items-center gap-1.5 py-0.5">
          <Unlink className="h-3 w-3 shrink-0" /> No weapons linked — assign from the Weapons tab.
        </p>
      ) : linkedWeapons.map(weapon => {
        const grip = weapon.handedness === '1h2h' ? (weapon.currentGrip ?? '1h') : weapon.handedness;
        const weaponMod = weapon.attackModOverride != null
          ? weapon.attackModOverride
          : getWeaponModifier(weapon.classification, grip, weapon.weight);
        const totalDice = profDice + weaponMod;
        const validHeads = weapon.heads.filter(h => h.category && h.subType);
        return (
          <div key={weapon.id} className="rounded bg-primary/5 border border-primary/20 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Link className="h-3 w-3 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{weapon.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">
                  Atk: <span className="font-bold text-foreground">{totalDice}d6</span>
                </span>
                <RollButton label={`${prof.name} + ${weapon.name}`} diceCount={totalDice} size="sm" />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Prof({profDice}d6) + Mod(+{weaponMod}d6)
            </div>
            {validHeads.map((h, i) => {
              const mult = getTotalMultiplierForHandedness(h.category, h.subType, grip);
              const multDisplay = getMultiplierDisplay(h.category, h.subType, grip);
              const die = getDamageDie(h.category, h.subType);
              const catLabel = HEAD_CATEGORIES.find(cat => cat.id === h.category)?.label ?? h.category;
              const subLabel = HEAD_CATEGORIES.find(cat => cat.id === h.category)?.subTypes.find(s => s.id === h.subType)?.label ?? h.subType;
              return (
                <div key={i} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted-foreground">
                    {validHeads.length > 1 ? `H${i + 1} ` : ''}
                    <span className="font-semibold text-foreground">{die} × {multDisplay}</span>
                    <span className="text-[10px] ml-1">({catLabel} — {subLabel})</span>
                  </span>
                  <DamageRollButton label={`${weapon.name} — ${catLabel} (${subLabel})`} multiplier={mult} dieSides={parseDieSides(die)} size="sm" />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function RangedProfLink({ prof }: { prof: Proficiency }) {
  const { character: c } = useChar();
  const isBow = prof.profType === 'bow';
  const linkedItems = isBow
    ? (c.bows ?? []).filter(b => b.linkedProficiencyId === prof.id)
    : (c.crossbows ?? []).filter(x => x.linkedProficiencyId === prof.id);

  if (linkedItems.length === 0) return (
    <div className="pt-1 border-t border-border/50">
      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5 py-0.5">
        <Unlink className="h-3 w-3 shrink-0" />
        No {isBow ? 'bows' : 'crossbows'} linked — assign from the Weapons tab.
      </p>
    </div>
  );

  return (
    <div className="pt-1 border-t border-border/50 space-y-1">
      {linkedItems.map(item => (
        <div key={item.id} className="flex items-center gap-1.5 text-xs">
          <Link className="h-3 w-3 text-primary shrink-0" />
          <span className="text-foreground font-medium">{item.name}</span>
          <span className="text-muted-foreground">— see Weapons tab for rolls</span>
        </div>
      ))}
    </div>
  );
}

export default function ProficiencyCard({ prof, index, onMoveUp, onMoveDown }: Props) {
  const { character: c, setCharacter } = useChar();
  const isGM = c.characterType === 'gm';
  const avail = getAvailProfPts(c);
  const profDice = getProfDice(c, prof);
  const dice = profDice;
  const incCost = getStatChangeCost(prof.level, 1, prof.startingPrime);
  const canInc = isGM || avail >= incCost;
  const canDec = prof.level > 0;
  const calcStr = buildCalcStr(prof, profDice, c);

  const update = (patch: Partial<Proficiency>) =>
    setCharacter(p => ({ ...p, proficiencies: p.proficiencies.map((pr, i) => i === index ? { ...pr, ...patch } : pr) }));
  const remove = () => setCharacter(p => ({ ...p, proficiencies: p.proficiencies.filter((_, i) => i !== index) }));

  const isRanged = prof.profType === 'bow' || prof.profType === 'crossbow' || prof.profType === 'firearms';

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {prof.profType === 'weapon' && <Badge variant="outline" className="text-xs shrink-0 border-primary/50 text-primary">Melee</Badge>}
          {prof.profType === 'vocation' && <Badge variant="outline" className="text-xs shrink-0">Vocation</Badge>}
          {prof.profType === 'bow' && <Badge variant="outline" className="text-xs shrink-0 border-amber-500/50 text-amber-500">Bow</Badge>}
          {prof.profType === 'crossbow' && <Badge variant="outline" className="text-xs shrink-0 border-sky-500/50 text-sky-500">Crossbow</Badge>}
          {prof.profType === 'firearms' && <Badge variant="outline" className="text-xs shrink-0 border-destructive/60 text-destructive">Firearms</Badge>}
          <span className="font-medium text-sm text-foreground truncate">{prof.name}</span>
          {prof.startingPrime === 1 && <Badge variant="outline" className="text-xs shrink-0">Hard</Badge>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(onMoveUp !== undefined || onMoveDown !== undefined) && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp} disabled={!onMoveUp}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown} disabled={!onMoveDown}><ArrowDown className="h-3 w-3" /></Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={remove}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => update({ level: prof.level + 1 })} disabled={!canInc}><ChevronUp className="h-3 w-3" /></Button>
          <span className="text-xl font-bold text-foreground min-w-[2rem] text-center">{prof.level}</span>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => update({ level: Math.max(0, prof.level - 1) })} disabled={!canDec}><ChevronDown className="h-3 w-3" /></Button>
        </div>
        <div className="ml-auto text-right text-sm">
          <div className="flex items-center gap-1 justify-end">
            <span className="font-semibold text-foreground">{dice}d6</span>
            <RollButton label={prof.name} diceCount={dice} size="sm" />
          </div>
          {!isGM && <div className="text-xs text-muted-foreground">Cost: {calcCostToLevel(prof.level, prof.startingPrime)}</div>}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground text-xs">Item+</span>
          <Input type="number" value={prof.itemBonus} onChange={e => update({ itemBonus: +e.target.value })} className="h-6 w-14 text-xs px-1" />
        </div>
      </div>

      {prof.profType === 'weapon' && <WeaponStatPickers prof={prof} update={update} />}
      {prof.profType === 'bow' && <BowMentalStatPicker prof={prof} update={update} />}
      {prof.profType === 'vocation' && <VocationStatPickers prof={prof} update={update} />}
      {prof.profType === 'firearms' && (
        <p className="text-xs text-muted-foreground italic bg-muted/30 rounded px-2 py-1">
          Firearms weapon builder coming soon — proficiency tracked for future use.
        </p>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 font-mono leading-relaxed break-words">{calcStr}</div>

      {prof.profType === 'weapon' && <WeaponProfLink prof={prof} profDice={profDice} />}
      {(prof.profType === 'bow' || prof.profType === 'crossbow') && <RangedProfLink prof={prof} />}

      <StatModifier value={prof.modifier} onChange={v => update({ modifier: v })} label="Modifier" />
    </div>
  );
}
