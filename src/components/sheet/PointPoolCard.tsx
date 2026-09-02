import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface Props {
  label: string; available: number; bonus: number;
  onBonusChange: (delta: number) => void; isGM: boolean;
  colorClass?: string;
}
export default function PointPoolCard({ label, available, bonus, onBonusChange, isGM, colorClass = 'border-primary/30' }: Props) {
  const displayAvail = isGM ? '∞' : (available < 0 ? available.toString() : available.toString());
  const isNeg = !isGM && available < 0;
  return (
    <div className={`rounded-xl border-2 ${colorClass} bg-card p-3 flex flex-col items-center gap-1 min-w-[90px]`}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${isNeg ? 'text-destructive' : 'text-foreground'}`}>{displayAvail}</span>
      {!isGM && (
        <div className="flex items-center gap-1 mt-1">
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onBonusChange(-1)} disabled={bonus <= 0}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {bonus > 0 ? `+${bonus} bonus` : 'bonus'}
          </span>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onBonusChange(1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
