import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createDefaultCharacter } from '../utils/defaults';
import { Character } from '../types/character';

interface Props { open: boolean; onClose: () => void; onCreate: (char: Character) => void; }

export default function CreateCharacterDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [player, setPlayer] = useState('');
  const [type, setType] = useState<'normal' | 'gm'>('normal');

  const handleCreate = () => {
    const char = createDefaultCharacter(type, name.trim() || 'New Character', player.trim());
    onCreate(char);
    setName(''); setPlayer(''); setType('normal');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create New Character</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Character Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter character name..." autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Player Name</Label>
            <Input value={player} onChange={e => setPlayer(e.target.value)} placeholder="Your name..." />
          </div>
          <div className="space-y-1">
            <Label>Character Type</Label>
            <Select value={type} onValueChange={v => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal — Standard point-buy</SelectItem>
                <SelectItem value="gm">GM/NPC — Infinite points, no restrictions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate}>Create Character</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
