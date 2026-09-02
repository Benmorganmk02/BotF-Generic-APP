import { useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDiceRoll, Advantage, RollExtras, computeEffectiveThreshold } from '../../context/DiceRollContext';

interface Props {
  label: string;
  diceCount: number;
  size?: 'sm' | 'md';
  extras?: RollExtras;
  /** Inherent disadvantage from negative skills (0-2). Stacks with player's choice. */
  inherentDisadvLvl?: number;
}

const BASE_OPTS: { key: Advantage; icon: string; label: string; cls: string }[] = [
  { key: 'normal',       icon: '⚡', label: 'Normal',      cls: '' },
  { key: 'advantage',    icon: '✨', label: 'Advantage',   cls: 'text-primary' },
  { key: 'disadvantage', icon: '⚠️', label: 'Disadvantage', cls: 'text-destructive' },
];

function thresholdLabel(t: number): string {
  return t === 6 ? '6 only' : `${t}+`;
}

export default function RollButton({ label, diceCount, size = 'md', extras, inherentDisadvLvl = 0 }: Props) {
  const { roll } = useDiceRoll();
  const [open, setOpen] = useState(false);
  const disabled = diceCount <= 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`${size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'} text-primary hover:bg-primary/10 shrink-0`}
          disabled={disabled}
          title={disabled ? 'No dice to roll' : `Roll ${diceCount}d6`}
        >
          <Dices className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" side="top" align="center">
        <p className="text-xs text-muted-foreground mb-2 font-medium truncate">{label} — {diceCount}d6</p>
        <div className="flex flex-col gap-1">
          {BASE_OPTS.map(o => {
            const t = computeEffectiveThreshold(o.key, inherentDisadvLvl);
            return (
              <Button
                key={o.key}
                size="sm"
                variant="outline"
                className={`h-7 text-xs justify-between ${o.cls}`}
                onClick={() => { setOpen(false); roll(label, diceCount, o.key, { ...extras, inherentDisadvLvl }); }}
              >
                <span>{o.icon} {o.label}</span>
                <span className="text-muted-foreground font-mono">{thresholdLabel(t)}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
