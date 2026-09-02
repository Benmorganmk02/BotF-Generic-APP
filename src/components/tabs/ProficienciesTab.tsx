import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { Proficiency } from '../../types/character';
import { getAvailProfPts } from '../../utils/mechanics';
import { genId } from '../../utils/defaults';
import ProficiencyCard from '../sheet/ProficiencyCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

type ProfType = 'weapon' | 'vocation' | 'bow' | 'crossbow' | 'firearms';

const PROF_TYPE_DEFAULTS: Record<ProfType, Partial<Proficiency>> = {
  weapon:   { physicalStat: 'str', mentalStat: 'wis' },
  bow:      { physicalStat: 'str', mentalStat: 'dex' },
  crossbow: { attributes: [], skills: [] },
  firearms: { attributes: [], skills: [] },
  vocation: {},
};

export default function ProficienciesTab() {
  const { character: c, setCharacter } = useChar();
  const [name, setName] = useState('');
  const [sp, setSp] = useState<'0' | '1'>('0');
  const [profType, setProfType] = useState<ProfType>('weapon');
  const avail = getAvailProfPts(c);
  const isGM = c.characterType === 'gm';

  const displayProfs = c.proficiencies.map((p, i) => ({ p, i }));

  const moveProf = (displayIdx: number, dir: -1 | 1) => {
    const targetDisplayIdx = displayIdx + dir;
    if (targetDisplayIdx < 0 || targetDisplayIdx >= displayProfs.length) return;
    const fromIdx = displayProfs[displayIdx].i;
    const toIdx = displayProfs[targetDisplayIdx].i;
    setCharacter(prev => {
      const profs = [...prev.proficiencies];
      [profs[fromIdx], profs[toIdx]] = [profs[toIdx], profs[fromIdx]];
      return { ...prev, proficiencies: profs };
    });
  };

  const addProf = () => {
    const n = name.trim();
    if (!n) return;
    const defaults = PROF_TYPE_DEFAULTS[profType];
    const newProf: Proficiency = {
      id: genId(), name: n, level: 0,
      attributes: [], skills: [],
      startingPrime: sp === '1' ? 1 : 0,
      itemBonus: 0, modifier: 0,
      profType,
      ...defaults,
    };
    setCharacter(p => ({ ...p, proficiencies: [...p.proficiencies, newProf] }));
    setName('');
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Proficiencies & Vocations</p>
          <p className="text-xs text-muted-foreground">{isGM ? '∞ pts' : `${avail} pts available`}</p>
        </div>
      </div>

      {/* Add new proficiency form */}
      <div className="flex gap-2 flex-wrap">
        <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProf()}
          placeholder="Name..." className="flex-1 min-w-[140px]" />
        <Select value={profType} onValueChange={v => setProfType(v as ProfType)}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weapon">Melee</SelectItem>
            <SelectItem value="vocation">Vocation</SelectItem>
            <SelectItem value="bow">Bow</SelectItem>
            <SelectItem value="crossbow">Crossbow</SelectItem>
            <SelectItem value="firearms">Firearms</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sp} onValueChange={v => setSp(v as '0' | '1')}>
          <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Easy</SelectItem>
            <SelectItem value="1">Difficult</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={addProf} disabled={!name.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayProfs.map(({ p, i }, displayIdx) => (
          <ProficiencyCard
            key={p.id} prof={p} index={i}
            onMoveUp={displayIdx > 0 ? () => moveProf(displayIdx, -1) : undefined}
            onMoveDown={displayIdx < displayProfs.length - 1 ? () => moveProf(displayIdx, 1) : undefined}
          />
        ))}
      </div>
      {displayProfs.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-4">No proficiencies added yet.</p>
      )}
    </div>
  );
}
