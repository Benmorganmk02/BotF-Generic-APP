import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCombat } from '../../context/CombatContext';

/** Number of opponents being attacked. Shared across all weapons on the sheet. */
export default function OpponentCounter() {
  const { opponents, setOpponents } = useCombat();
  return (
    <div className="flex items-center gap-1" title="Opponents you are attacking (shared by every weapon)">
      <span className="text-xs text-muted-foreground shrink-0">Opponents:</span>
      <Button size="icon" variant="outline" className="h-6 w-6 shrink-0"
        onClick={() => setOpponents(opponents - 1)} disabled={opponents <= 1}>
        <Minus className="h-3 w-3" />
      </Button>
      <Input type="number" min={1} value={opponents}
        onChange={e => setOpponents(parseInt(e.target.value))}
        className="h-6 w-11 text-xs px-1 text-center" />
      <Button size="icon" variant="outline" className="h-6 w-6 shrink-0"
        onClick={() => setOpponents(opponents + 1)}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
