import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getBaseAttrPts, getBaseSkillPts, getBaseAbilityPts, getBaseProfPts } from '../../utils/mechanics';
import { Character } from '../../types/character';

interface Props { open: boolean; onClose: () => void; onConfirm: () => void; character: Character; }

export default function LevelUpModal({ open, onClose, onConfirm, character }: Props) {
  const curr = character.level;
  const next = curr + 1;
  const gains = [
    { label: 'Attribute Points', value: `+6 (total: ${getBaseAttrPts(next)})` },
    { label: 'Skill Points', value: `+8 (total: ${getBaseSkillPts(next)})` },
    { label: 'Ability Points', value: `+1 (total: ${getBaseAbilityPts(next)})` },
    { label: 'Proficiency Points', value: `+${next % 2 === 1 ? 4 : 5} (total: ${getBaseProfPts(next)})` },
    { label: 'Max HP', value: `${20 + next * 10} (+10)` },
  ];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Level Up to {next}?</DialogTitle></DialogHeader>
        <div className="space-y-2 my-2">
          {gains.map(g => (
            <div key={g.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{g.label}</span>
              <span className="font-medium text-foreground">{g.value}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onConfirm(); onClose(); }}>Confirm Level Up</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
