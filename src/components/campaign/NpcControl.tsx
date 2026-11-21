import { useEffect, useRef, useState } from 'react';
import { CharacterProvider } from '../../context/CharacterContext';
import { DiceRollProvider } from '../../context/DiceRollContext';
import { CombatProvider } from '../../context/CombatContext';
import { saveCampaignCharacter, syncCampaignCharacterToOriginal } from '../../lib/api/social';
import type { GetCampaignCharactersOutputType } from '../../lib/api/social';
import { getLocalCharacter, saveLocalCharacter } from '../../utils/storage';
import { getHPMax, getStaminaMax, getManaMax } from '../../utils/mechanics';
import { changeSig } from '../../utils/charSig';
import type { Character } from '../../types/character';
import NpcAttacks from './NpcAttacks';
import OpponentCounter from '../sheet/OpponentCounter';
import TurnTracker from '../sheet/TurnTracker';
import DiceResultModal from '../dice/DiceResultModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Copy, ExternalLink, HeartPulse, Minus, Plus, Swords } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePersistedState } from '../../utils/usePersistedState';
import { NpcMagic, NpcAbilities, NpcArmor } from './NpcTabs';
import { toast } from 'sonner';

type CampaignChar = GetCampaignCharactersOutputType['characters'][0];

const SAVE_DELAY_MS = 1200;

function parseCharacter(npc: CampaignChar): Character | null {
  try {
    const p = JSON.parse(npc.data) as Character;
    return {
      ...p,
      weapons: p.weapons ?? [], bows: p.bows ?? [], crossbows: p.crossbows ?? [], firearms: p.firearms ?? [],
      berzerkActive: p.berzerkActive ?? false, berzerkRound: p.berzerkRound ?? 0,
      cloudId: npc.id, // same convention as the campaign sheet: the campaign row id
    };
  } catch { return null; }
}

/** The "Also update" ticks the GM chose on this NPC's own sheet are honoured here too. */
function untickedSheets(campaignCharacterId: string): string[] {
  try { return JSON.parse(localStorage.getItem(`botv_sync_off_copy:${campaignCharacterId}`) ?? '[]'); } catch { return []; }
}

