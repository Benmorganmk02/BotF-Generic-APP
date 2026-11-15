import { Zap, Shield, RotateCcw, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChar } from '../../context/CharacterContext';
import { useCombat } from '../../context/CombatContext';
import { getStaminaMax, getManaMax } from '../../utils/mechanics';
import { cn } from '@/lib/utils';

/** A row of boxes: filled = still available, empty = spent. Click a box to spend or refund. */
function Pips({ left, max, onChange, filledClass, size, label }: {
  left: number; max: number; onChange: (n: number) => void; filledClass: string; size: 'sm' | 'md'; label: string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < left;
        return (
          <button key={i} onClick={() => onChange(filled ? i : i + 1)}
            aria-label={`${label} ${i + 1}: ${filled ? 'available' : 'spent'}`}
            className={cn(size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5', 'rounded border-2 transition-all hover:scale-110',
              filled ? cn(filledClass, 'border-transparent') : 'border-border bg-transparent hover:border-primary/50')} />
        );
      })}
    </div>
  );
}

/** The turn's action economy: start/end combat, the combat's turn number, a spendable action pool, a spendable
 * reaction pool, and the New Turn button that refills both. `bar` is the compact strip in the sheet header;
 * `card` is the full version on the Resources tab, with the turn counts (combat, session, all-time) and the
 * rules behind each pool. */
export default function TurnTracker({ variant }: { variant: 'bar' | 'card' }) {
  const { character: c, setCharacter } = useChar();
  const {
    inCombat, turn, actionsMax, actionsLeft, reactionsMax, reactionsLeft, setActionsLeft, setReactionsLeft,
    startCombat, endCombat, newTurn,
  } = useCombat();
  const total = c.turnStats?.total ?? 0;
  const session = c.turnStats?.session ?? 0;
  const resetSession = () => setCharacter(p => ({ ...p, turnStats: { total: p.turnStats?.total ?? 0, session: 0 } }));

  const combatButton = inCombat ? (
    <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" onClick={endCombat}
      title="End combat: resets the turn counter, refills actions and reactions, and applies the end-of-combat rest">
      <Square className="h-3 w-3" />End Combat
    </Button>
  ) : (
    <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={startCombat} title="Start combat at turn 1">
      <Play className="h-3 w-3" />Start Combat
    </Button>
  );
  const newTurnButton = (
    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={newTurn} disabled={!inCombat}
      title={inCombat ? 'Start the next turn: refills actions and reactions' : 'Start combat first'}>
      <RotateCcw className="h-3 w-3" />New Turn
    </Button>
  );

  if (variant === 'bar') {
    return (
      <div className="flex items-center gap-3 flex-wrap pt-1.5">
        {combatButton}
        <span className="text-xs font-semibold text-foreground">{inCombat ? `Turn ${turn}` : 'Not in combat'}</span>
        <div className="flex flex-col gap-0.5">
          <Pips left={actionsLeft} max={actionsMax} onChange={setActionsLeft} filledClass="bg-primary" size="sm" label="Action" />
          <span className="text-[10px] text-muted-foreground leading-tight">Action {actionsLeft}/{actionsMax}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <Pips left={reactionsLeft} max={reactionsMax} onChange={setReactionsLeft} filledClass="bg-accent-foreground" size="sm" label="Reaction" />
          <span className="text-[10px] text-muted-foreground leading-tight">Reactions {reactionsLeft}/{reactionsMax}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground leading-none">{c.stamina.current}/{getStaminaMax(c)}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">Stamina</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground leading-none">{c.mana.current}/{getManaMax(c)}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">Mana</span>
        </div>
        {newTurnButton}
      </div>
    );
  }

  const a = c.attributes;
  const bonusReactions = Math.floor((a.str + a.dex + a.wis + a.int) / 8);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-foreground">Action Economy <span className="font-normal text-muted-foreground">· {inCombat ? `Turn ${turn}` : 'not in combat'}</span></h4>
        <div className="flex items-center gap-2">{combatButton}{newTurnButton}</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="text-2xl font-bold text-foreground leading-none">{inCombat ? turn : '—'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Combat turn</div>
          <div className="text-[10px] text-muted-foreground">resets when combat starts or ends</div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between gap-1">
            <div className="text-2xl font-bold text-foreground leading-none">{session}</div>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={resetSession} disabled={session === 0}>Reset</Button>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Session turns</div>
          <div className="text-[10px] text-muted-foreground">since you last reset it</div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="text-2xl font-bold text-foreground leading-none">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total turns</div>
          <div className="text-[10px] text-muted-foreground">this character, all time</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground leading-none">{actionsLeft}<span className="text-sm font-normal text-muted-foreground"> / {actionsMax}</span></div>
            <Pips left={actionsLeft} max={actionsMax} onChange={setActionsLeft} filledClass="bg-primary" size="md" label="Action" />
            <div className="text-xs text-muted-foreground">Action per turn</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <Shield className="h-5 w-5 text-accent-foreground shrink-0" />
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground leading-none">{reactionsLeft}<span className="text-sm font-normal text-muted-foreground"> / {reactionsMax}</span></div>
            <Pips left={reactionsLeft} max={reactionsMax} onChange={setReactionsLeft} filledClass="bg-accent-foreground" size="md" label="Reaction" />
            <div className="text-xs text-muted-foreground">Reactions per turn</div>
            <div className="text-[10px] text-muted-foreground font-mono">
              1 + ⌊(STR{a.str}+DEX{a.dex}+WIS{a.wis}+INT{a.int}) / 8⌋ = 1+{bonusReactions}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Filled boxes are what you have left; click one to spend or refund it. Start Combat begins turn 1, New Turn refills both pools and counts the turn
        (and pays Berzerk's next stacking stamina cost, 1 then 2, 3, 4..., ending it if you can't), and End Combat resets the turn counter, ends Berzerk and applies the end-of-combat rest.
        Abilities with a cost have a Use button that spends the stamina and reactions. Spells spend mana when cast; unused magic roll mana is lost when a turn starts or combat ends.
      </p>
    </div>
  );
}
