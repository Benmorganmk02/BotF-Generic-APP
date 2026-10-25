import { useState } from 'react';
import { Character } from '../types/character';
import { CharacterProvider } from '../context/CharacterContext';
import { DiceRollProvider } from '../context/DiceRollContext';
import { CombatProvider } from '../context/CombatContext';
import { saveLocalCharacter } from '../utils/storage';
import { getAvailAttrPts, getAvailSkillPts, getAvailAbilityPts, getAvailProfPts, getReactionCount } from '../utils/mechanics';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Save, Loader2 } from 'lucide-react';
import CharacterInfoTab from './tabs/CharacterInfoTab';
import AttributesTab from './tabs/AttributesTab';
import SkillsTab from './tabs/SkillsTab';
import AbilitiesTab from './tabs/AbilitiesTab';
import ProficienciesTab from './tabs/ProficienciesTab';
import ArmorEquipmentTab from './tabs/ArmorEquipmentTab';
import MagicTab from './tabs/MagicTab';
import DiceRollPanel from './dice/DiceRollPanel';
import DiceResultModal from './dice/DiceResultModal';

interface Props {
  initialCharacter: Character;
  onSave: (char: Character) => Promise<{ cloudId?: string } | void>;
  onHome: () => void;
  campaignMode?: boolean;
}

const TYPE_LABELS: Record<string, string> = { normal: 'Normal', gm: 'GM/NPC' };

function CompactPool({ label, value, isGM }: { label: string; value: number; isGM: boolean }) {
  const display = isGM ? '∞' : value.toString();
  const isNeg = !isGM && value < 0;
  return (
    <div className="flex flex-col items-center min-w-[44px]">
      <span className={`text-sm font-bold leading-none ${isNeg ? 'text-destructive' : 'text-foreground'}`}>{display}</span>
      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</span>
    </div>
  );
}

export default function CharacterSheet({ initialCharacter, onSave, onHome, campaignMode }: Props) {
  const [character, setCharacterState] = useState<Character>(initialCharacter);
  const [saving, setSaving] = useState(false);

  const setCharacter = (updater: Character | ((prev: Character) => Character)) => {
    setCharacterState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalCharacter(next);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await onSave(character);
      if (result?.cloudId && !character.cloudId) {
        setCharacterState(prev => {
          const updated = { ...prev, cloudId: result.cloudId };
          saveLocalCharacter(updated);
          return updated;
        });
      }
    } finally { setSaving(false); }
  };

  return (
    <CharacterProvider character={character} setCharacter={setCharacter}>
      <DiceRollProvider>
       <CombatProvider>
        <div className="min-h-screen bg-background flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            {/* Row 1: nav + name + save */}
            <div className="px-4 py-2 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onHome}><Home className="h-4 w-4" /></Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-foreground truncate">{character.name || 'Unnamed Character'}</h1>
                  <Badge variant="secondary" className="text-xs">{TYPE_LABELS[character.characterType]}</Badge>
                  {campaignMode && <Badge className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40">Campaign Copy</Badge>}
                  <span className="text-xs text-muted-foreground">Lvl {character.level}</span>
                  {character.player && <span className="text-xs text-muted-foreground hidden sm:inline">· {character.player}</span>}
                  {character.race && <span className="text-xs text-muted-foreground hidden md:inline">· {character.race}</span>}
                </div>
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            </div>
            {/* Row 2: compact point pools + action economy */}
            {character.characterType !== 'gm' && (
              <div className="px-4 pb-2 flex items-center gap-4 border-t border-border/50 flex-wrap">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0 pt-1.5">Points:</span>
                <div className="flex gap-4 pt-1.5 flex-wrap">
                  <CompactPool label="Attr" value={getAvailAttrPts(character)} isGM={false} />
                  <CompactPool label="Skill" value={getAvailSkillPts(character)} isGM={false} />
                  <CompactPool label="Ability" value={getAvailAbilityPts(character)} isGM={false} />
                  <CompactPool label="Prof" value={getAvailProfPts(character)} isGM={false} />
                </div>
                <div className="h-6 w-px bg-border/60 hidden sm:block pt-1.5" />
                <div className="flex gap-3 pt-1.5">
                  <div className="flex flex-col items-center min-w-[44px]">
                    <span className="text-sm font-bold leading-none text-foreground">1</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">Action</span>
                  </div>
                  <div className="flex flex-col items-center min-w-[44px]">
                    <span className="text-sm font-bold leading-none text-foreground">{getReactionCount(character)}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">Reactions</span>
                  </div>
                </div>
              </div>
            )}
            {character.characterType === 'gm' && (
              <div className="px-4 pb-1.5 border-t border-border/50">
                <span className="text-[10px] text-amber-400 uppercase tracking-wide">GM/NPC — Infinite Points</span>
              </div>
            )}
          </div>

          <Tabs defaultValue="info" className="flex-1 flex flex-col">
            <div className="px-4 pt-3">
              <TabsList className="flex-wrap h-auto gap-1 w-full">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="attributes">Attributes</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="abilities">Abilities</TabsTrigger>
                <TabsTrigger value="magic">Magic</TabsTrigger>
                <TabsTrigger value="proficiencies">Prof & Voc</TabsTrigger>
                <TabsTrigger value="armor">Armor & Equipment</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto pb-16">
              <TabsContent value="info"><CharacterInfoTab /></TabsContent>
              <TabsContent value="attributes"><AttributesTab /></TabsContent>
              <TabsContent value="skills"><SkillsTab /></TabsContent>
              <TabsContent value="abilities"><AbilitiesTab /></TabsContent>
              {/* Kept mounted (just hidden) so the spell builder and map keep their state while you visit other tabs */}
              <TabsContent value="magic" forceMount className="data-[state=inactive]:hidden"><MagicTab /></TabsContent>
              <TabsContent value="proficiencies"><ProficienciesTab /></TabsContent>
              <TabsContent value="armor"><ArmorEquipmentTab /></TabsContent>
            </div>
          </Tabs>
        </div>

        <DiceRollPanel />
        <DiceResultModal />
       </CombatProvider>
      </DiceRollProvider>
    </CharacterProvider>
  );
}
