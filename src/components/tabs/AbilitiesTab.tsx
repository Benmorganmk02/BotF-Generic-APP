import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { AbilityEntry } from '../../types/character';
import { getAvailAbilityPts } from '../../utils/mechanics';
import { ABILITY_TREES } from '../../utils/abilityTrees';
import type { AbilityTree, TreeAbility } from '../../utils/abilityTrees';
import { MAGIC_SCHOOLS } from '../../utils/magicTrees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Trash2, Plus, ChevronDown, ChevronRight,
  CheckCircle2, Lock, Circle, Swords, Target, EyeOff, Shield, Flame, Leaf,
} from 'lucide-react';
import StatModifier from '../sheet/StatModifier';

const TREE_ICONS: Record<string, React.ReactNode> = {
  Swords: <Swords className="h-4 w-4 text-primary" />,
  Target: <Target className="h-4 w-4 text-primary" />,
  EyeOff: <EyeOff className="h-4 w-4 text-primary" />,
  Shield: <Shield className="h-4 w-4 text-primary" />,
  Flame: <Flame className="h-4 w-4 text-primary" />,
  Leaf: <Leaf className="h-4 w-4 text-primary" />,
};

function normalizeAbility(a: string | AbilityEntry): AbilityEntry {
  if (typeof a === 'string') return { id: crypto.randomUUID(), name: a, description: '' };
  return a;
}

// ── Build tier chains from the tree data ──────────────────────────────────────
// Returns a map: topAbilityId -> chain of ability ids from lowest to highest tier
function buildTierChains(): Map<string, string[]> {
  const chains = new Map<string, string[]>();
  for (const tree of ABILITY_TREES) {
    // Find chains: abilities where requiresAbilityId forms a linear sequence
    const childOf = new Map<string, string>(); // childId -> parentId
    for (const a of tree.abilities) {
      if (a.requiresAbilityId && !a.stacking) childOf.set(a.id, a.requiresAbilityId);
    }
    // Find chain heads (abilities that are parents but not children, or have children)
    const hasChild = new Set(childOf.values());
    const isChild = new Set(childOf.keys());
    const roots = tree.abilities.filter(a => hasChild.has(a.id) && !isChild.has(a.id));
    for (const root of roots) {
      const chain = [root.id];
      let cur = root.id;
      // Walk down the chain
      while (true) {
        const next = tree.abilities.find(a => a.requiresAbilityId === cur);
        if (!next) break;
        // Only chain if this is a linear sequence (one child)
        const siblings = tree.abilities.filter(a => a.requiresAbilityId === cur);
        if (siblings.length !== 1) break;
        chain.push(next.id);
        cur = next.id;
      }
      if (chain.length > 1) {
        // Map the highest tier id to the full chain
        chains.set(chain[chain.length - 1], chain);
        // Also map intermediate tiers
        for (let i = 0; i < chain.length - 1; i++) {
          chains.set(chain[i], chain.slice(0, i + 1));
        }
      }
    }
  }
  return chains;
}

const TIER_CHAINS = buildTierChains();

// Get the highest taken tier in a chain
function getHighestTakenInChain(chainTopId: string, takenIds: Set<string>): { chain: string[]; highestIdx: number } | null {
  // Find the full chain that includes this id
  for (const [topId, chain] of TIER_CHAINS) {
    if (chain.includes(chainTopId)) {
      let highestIdx = -1;
      for (let i = chain.length - 1; i >= 0; i--) {
        if (takenIds.has(chain[i])) { highestIdx = i; break; }
      }
      if (highestIdx >= 0) return { chain, highestIdx };
      return null;
    }
  }
  return null;
}

