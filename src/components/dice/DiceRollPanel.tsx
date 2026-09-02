import { useState } from 'react';
import { Dices, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDiceRoll, Advantage, RollEntry } from '../../context/DiceRollContext';

const ADV_OPTS: { key: Advantage; label: string }[] = [
  { key: 'normal',       label: 'Normal (4+)'  },
  { key: 'advantage',    label: 'Adv (3+)'     },
  { key: 'disadvantage', label: 'Disadv (5+)'  },
];

function LogEntry({ entry }: { entry: RollEntry }) {
  const isDamage = entry.rollType === 'damage';
  const t = entry.effectiveThreshold ?? 4;
  const dieType = entry.dieType ?? 6;
  return (
    <div className="py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-medium text-foreground truncate">{entry.label}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {entry.diceCount}{isDamage ? `×D${dieType}` : 'd6'}
          </span>
          {isDamage && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 shrink-0">Dmg</Badge>
          )}
          {!isDamage && entry.advantage !== 'normal' && (
            <Badge
              variant={entry.advantage === 'advantage' ? 'default' : 'destructive'}
              className="text-[10px] px-1 py-0 h-4 shrink-0"
            >
              {entry.advantage === 'advantage' ? 'Adv' : 'Dis'}
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0 text-xs">
          {isDamage ? (
            <span className="font-bold text-destructive" title={entry.dieResult != null ? `${entry.dieResult}×D${entry.dieType} × ${entry.damageMultiplier}x × ${entry.damageSuccesses} succ` : ''}>
              {entry.total} dmg
            </span>
          ) : (
            <>
              <span className="font-bold text-foreground">{entry.successes}</span>
              <span className="text-muted-foreground ml-0.5">succ</span>
              <span className="text-muted-foreground ml-2">Σ{entry.total}</span>
            </>
          )}
        </div>
      </div>
      {isDamage && entry.dieResult != null ? (
        <div className="text-[10px] text-muted-foreground font-mono">
          D{entry.dieType}:{entry.dieResult} × {entry.damageMultiplier}x × {entry.damageSuccesses}succ = {entry.total}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {entry.dice.slice(0, 30).map((d, i) => (
            <span
              key={i}
              className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${
                d >= t ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {d}
            </span>
          ))}
          {entry.dice.length > 30 && (
            <span className="text-[10px] text-muted-foreground self-center">+{entry.dice.length - 30}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiceRollPanel() {
  const { log, roll, clearLog } = useDiceRoll();
  const [expanded, setExpanded] = useState(false);
  const [diceCount, setDiceCount] = useState(6);
  const [adv, setAdv] = useState<Advantage>('normal');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border shadow-xl">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <Dices className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">Dice Roller</span>
        {log[0] && (
          <span className="text-xs text-muted-foreground ml-1 truncate flex-1">
            · {log[0].label}: {log[0].successes} succ / Σ{log[0].total}
          </span>
        )}
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* General roller */}
          <div className="p-3 bg-muted/20 border-b border-border flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="number" min={1} max={50}
                value={diceCount}
                onChange={e => setDiceCount(Math.max(1, Math.min(50, +e.target.value)))}
                className="w-16 h-7 text-sm text-center px-1"
              />
              <span className="text-sm font-medium text-muted-foreground">d6</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {ADV_OPTS.map(o => (
                <Button
                  key={o.key}
                  size="sm"
                  variant={adv === o.key ? 'default' : 'outline'}
                  className="h-7 text-xs px-2"
                  onClick={() => setAdv(o.key)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={() => roll('Custom Roll', diceCount, adv)}>
              <Dices className="h-3.5 w-3.5 mr-1" />Roll
            </Button>
          </div>

          {/* Roll history */}
          <div className="max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roll History</span>
              {log.length > 0 && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={clearLog}>
                  <Trash2 className="h-3 w-3 mr-1" />Clear
                </Button>
              )}
            </div>
            <div className="px-3 pb-3">
              {log.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-6">No rolls yet. Click a 🎲 button or roll above!</p>
                : log.map(e => <LogEntry key={e.id} entry={e} />)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
