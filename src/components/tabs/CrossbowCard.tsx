import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { useDiceRoll } from '../../context/DiceRollContext';
import type { Crossbow } from '../../types/character';
import { getCrossbowAimDice, getCrossbowAttackDice, effAttr } from '../../utils/mechanics';
import { getCrossbowMultiplier, getCrossbowDie, CROSSBOW_DRAW_WEIGHTS } from '../../utils/rangedData';
import { parseDieSides } from '../../utils/weaponData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Target, Link, Unlink, ChevronUp, ChevronDown, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import RollButton from '../dice/RollButton';
import DamageRollButton from '../dice/DamageRollButton';
import OpponentCounter from '../sheet/OpponentCounter';

interface Props { crossbow: Crossbow; onEdit: () => void; onDelete: () => void; onMoveUp?: () => void; onMoveDown?: () => void; }

export default function CrossbowCard({ crossbow, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  const { character: c, setCharacter } = useChar();
  const { roll } = useDiceRoll();
  const [difficulty, setDifficulty] = useState(0);

  const xbProfs = c.proficiencies.filter(p => p.profType === 'crossbow');
  const linkedProf = crossbow.linkedProficiencyId
    ? c.proficiencies.find(p => p.id === crossbow.linkedProficiencyId) : undefined;

  const aimDice = getCrossbowAimDice(c, crossbow, linkedProf);
  const attackDice = getCrossbowAttackDice(c);
  const mult = getCrossbowMultiplier(crossbow.drawWeight);
  const die = getCrossbowDie(crossbow.drawWeight);
  const xbData = CROSSBOW_DRAW_WEIGHTS.find(d => d.id === crossbow.drawWeight)!;
  const isWindlass = xbData.mechanism === 'windlass';

  const setLinked = (profId: string) => {
    const newId = profId === '__none__' ? undefined : profId;
    setCharacter(p => ({
      ...p,
      crossbows: (p.crossbows ?? []).map(x => x.id === crossbow.id ? { ...x, linkedProficiencyId: newId } : x),
    }));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm text-foreground">{crossbow.name}</span>
            <Badge variant="secondary" className="text-xs">{xbData.label} ({xbData.lbs})</Badge>
            <Badge variant={isWindlass ? 'default' : 'outline'} className="text-xs">
              {isWindlass ? 'Windlass (W)' : 'Lever (L)'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {die} × {mult}× · Wpn Bonus +{xbData.weaponBonus}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(onMoveUp !== undefined || onMoveDown !== undefined) && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp} disabled={!onMoveUp}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown} disabled={!onMoveDown}><ArrowDown className="h-3 w-3" /></Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {crossbow.name}?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the crossbow from your character.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Reload badge */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
        <RefreshCw className="h-3 w-3 shrink-0" />
        <span>Reload: <span className="font-medium text-foreground">{xbData.reloadCost}</span></span>
      </div>

      {/* Rolls */}
      <div className="rounded bg-muted/30 border border-border/50 px-2.5 py-2 space-y-2">
        {/* Aim */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Aim:</span>
            <span className="text-xs font-bold text-foreground">{aimDice}d6</span>
            <span className="text-[10px] text-muted-foreground">3+WpnBonus+ProfLv+DEX({effAttr(c, 'dex')})</span>
            <div className="ml-auto">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
                onClick={() => roll(`${crossbow.name} — Aim`, aimDice, 'normal', {
                  aimDifficulty: difficulty,
                  note: difficulty > 0 ? `Diff ${difficulty}` : 'Aim Roll',
                })}>
                <Target className="h-3 w-3" />Aim
              </Button>
            </div>
          </div>
          {/* Difficulty */}
          <div className="flex items-center gap-1.5 pl-0.5">
            <span className="text-[10px] text-muted-foreground">Difficulty:</span>
            <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => setDifficulty(Math.max(0, difficulty - 1))} disabled={difficulty <= 0}>
              <ChevronDown className="h-2.5 w-2.5" />
            </Button>
            <span className="text-xs font-semibold text-foreground w-5 text-center">{difficulty}</span>
            <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => setDifficulty(difficulty + 1)}>
              <ChevronUp className="h-2.5 w-2.5" />
            </Button>
            {difficulty > 0 && (
              <span className="text-[10px] text-muted-foreground">→ successes − {difficulty} = effective hits</span>
            )}
          </div>
        </div>

        {/* Attack */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Attack:</span>
          <span className="text-xs font-bold text-foreground">{attackDice}d6</span>
          <span className="text-[10px] text-muted-foreground">3+INT({effAttr(c,'int')})+DEX({effAttr(c,'dex')})</span>
          <div className="ml-auto">
            <RollButton label={`${crossbow.name} — Attack`} diceCount={attackDice} size="sm" />
          </div>
        </div>

        <OpponentCounter />

        {/* Damage */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-muted-foreground">Damage: </span>
            <span className="font-semibold text-foreground">{die} × {mult}×</span>
          </div>
          <DamageRollButton label={`${crossbow.name}`} multiplier={mult} dieSides={parseDieSides(die)} size="sm" />
        </div>
      </div>

      {/* Proficiency link */}
      <div className="flex items-center gap-2">
        {linkedProf ? <Link className="h-3 w-3 text-primary shrink-0" /> : <Unlink className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-xs text-muted-foreground shrink-0">Xbow Prof:</span>
        <Select value={crossbow.linkedProficiencyId ?? '__none__'} onValueChange={setLinked}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Unlinked" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unlinked</SelectItem>
            {xbProfs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