// ── Ability card in the main list ─────────────────────────────────────────────
function AbilityCard({ ability, treeName, onRemove, removeBlocked, tierInfo }: {
  ability: AbilityEntry;
  treeName?: string;
  onRemove: () => void;
  removeBlocked: boolean;
  tierInfo?: { tier: number; total: number; lowerTiers: AbilityEntry[] };
}) {
  const [open, setOpen] = useState(false);
  const tree = ABILITY_TREES.find(t => t.id === ability.treeId);
  const treeAbility = tree?.abilities.find(a => a.id === ability.treeAbilityId);
  const hasTiers = tierInfo && tierInfo.total > 1;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 min-w-0 text-left flex-1">
          {ability.description || treeAbility?.description || hasTiers ? (
            open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                 : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : <div className="w-3.5 shrink-0" />}
          <span className="text-sm font-medium text-foreground truncate">{ability.name}</span>
          {hasTiers && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold shrink-0">
              Tier {tierInfo.tier}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {treeName ?? 'Custom'}
          </span>
          {treeAbility?.cost && (
            <span className="text-xs text-muted-foreground shrink-0">· {treeAbility.cost}</span>
          )}
        </button>
        <Button
          size="icon" variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onRemove}
          disabled={removeBlocked}
          title={removeBlocked ? 'A higher-tier ability depends on this one' : 'Remove ability'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="pl-5 pt-1 space-y-1.5">
          {(ability.description || treeAbility?.description) && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ability.description || treeAbility?.description}
            </p>
          )}
          {hasTiers && tierInfo.lowerTiers.length > 0 && (
            <div className="space-y-1 border-l-2 border-primary/20 pl-2 mt-1">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Previous tiers (still spent)</span>
              {tierInfo.lowerTiers.map(lt => {
                const ltTree = ABILITY_TREES.find(t => t.id === lt.treeId);
                const ltAbility = ltTree?.abilities.find(a => a.id === lt.treeAbilityId);
                return (
                  <div key={lt.id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{lt.name}</span>
                    {ltAbility?.cost && <span> · {ltAbility.cost}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Ability Dialog ────────────────────────────────────────────────────────
function AddAbilityDialog({ open, onClose, canAdd }: {
  open: boolean;
  onClose: () => void;
  canAdd: boolean;
}) {
  const { character: c, setCharacter } = useChar();
  const [tab, setTab] = useState<'tree' | 'custom'>('tree');
  const [selectedTreeId, setSelectedTreeId] = useState(ABILITY_TREES[0]?.id ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const abilities = c.abilities.map(normalizeAbility);
  const takenTreeAbilityIds = new Set(abilities.filter(a => a.treeAbilityId).map(a => a.treeAbilityId!));
  const selectedTree = ABILITY_TREES.find(t => t.id === selectedTreeId);
  const avail = getAvailAbilityPts(c);
  const isGM = c.characterType === 'gm';

  const isLocked = (a: TreeAbility) => {
    if (!a.requiresAbilityId) return false;
    return !takenTreeAbilityIds.has(a.requiresAbilityId);
  };

  const takeTreeAbility = (tree: AbilityTree, ability: TreeAbility) => {
    const entry: AbilityEntry = {
      id: crypto.randomUUID(),
      name: ability.name,
      description: ability.description,
      treeId: tree.id,
      treeAbilityId: ability.id,
    };
    setCharacter(p => ({ ...p, abilities: [...p.abilities, entry] }));
    onClose();
  };

  const addCustom = () => {
    const n = customName.trim();
    if (!n) return;
    const entry: AbilityEntry = { id: crypto.randomUUID(), name: n, description: customDesc.trim() };
    setCharacter(p => ({ ...p, abilities: [...p.abilities, entry] }));
    setCustomName(''); setCustomDesc('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Ability</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {isGM ? '∞ available' : `${avail} slot${avail !== 1 ? 's' : ''} available`}
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1">
          <Button size="sm" variant={tab === 'tree' ? 'default' : 'secondary'} className="text-xs" onClick={() => setTab('tree')}>
            From Tree
          </Button>
          <Button size="sm" variant={tab === 'custom' ? 'default' : 'secondary'} className="text-xs" onClick={() => setTab('custom')}>
            Custom
          </Button>
        </div>

        {tab === 'tree' ? (
          <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {/* Tree selector */}
            <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  {selectedTree && (TREE_ICONS[selectedTree.icon] ?? <Shield className="h-4 w-4 text-primary" />)}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {ABILITY_TREES.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      {TREE_ICONS[t.icon] ?? <Shield className="h-4 w-4 text-primary" />}
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Abilities list */}
            <div className="space-y-1.5">
              {selectedTree && selectedTree.abilities.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">No abilities in this tree yet.</p>
              )}
              {selectedTree?.abilities.map(a => {
                const taken = takenTreeAbilityIds.has(a.id);
                const locked = isLocked(a);
                const prereq = a.requiresAbilityId
                  ? selectedTree.abilities.find(x => x.id === a.requiresAbilityId)
                  : undefined;
                const isExpanded = expandedId === a.id;

                if (taken) {
                  return (
                    <div key={a.id} className="space-y-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-primary/10 border border-primary/30 text-left"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground flex-1">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.cost}</span>
                      </button>
                      {isExpanded && <p className="text-xs text-muted-foreground leading-relaxed px-2.5 pl-7">{a.description}</p>}
                    </div>
                  );
                }
                if (locked) {
                  return (
                    <div key={a.id} className="space-y-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border opacity-50 text-left"
                      >
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground flex-1">{a.name}</span>
                        <span className="text-xs text-muted-foreground">Requires {prereq?.name ?? '???'}</span>
                      </button>
                      {isExpanded && <p className="text-xs text-muted-foreground/70 leading-relaxed px-2.5 pl-7">{a.description}</p>}
                    </div>
                  );
                }
                return (
                  <div key={a.id} className="space-y-1">
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium text-foreground flex-1">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{a.cost}</span>
                      </button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 text-xs text-primary px-2"
                        onClick={() => takeTreeAbility(selectedTree, a)}
                        disabled={!canAdd}
                      >
                        Take
                      </Button>
                    </div>
                    {isExpanded && <p className="text-xs text-muted-foreground leading-relaxed px-2.5 pl-7">{a.description}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Ability name..."
              onKeyDown={e => e.key === 'Enter' && canAdd && customName.trim() && addCustom()}
            />
            <Textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Description (optional)..."
              rows={3}
              className="text-sm"
            />
            <Button onClick={addCustom} disabled={!customName.trim() || !canAdd} className="w-full">
              <Plus className="h-4 w-4 mr-1.5" /> Add Ability
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function AbilitiesTab() {
  const { character: c, setCharacter } = useChar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const avail = getAvailAbilityPts(c);
  const isGM = c.characterType === 'gm';
  const canAdd = isGM || avail > 0;
  const modSlots = c.modifiers.abilities;

  const abilities = c.abilities.map(normalizeAbility);

  // Build lookup: treeAbilityId -> tree name (includes magic schools)
  const treeNameByAbilityId: Record<string, string> = {};
  for (const tree of ABILITY_TREES) {
    for (const a of tree.abilities) {
      treeNameByAbilityId[a.id] = tree.name;
    }
  }
  for (const school of MAGIC_SCHOOLS) {
    for (const a of school.abilities) {
      treeNameByAbilityId[a.id] = school.name;
    }
  }

  // Check if removing a tree ability is blocked (higher tier depends on it)
  const takenTreeAbilityIds = new Set(abilities.filter(a => a.treeAbilityId).map(a => a.treeAbilityId!));
  const isRemoveBlocked = (ability: AbilityEntry) => {
    if (!ability.treeAbilityId || !ability.treeId) return false;
    const tree = ABILITY_TREES.find(t => t.id === ability.treeId);
    if (!tree) return false;
    const dependents = tree.abilities.filter(x => x.requiresAbilityId === ability.treeAbilityId);
    return dependents.some(d => takenTreeAbilityIds.has(d.id));
  };

  const removeAbility = (abilityId: string) => {
    setCharacter(p => ({
      ...p,
      abilities: p.abilities.filter(a => normalizeAbility(a).id !== abilityId),
    }));
  };

  const setMod = (v: number) => setCharacter(p => ({ ...p, modifiers: { ...p.modifiers, abilities: v } }));

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Abilities</p>
          <p className="text-xs text-muted-foreground">
            {isGM ? '∞ available' : `${avail} slot${avail !== 1 ? 's' : ''} available`}
            {modSlots > 0 && <span className="text-teal-400 ml-1">(+{modSlots} modifier bonus)</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!canAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Ability
        </Button>
      </div>

      {/* Modifier */}
      <div className="w-64">
        <StatModifier label="Ability Modifier (bonus slots)" value={modSlots} onChange={setMod} />
      </div>

      {/* Abilities list — with tier collapsing */}
      {abilities.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">
          No abilities yet. Tap "Add Ability" to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {(() => {
            // Build collapsed view: hide lower tiers, show only highest
            const hiddenIds = new Set<string>();
            const tierInfoMap = new Map<string, { tier: number; total: number; lowerTiers: AbilityEntry[] }>();

            for (const ability of abilities) {
              if (!ability.treeAbilityId) continue;
              const chainResult = getHighestTakenInChain(ability.treeAbilityId, takenTreeAbilityIds);
              if (!chainResult || chainResult.chain.length <= 1) continue;

              const { chain, highestIdx } = chainResult;
              const highestTreeAbilityId = chain[highestIdx];

              // If this ability is NOT the highest taken, hide it
              if (ability.treeAbilityId !== highestTreeAbilityId) {
                hiddenIds.add(ability.id);
              } else {
                // Gather lower tiers for display
                const lowerTiers = abilities.filter(
                  a => a.treeAbilityId && chain.includes(a.treeAbilityId) && a.treeAbilityId !== highestTreeAbilityId
                );
                tierInfoMap.set(ability.id, {
                  tier: highestIdx + 1,
                  total: chain.length,
                  lowerTiers,
                });
              }
            }

            return abilities
              .filter(a => !hiddenIds.has(a.id))
              .map(ability => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  treeName={ability.treeAbilityId ? treeNameByAbilityId[ability.treeAbilityId] : undefined}
                  onRemove={() => removeAbility(ability.id)}
                  removeBlocked={isRemoveBlocked(ability)}
                  tierInfo={tierInfoMap.get(ability.id)}
                />
              ));
          })()}
        </div>
      )}

      <AddAbilityDialog open={dialogOpen} onClose={() => setDialogOpen(false)} canAdd={canAdd} />
    </div>
  );
}
