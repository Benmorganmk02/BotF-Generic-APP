import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { getAvailAttrPts, getAvailSkillPts, getAvailAbilityPts, getAvailProfPts, getHPMax } from '../../utils/mechanics';
import { createDefaultCharacter } from '../../utils/defaults';
import { getWorld } from '../../data/worlds';
import { applyMagicSource } from '../../utils/magic';
import PointPoolCard from '../sheet/PointPoolCard';
import LevelUpModal from '../sheet/LevelUpModal';
import ResetDialog from '../sheet/ResetDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function CharacterInfoTab({ onReset }: { onReset?: () => void }) {
  const { character: c, setCharacter } = useChar();
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const isGM = c.characterType === 'gm';

  const setField = (k: string, v: string | number) => setCharacter(p => ({ ...p, [k]: v }));
  const setBonus = (k: keyof typeof c.bonusPoints, delta: number) => {
    setCharacter(p => ({ ...p, bonusPoints: { ...p.bonusPoints, [k]: Math.max(0, p.bonusPoints[k] + delta) } }));
  };

  const handleLevelUp = () => {
    setCharacter(p => {
      const newLvl = p.level + 1;
      const newHP = getHPMax(newLvl);
      return { ...p, level: newLvl, hitPoints: { current: newHP, max: newHP } };
    });
    toast.success(`Leveled up to ${c.level + 1}!`);
  };
  const handleLevelDown = () => {
    if (c.level === 0) return;
    setCharacter(p => ({ ...p, level: p.level - 1 }));
    toast.info(`Leveled down to ${c.level - 1}.`);
  };
  const handleReset = () => {
    const fresh = createDefaultCharacter(c.characterType, c.name, c.player);
    setCharacter(p => applyMagicSource({
      ...fresh, id: p.id, cloudId: p.cloudId,
      name: p.name, player: p.player, race: p.race, bodyType: p.bodyType, age: p.age,
      world: p.world, archetype: p.archetype, background: p.background,
      disablingCharacteristics: p.disablingCharacteristics, inherentCharacteristics: p.inherentCharacteristics,
      armor: p.armor, loadout: p.loadout, inventory: p.inventory, notes: p.notes,
    }, p.magicSource));
    toast.success('Character stats reset.');
  };

  const pools = [
    { label: 'Attribute', key: 'attribute' as const, val: getAvailAttrPts(c), color: 'border-blue-500/40' },
    { label: 'Skill', key: 'skill' as const, val: getAvailSkillPts(c), color: 'border-green-500/40' },
    { label: 'Ability', key: 'ability' as const, val: getAvailAbilityPts(c), color: 'border-purple-500/40' },
    { label: 'Proficiency', key: 'proficiency' as const, val: getAvailProfPts(c), color: 'border-amber-500/40' },
  ];

  const fields = [
    { key: 'name', label: 'Name' }, { key: 'player', label: 'Player' }, { key: 'race', label: 'Race' },
    { key: 'bodyType', label: 'Body Type' }, { key: 'age', label: 'Age' },
    { key: 'disablingCharacteristics', label: 'Disabling Characteristic', placeholder: 'Missing left arm, Blind in one eye' },
    { key: 'inherentCharacteristics', label: 'Inherent Characteristic', placeholder: 'Darkvision, Stonecunning' },
  ];

  return (
    <div className="p-4 space-y-6">
      {isGM && <div className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm text-amber-400 font-medium">⚠ GM/NPC Mode — Infinite points, no restrictions</div>}

      {(c.world || c.archetype || c.background) && (
        <div className="flex flex-wrap gap-2">
          {c.world && <Badge variant="outline">{getWorld(c.world)?.name ?? c.world}</Badge>}
          {c.archetype && <Badge variant="secondary">{c.archetype}</Badge>}
          {c.background && <Badge variant="secondary">{c.background} background</Badge>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input value={(c as unknown as Record<string, string>)[key] ?? ''} onChange={e => setField(key, e.target.value)}
              placeholder={placeholder ?? label} className="h-8" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleLevelDown} disabled={c.level === 0}><ChevronDown className="h-4 w-4" /></Button>
          <div className="text-center"><p className="text-xs text-muted-foreground">Level</p><p className="text-2xl font-bold text-foreground">{c.level}</p></div>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setLevelUpOpen(true)}><ChevronUp className="h-4 w-4" /></Button>
        </div>
        <Badge variant="secondary">{c.characterType === 'gm' ? 'GM/NPC' : 'Normal'}</Badge>
        <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} className="ml-auto">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset Stats
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {pools.map(({ label, key, val, color }) => (
          <PointPoolCard key={key} label={label} available={val} bonus={c.bonusPoints[key]}
            onBonusChange={d => setBonus(key, d)} isGM={isGM} colorClass={color} />
        ))}
      </div>

      <LevelUpModal open={levelUpOpen} onClose={() => setLevelUpOpen(false)} onConfirm={handleLevelUp} character={c} />
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={handleReset} />
    </div>
  );
}
