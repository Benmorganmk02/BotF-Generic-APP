import { useState, useEffect } from 'react';
import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDiceRoll } from '../../context/DiceRollContext';

interface Props {
  label: string;
  /** Weapon multiplier (e.g. 2.5 for a great sword) */
  multiplier: number;
  /** Die sides from the head's die string (2, 4, 6, 8, 10, 12) */
  dieSides: number;
  /** How many dice to roll and sum before applying the multiplier. Most weapons: 1. */
  dieCount?: number;
  size?: 'sm' | 'md';
}

export default function DamageRollButton({ label, multiplier, dieSides, dieCount = 1, size = 'md' }: Props) {
  const { rollDamage, log } = useDiceRoll();
  const [open, setOpen] = useState(false);
  const [successes, setSuccesses] = useState(0);

  // Pre-fill from most recent attack roll when opening
  useEffect(() => {
    if (open) {
      const lastAttack = log.find(e => e.rollType !== 'damage');
      if (lastAttack) setSuccesses(lastAttack.successes);
    }
  }, [open, log]);

  // Preview of final damage: (dice avg) × multiplier × successes
  const diceAvg = dieCount * ((dieSides + 1) / 2);
  const previewAfterMult = (diceAvg * multiplier).toFixed(1);
  const previewTotal = Math.round(diceAvg * multiplier * successes);
  const canRoll = successes > 0;
  const diceLabel = `${dieCount}×D${dieSides}`;

  const handleRoll = () => {
    if (!canRoll) return;
    rollDamage(label, dieSides, multiplier, successes, dieCount);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`${size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'} text-destructive hover:bg-destructive/10 shrink-0`}
          title={`Roll damage — ${diceLabel} × ${multiplier}x`}
        >
          <Swords className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" side="top" align="center">
        <p className="text-xs font-medium text-foreground mb-2.5 truncate">{label}</p>
        <div className="space-y-2.5">
          {/* Successes input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20 shrink-0">Successes</span>
            <Input
              type="number"
              min={0}
              max={30}
              value={successes}
              onChange={e => setSuccesses(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-7 text-xs text-center flex-1"
            />
          </div>

          {/* Formula preview */}
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{diceLabel}</span>
              <span className="text-muted-foreground">{dieCount > 1 ? 'roll & sum the dice' : 'roll the die'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">× {multiplier}x</span>
              <span className="text-muted-foreground">≈ {previewAfterMult}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] border-t border-border/50 pt-1">
              <span className="text-muted-foreground font-medium">× {successes} succ</span>
              {canRoll ? (
                <span className="font-bold text-destructive">≈ {previewTotal} dmg</span>
              ) : (
                <span className="text-muted-foreground italic">no successes</span>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="destructive"
            className="w-full h-7 text-xs gap-1.5"
            onClick={handleRoll}
            disabled={!canRoll}
          >
            <Swords className="h-3 w-3" /> Roll Damage
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
