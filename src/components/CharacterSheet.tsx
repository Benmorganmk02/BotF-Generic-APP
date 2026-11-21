import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Character } from '../types/character';
import { CharacterProvider } from '../context/CharacterContext';
import { DiceRollProvider } from '../context/DiceRollContext';
import { CombatProvider } from '../context/CombatContext';
import { saveLocalCharacter } from '../utils/storage';
import { getAvailAttrPts, getAvailSkillPts, getAvailAbilityPts, getAvailProfPts } from '../utils/mechanics';
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
import TurnTracker from './sheet/TurnTracker';
import { changeSig } from '../utils/charSig';
import SaveTargetsMenu from './sheet/SaveTargetsMenu';
import type { SyncTarget } from './sheet/SaveTargetsMenu';
import DiceRollPanel from './dice/DiceRollPanel';
import DiceResultModal from './dice/DiceResultModal';

interface Props {
  initialCharacter: Character;
  /** `selectedTargetIds` is which of `syncTargets` were ticked (undefined when the sheet has none). */
  /** `opts.silent` is an auto-save: no success messages. */
  onSave: (char: Character, selectedTargetIds?: string[], opts?: { silent?: boolean }) => Promise<{ cloudId?: string; syncedAt?: string } | void>;
  /** Other sheets of this character a save can also update (the main character, or its campaign copies). */
  syncTargets?: SyncTarget[];
  /** Where the ticked/unticked choice is remembered on this device. */
  syncKey?: string;
  onHome: () => void;
  campaignMode?: boolean;
  /** Someone else's character shown to you: nothing on the sheet changes and there is no Save. */
  readOnly?: boolean;
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

const AUTOSAVE_DELAY_MS = 2500;
const AUTOSAVE_RETRY_MS = 20000;
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export default function CharacterSheet({ initialCharacter, onSave, onHome, campaignMode, readOnly, syncTargets, syncKey }: Props) {
  const [character, setCharacterState] = useState<Character>(initialCharacter);
  const [saving, setSaving] = useState(false);
  // Unticked sheets are remembered, so new sheets start ticked
  const storeKey = syncKey ? `botv_sync_off_${syncKey}` : '';
  const [unchecked, setUncheckedState] = useState<string[]>(() => {
    try { return storeKey ? JSON.parse(localStorage.getItem(storeKey) ?? '[]') : []; } catch { return []; }
  });
  const setUnchecked = (v: string[]) => {
    setUncheckedState(v);
    try { if (storeKey) localStorage.setItem(storeKey, JSON.stringify(v)); } catch { /* the choice just is not remembered */ }
  };

  const setCharacter = (updater: Character | ((prev: Character) => Character)) => {
    if (readOnly) return;
    setCharacterState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // A campaign copy is saved to its campaign row, never over the local main character
      if (!campaignMode) saveLocalCharacter(next);
      return next;
    });
  };

  // ── Auto-save ──
  // Changes are saved a moment after you stop editing, when the tab is hidden, and when you leave the sheet, so
  // forgetting to press Save does not lose anything. Save still works as before.
  const latest = useRef(character);
  latest.current = character;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const targetsRef = useRef({ syncTargets, unchecked });
  targetsRef.current = { syncTargets, unchecked };
  const savedSig = useRef(changeSig(initialCharacter));
  const inFlight = useRef(false);
  const queued = useRef(false);
  const errorShown = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const runSave = async (silent: boolean) => {
    if (readOnly) return;
    if (inFlight.current) { queued.current = true; return; }
    const snapshot = latest.current;
    const sig = changeSig(snapshot);
    if (silent && sig === savedSig.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const { syncTargets: targets, unchecked: off } = targetsRef.current;
      const selectedIds = targets && targets.length > 0 ? targets.filter(t => !off.includes(t.id)).map(t => t.id) : undefined;
      const result = await onSaveRef.current(snapshot, selectedIds, { silent });
      savedSig.current = sig;
      errorShown.current = false;
      if (result && !campaignMode && (result.cloudId || result.syncedAt)) {
        setCharacterState(prev => {
          const updated = { ...prev, cloudId: result.cloudId ?? prev.cloudId, cloudSyncedAt: result.syncedAt ?? prev.cloudSyncedAt };
          saveLocalCharacter(updated);
          return updated;
        });
      }
      setSaveStatus(changeSig(latest.current) === sig ? 'saved' : 'dirty');
    } catch {
      setSaveStatus('error');
      if (!silent || !errorShown.current) {
        errorShown.current = true;
        toast.error(silent
          ? (campaignMode ? 'Auto-save failed. Keep this page open: it will keep retrying.' : 'Auto-save failed. Your changes are kept on this device and will save when it works again.')
          : 'Save failed.');
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
      if (queued.current) { queued.current = false; void runSaveRef.current(true); }
    }
  };
  const runSaveRef = useRef(runSave);
  runSaveRef.current = runSave;
  const handleSave = () => runSave(false);

  // Save shortly after the last change
  useEffect(() => {
    if (readOnly) return;
    if (changeSig(character) === savedSig.current) return;
    setSaveStatus(s => (s === 'saving' ? s : 'dirty'));
    const t = window.setTimeout(() => { void runSaveRef.current(true); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [character, readOnly]);

  // After a failed save, keep trying
  useEffect(() => {
    if (saveStatus !== 'error') return;
    const t = window.setTimeout(() => { void runSaveRef.current(true); }, AUTOSAVE_RETRY_MS);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  // Save when the tab is hidden, the page closes, or you leave the sheet; warn if something is still unsaved
  useEffect(() => {
    if (readOnly) return;
    const flush = () => { if (changeSig(latest.current) !== savedSig.current) void runSaveRef.current(true); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (changeSig(latest.current) !== savedSig.current || inFlight.current) { flush(); e.preventDefault(); e.returnValue = ''; }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [readOnly]);

  const statusLabel = saveStatus === 'saving' ? 'Saving...' : saveStatus === 'dirty' ? 'Unsaved changes'
    : saveStatus === 'error' ? 'Auto-save failed, retrying' : 'All changes saved';

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
                  {readOnly && <Badge className="text-xs bg-sky-500/20 text-sky-400 border border-sky-500/40">View only</Badge>}
                  {campaignMode && <Badge className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40">Campaign Copy</Badge>}
                  <span className="text-xs text-muted-foreground">Lvl {character.level}</span>
                  {character.player && <span className="text-xs text-muted-foreground hidden sm:inline">· {character.player}</span>}
                  {character.race && <span className="text-xs text-muted-foreground hidden md:inline">· {character.race}</span>}
                </div>
              </div>
              {!readOnly && (
                <span className={`text-[11px] shrink-0 ${saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'} ${saveStatus === 'saved' ? 'hidden sm:inline' : ''}`} aria-live="polite">
                  {statusLabel}
                </span>
              )}
              {!readOnly && syncTargets && syncTargets.length > 0 && (
                <SaveTargetsMenu targets={syncTargets} unchecked={unchecked} onChange={setUnchecked} />
              )}
              {!readOnly && (
                <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save
                </Button>
              )}
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
                <TurnTracker variant="bar" />
              </div>
            )}
            {character.characterType === 'gm' && (
              <div className="px-4 pb-2 border-t border-border/50 flex items-center gap-4 flex-wrap">
                <span className="text-[10px] text-amber-400 uppercase tracking-wide pt-1.5">GM/NPC — Infinite Points</span>
                <TurnTracker variant="bar" />
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
