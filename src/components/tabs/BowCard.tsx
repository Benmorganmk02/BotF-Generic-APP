import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { useDiceRoll } from '../../context/DiceRollContext';
import type { Bow } from '../../types/character';
import { getBowAimDice, getBowAttackDice, effAttr } from '../../utils/mechanics';
import { getBowMultiplier, getBowDie, BOW_DRAW_WEIGHTS, BOW_STYLES } from '../../utils/rangedData';
import { parseDieSides } from '../../utils/weaponData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Target, Link, Unlink, ChevronUp, ChevronDown, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import RollButton from '../dice/RollButton';
import DamageRollButton from '../dice/DamageRollButton';
import OpponentCounter from '../sheet/OpponentCounter';

interface Props { bow: Bow; onEdit: () => void; onDelete: () => void; onMoveUp?: () => void; onMoveDown?: () => void; }

export default function BowCard({ bow, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  const { character: c, setCharacter } = useChar();
  const { roll } = useDiceRoll();
  const [difficulty, setDifficulty] = useState(0);

  const bowProfs = c.proficiencies.filter(p => p.profType === 'bow');
  const linkedProf = bow.linkedProficiencyId ? c.proficiencies.find(p => p.id === bow.linkedProficiencyId) : undefined;

  const aimDice = getBowAimDice(c, bow, linkedProf);
  const attackDice = getBowAttackDice(c, linkedProf);
  const mult = getBowMultiplier(bow.style, bow.drawWeight);
  const die = getBowDie(bow.drawWeight);
  const wData = BOW_DRAW_WEIGHTS.find(d => d.id === bow.drawWeight)!;
  const sData = BOW_STYLES.find(s => s.id === bow.style)!;
  const strVal = effAttr(c, 'str');
  const strMet = strVal >= wData.minStr;
  const mentalLabel = linkedProf?.mentalStat?.toUpperCase() ?? 'DEX';

  const setLinked = (profId: string) => {
    const newId = profId === '__none__' ? undefined : profId;
    setCharacter(p => ({ ...p, bows: (p.bows ?? []).map(b => b.id === bow.id ? { ...b, linkedProficiencyId: newId } : b) }));
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm text-foreground">{bow.name}</span>
            <Badge variant="secondary" className="text-xs">{sData.label}</Badge>
            <Badge variant="outline" className="text-xs">{wData.label} ({wData.lbs})</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {die} × {mult}× · Wpn Bonus +{wData.weaponBonus}
            {wData.minStr > 0 && <span className="ml-2">· Min STR {wData.minStr}</span>}
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
                <AlertDialogTitle>Delete {bow.name}?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the bow from your character.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* STR warning */}
      {!strMet && wData.minStr > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          STR {strVal} is below the minimum {wData.minStr} for a {wData.label} bow
        </div>
      )}

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
                onClick={() => roll(`${bow.name} — Aim`, aimDice, 'normal', {
                  aimDifficulty: difficulty,
                  note: difficulty > 0 ? `Diff ${difficulty}` : 'Aim Roll',
                })}>
                <Target className="h-3 w-3" />Aim
              </Button>
            </div>
          </div>
          {/* Difficulty stepper */}
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
          <span className="text-[10px] text-muted-foreground">
            {linkedProf ? `3+STR+${mentalLabel}+ProfLv` : '3+STR (link prof for full roll)'}
          </span>
          <div className="ml-auto">
            <RollButton label={`${bow.name} — Attack`} diceCount={attackDice} size="sm" />
          </div>
        </div>

        <OpponentCounter />

        {/* Damage */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-muted-foreground">Damage: </span>
            <span className="font-semibold text-foreground">{die} × {mult}×</span>
          </div>
          <DamageRollButton label={`${bow.name}`} multiplier={mult} dieSides={parseDieSides(die)} size="sm" />
        </div>
      </div>

      {/* Proficiency link */}
      <div className="flex items-center gap-2">
        {linkedProf ? <Link className="h-3 w-3 text-primary shrink-0" /> : <Unlink className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-xs text-muted-foreground shrink-0">Bow Prof:</span>
        <Select value={bow.linkedProficiencyId ?? '__none__'} onValueChange={setLinked}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Unlinked" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unlinked</SelectItem>
            {bowProfs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
