import { useChar } from '../../context/CharacterContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Swords, SkipForward } from 'lucide-react';

export default function BerzerkPanel() {
  const { character: c, setCharacter } = useChar();
  const isActive = c.berzerkActive;
  const round = c.berzerkRound;
  const nextCost = round + 1;
  const cumulativeCost = round > 0 ? (round * (round + 1)) / 2 : 0;

  const hasBerzerk = c.abilities.some(a => {
    const norm = typeof a === 'string' ? { treeAbilityId: undefined } : a;
    return norm.treeAbilityId === 'oc_berzerk';
  });
  if (!hasBerzerk) return null;

  const activate = () => {
    if (c.stamina.current < 1) {
      toast.error('Not enough stamina to activate Berzerk (need 1 STA).');
      return;
    }
    setCharacter(p => ({
      ...p,
      berzerkActive: true,
      berzerkRound: 1,
      stamina: { ...p.stamina, current: p.stamina.current - 1 },
    }));
    toast.success('Berzerk activated!', { description: 'STR doubled. Damage deferred until deactivation.' });
  };

  const deactivate = () => {
    setCharacter(p => ({ ...p, berzerkActive: false, berzerkRound: 0 }));
    toast.warning('Berzerk ended', {
      description: 'All accumulated injuries and damage are now applied.',
      duration: 6000,
    });
  };

  const advanceRound = () => {
    if (c.stamina.current < nextCost) {
      toast.error(`Not enough stamina for round ${nextCost} (need ${nextCost} STA).`);
      return;
    }
    setCharacter(p => ({
      ...p,
      berzerkRound: p.berzerkRound + 1,
      stamina: { ...p.stamina, current: p.stamina.current - nextCost },
    }));
  };

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${isActive ? 'border-destructive/60' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Swords className={`h-4 w-4 ${isActive ? 'text-destructive' : 'text-muted-foreground'}`} />
            Berzerk
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive ? `Round ${round} · ${cumulativeCost} STA spent` : 'Costs 1 STA to activate (stacking per round)'}
          </p>
        </div>
        <Button
          variant={isActive ? 'destructive' : 'outline'}
          size="sm"
          onClick={isActive ? deactivate : activate}
        >
          {isActive ? 'Deactivate' : 'Activate (1 STA)'}
        </Button>
      </div>
      {isActive && (
        <>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <div className="text-xs text-muted-foreground">
              Next round costs <span className="font-bold text-foreground">{nextCost} STA</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={advanceRound}
              disabled={c.stamina.current < nextCost}
            >
              <SkipForward className="h-3 w-3" /> Next Round
            </Button>
          </div>
          <div className="text-xs text-destructive/80 space-y-0.5 border-t border-border pt-2">
            <p>• Effective STR doubled (combat only)</p>
            <p>• Ignore injury levels below 4</p>
            <p>• All damage deferred until Berzerk ends</p>
          </div>
        </>
      )}
    </div>
  );
}