function Vital({ label, value, max, onChange, onAdjust, barClass }: {
  label: string; value: number; max: number; onChange: (n: number) => void; onAdjust: (delta: number) => void; barClass: string;
}) {
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Math.floor(n) || 0)));
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onAdjust(-1)} disabled={value <= 0} aria-label={`${label} down`}><Minus className="h-3 w-3" /></Button>
          <Input type="number" value={value} onChange={e => set(parseInt(e.target.value))} onFocus={e => e.target.select()}
            className="h-6 w-14 text-xs text-center px-1" aria-label={`${label} current`} />
          <span className="text-xs text-muted-foreground w-10">/ {max}</span>
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onAdjust(1)} disabled={value >= max} aria-label={`${label} up`}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="h-1.5 rounded bg-muted overflow-hidden"><div className={`h-full ${barClass} transition-all`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** A GM/NPC character controlled from the campaign page: its health, stamina and mana, and its attacks and
 * damage (the real weapon cards), without opening its sheet. Changes save by themselves to the campaign copy
 * (and the main character, like any save of that sheet). */
export default function NpcControl({ npc, onOpenSheet, onDuplicate, collapsed = false, onToggleCollapsed, accent = 'npc', onTurnStart }: {
  npc: CampaignChar; onOpenSheet: () => void; onDuplicate?: () => void;
  /** NPC cards (the GM's) are amber; a player's own active character is the primary colour. */
  accent?: 'npc' | 'player';
  /** Runs when this character starts combat or a new turn (its walking speed on the map comes back). */
  onTurnStart?: () => void;
  /** Collapsed: just the name. The card keeps saving while it is collapsed. */
  collapsed?: boolean; onToggleCollapsed?: () => void;
}) {
  const [char, setChar] = useState<Character | null>(() => parseCharacter(npc));
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  // Which tab (Weapons, Magic, Abilities, Armor) this NPC was last on, kept on this device
  const [tab, setTab] = usePersistedState(`botv_npc_tab:${npc.id}`, 'weapons', 365 * 24 * 60 * 60 * 1000);

  const latest = useRef(char);
  latest.current = char;
  const savedSig = useRef(char ? changeSig(char) : '');
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const warnedBlocked = useRef(false);

  const setCharacter = (u: Character | ((p: Character) => Character)) =>
    setChar(prev => (prev ? (typeof u === 'function' ? u(prev) : u) : prev));

  const persist = async (): Promise<void> => {
    if (inFlight.current) { queued.current = true; return inFlight.current; }
    const snapshot = latest.current;
    if (!snapshot) return;
    const sig = changeSig(snapshot);
    if (sig === savedSig.current) return;
    const run = (async () => {
      setStatus('saving');
      try {
        await saveCampaignCharacter({
          campaignCharacterId: npc.id, name: snapshot.name, characterType: snapshot.characterType, level: snapshot.level, data: JSON.stringify(snapshot),
        });
        savedSig.current = sig;
        try {
          const off = untickedSheets(npc.id);
          const sync = await syncCampaignCharacterToOriginal({
            campaignCharacterId: npc.id, name: snapshot.name, characterType: snapshot.characterType, level: snapshot.level, data: JSON.stringify(snapshot),
            updateMain: !off.includes('main'), skipCopyIds: off.filter(id => id !== 'main'),
          });
          if (sync.originalUpdated && getLocalCharacter(snapshot.id)) {
            saveLocalCharacter({ ...snapshot, cloudId: sync.originalId, cloudSyncedAt: sync.updatedAt });
          } else if (sync.linked && !sync.mainSkipped && !sync.originalUpdated && !warnedBlocked.current) {
            warnedBlocked.current = true;
            toast.warning(`${snapshot.name} saved to the campaign, but the main character was not updated.`, {
              description: 'Run supabase/campaign-sync.sql in the Supabase SQL editor to let a GM update a player\'s main character.',
              duration: 8000,
            });
          }
        } catch { /* the campaign copy saved; the main character catches up on a later save */ }
        setStatus(changeSig(latest.current as Character) === sig ? 'saved' : 'dirty');
      } catch {
        setStatus('error');
        toast.error(`Could not save ${snapshot.name}. Keep this page open; it will retry.`);
      }
    })();
    inFlight.current = run;
    try { await run; } finally {
      inFlight.current = null;
      if (queued.current) { queued.current = false; void persistRef.current(); }
    }
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Save shortly after the last change; retry after a failure
  useEffect(() => {
    if (!char || changeSig(char) === savedSig.current) return;
    setStatus(s => (s === 'saving' ? s : 'dirty'));
    const t = window.setTimeout(() => { void persistRef.current(); }, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [char]);
  useEffect(() => {
    if (status !== 'error') return;
    const t = window.setTimeout(() => { void persistRef.current(); }, 15000);
    return () => window.clearTimeout(t);
  }, [status]);

  // Save on the way out (leaving the campaign page, hiding the tab)
  useEffect(() => {
    const flush = () => { void persistRef.current(); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  if (!char) {
    return <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">Could not read {npc.name}.</div>;
  }

  const hpMax = getHPMax(char.level);
  const staMax = getStaminaMax(char);
  const manaMax = getManaMax(char);
  const hp = Math.min(char.hitPoints.current, hpMax);
  const setHP = (n: number) => setCharacter(p => ({ ...p, hitPoints: { current: n, max: hpMax } }));
  const setSta = (n: number) => setCharacter(p => ({ ...p, stamina: { current: n, max: staMax } }));
  const setMana = (n: number) => setCharacter(p => ({ ...p, mana: { current: n, max: manaMax } }));
  // +/- adjust the latest value, so quick repeated clicks all count
  const adjust = (key: 'hitPoints' | 'stamina' | 'mana', max: number) => (delta: number) =>
    setCharacter(p => ({ ...p, [key]: { current: Math.max(0, Math.min(max, p[key].current + delta)), max } }));
  const restore = () => { setHP(hpMax); setSta(staMax); setMana(manaMax); };

  // Opening the sheet waits for any pending save, so the sheet loads what you just changed
  const openSheet = async () => { await persistRef.current(); if (inFlight.current) await inFlight.current; onOpenSheet(); };
  const statusLabel = status === 'saving' ? 'Saving...' : status === 'dirty' ? 'Unsaved' : status === 'error' ? 'Save failed, retrying' : 'Saved';

  return (
    <CharacterProvider character={char} setCharacter={setCharacter}>
    <DiceRollProvider>
    <CombatProvider onTurnStart={onTurnStart}>
    <div className={`rounded-xl border ${accent === 'player' ? 'border-primary/40' : 'border-amber-500/30'} bg-card p-3 space-y-3`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? `Expand ${char.name}` : `Collapse ${char.name}`}
            title={collapsed ? 'Expand' : 'Collapse to just the name'} className="text-muted-foreground hover:text-foreground shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className="min-w-0 cursor-pointer" onClick={onToggleCollapsed}>
            <h3 className="font-bold text-foreground truncate">{char.name}</h3>
            {!collapsed && <p className="text-xs text-muted-foreground">Level {char.level}{char.race ? ` · ${char.race}` : ''}{char.archetype ? ` · ${char.archetype}` : ''}</p>}
          </div>
        </div>
        {!collapsed && <div className="flex items-center gap-2">
          <span className={`text-[11px] ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">{statusLabel}</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={restore} title="Refill health, stamina and mana to full">
            <HeartPulse className="h-3 w-3" />Restore
          </Button>
          {onDuplicate && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onDuplicate} title="Make copies of this character to track several">
              <Copy className="h-3 w-3" />Copies
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openSheet}>
            <ExternalLink className="h-3 w-3" />Full sheet
          </Button>
        </div>}
      </div>

      {!collapsed && <>

      {/* Turns, actions and reactions: start and end combat, the turn counter, spend and refill */}
      <div className="rounded-md border border-border bg-muted/20 px-3 pb-2">
        <TurnTracker variant="bar" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Vital label="Health" value={hp} max={hpMax} onChange={setHP} onAdjust={adjust('hitPoints', hpMax)} barClass="bg-red-500" />
        <Vital label="Stamina" value={Math.min(char.stamina.current, staMax)} max={staMax} onChange={setSta} onAdjust={adjust('stamina', staMax)} barClass="bg-emerald-500" />
        <Vital label="Mana" value={Math.min(char.mana.current, manaMax)} max={manaMax} onChange={setMana} onAdjust={adjust('mana', manaMax)} barClass="bg-blue-500" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8 w-full">
          <TabsTrigger value="weapons" className="flex-1 text-xs py-1">Weapons</TabsTrigger>
          <TabsTrigger value="magic" className="flex-1 text-xs py-1">Magic</TabsTrigger>
          <TabsTrigger value="abilities" className="flex-1 text-xs py-1">Abilities</TabsTrigger>
          <TabsTrigger value="armor" className="flex-1 text-xs py-1">Armor</TabsTrigger>
        </TabsList>
        <TabsContent value="weapons" className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Swords className="h-3.5 w-3.5" />Weapons</p>
            {/* One counter for every weapon: more opponents earn the multi-opponent bonuses (greatswords) */}
            <OpponentCounter />
          </div>
          <NpcAttacks />
        </TabsContent>
        <TabsContent value="magic" className="mt-2"><NpcMagic /></TabsContent>
        <TabsContent value="abilities" className="mt-2"><NpcAbilities /></TabsContent>
        <TabsContent value="armor" className="mt-2"><NpcArmor /></TabsContent>
      </Tabs>
      </>}
      <DiceResultModal />
    </div>
    </CombatProvider>
    </DiceRollProvider>
    </CharacterProvider>
  );
}
