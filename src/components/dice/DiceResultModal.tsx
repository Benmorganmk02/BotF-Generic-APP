import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDiceRoll } from '../../context/DiceRollContext';

const ADV_LABELS = { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' };

function DamageBreakdown({ dice, dieResult, dieType, multiplier, afterMult, successes, total }: {
  dice: number[]; dieResult: number; dieType: number; multiplier: number;
  afterMult: number; successes: number; total: number;
}) {
  const multiDie = dice.length > 1;
  const steps = [
    { label: multiDie ? `${dice.length}×D${dieType} roll` : `D${dieType} roll`, value: dieResult, unit: '' },
    { label: `× ${multiplier}x multiplier`, value: afterMult, unit: '' },
    { label: `× ${successes} success${successes !== 1 ? 'es' : ''}`, value: total, unit: '' },
  ];

  return (
    <div className="space-y-3">
      {/* Die display — grid for multi-die weapons, single box otherwise */}
      <div className="flex justify-center gap-2 flex-wrap">
        {dice.map((d, i) => (
          <div key={i} className={`${multiDie ? 'w-14 h-14' : 'w-20 h-20'} rounded-2xl flex flex-col items-center justify-center border-2 border-destructive bg-destructive/20 select-none`}>
            <span className={`${multiDie ? 'text-xl' : 'text-3xl'} font-bold text-destructive`}>{d}</span>
            <span className="text-[11px] text-destructive/70 font-medium">D{dieType}</span>
          </div>
        ))}
      </div>
      {multiDie && (
        <p className="text-center text-xs text-muted-foreground">
          Sum: <span className="font-semibold text-foreground">{dieResult}</span>
        </p>
      )}

      {/* Formula chain */}
      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < steps.length - 1 ? 'border-b border-border/50' : 'bg-destructive/10'}`}>
            <span className={`text-xs ${i === steps.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
            <span className={`font-bold tabular-nums ${i === steps.length - 1 ? 'text-destructive text-xl' : 'text-foreground text-sm'}`}>
              {typeof step.value === 'number' && !Number.isInteger(step.value)
                ? step.value.toFixed(2)
                : step.value}
            </span>
          </div>
        ))}
      </div>

      {/* Total damage banner */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <span className="text-3xl font-bold text-destructive">{total}</span>
          <span className="text-sm text-muted-foreground ml-2">total damage</span>
        </div>
        <div className="text-right text-xs text-muted-foreground font-mono">
          {dieResult} × {multiplier}x × {successes}
        </div>
      </div>
    </div>
  );
}

function OffenseDefenseBreakdown({ dice, defenseAdvDice, offenseSuccesses, defenseSuccesses }: {
  dice: number[]; defenseAdvDice: number; offenseSuccesses: number; defenseSuccesses: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-primary inline-block shrink-0" />
          Offense hit (4+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-accent inline-block shrink-0" />
          Defense hit (3+ on the first {defenseAdvDice})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-primary bg-accent/30 inline-block shrink-0" />
          Both
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-border bg-muted inline-block shrink-0" />
          Miss
        </span>
      </div>

      <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto py-1">
        {dice.map((d, i) => {
          const isAdvDie = i < defenseAdvDice;
          const hitsOffense = d >= 4;
          const hitsDefense = d >= (isAdvDie ? 3 : 4);
          const style = hitsOffense && hitsDefense
            ? 'border-primary bg-accent/30 text-primary'
            : hitsOffense
              ? 'border-primary bg-primary/20 text-primary'
              : hitsDefense
                ? 'border-accent bg-accent/20 text-accent-foreground'
                : 'border-border bg-muted text-muted-foreground';
          return (
            <div key={i} className="relative">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border-2 select-none ${style}`}>
                {d}
              </div>
              {isAdvDie && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-background" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <span className="text-3xl font-bold text-primary">{offenseSuccesses}</span>
          <span className="text-sm text-muted-foreground ml-2">offense</span>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-foreground">{defenseSuccesses}</span>
          <span className="text-sm text-muted-foreground ml-2">defense</span>
        </div>
      </div>
    </div>
  );
}

export default function DiceResultModal() {
  const { currentRoll, clearCurrentRoll } = useDiceRoll();
  if (!currentRoll) return null;

  const isCombined = currentRoll.rollType === 'offense-defense';
  const isDamage = currentRoll.rollType === 'damage';
  const dieType = currentRoll.dieType ?? 6;
  const t = currentRoll.effectiveThreshold ?? 4;
  const advDiceCount = currentRoll.advantageDiceCount ?? 0;
  const guaranteed = currentRoll.guaranteedSuccesses ?? 0;
  const hasExtras = guaranteed > 0 || advDiceCount > 0;

  return (
    <Dialog open onOpenChange={open => !open && clearCurrentRoll()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-base">{currentRoll.label}</DialogTitle>
            {isDamage ? (
              <>
                <Badge variant="outline" className="text-xs">{currentRoll.dieCount ?? 1}×D{dieType}</Badge>
                <Badge variant="destructive" className="text-xs">Damage</Badge>
              </>
            ) : isCombined ? (
              <>
                <Badge variant="outline" className="text-xs">{currentRoll.diceCount}d6</Badge>
                <Badge variant="secondary" className="text-xs">Offense + Defense</Badge>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-xs">{currentRoll.diceCount}d6</Badge>
                {currentRoll.advantage !== 'normal' && (
                  <Badge variant="secondary" className="text-xs">{ADV_LABELS[currentRoll.advantage]}</Badge>
                )}
                {currentRoll.note && (
                  <Badge variant="secondary" className="text-xs">{currentRoll.note}</Badge>
                )}
              </>
            )}
          </div>
        </DialogHeader>

        {isCombined ? (
          <OffenseDefenseBreakdown
            dice={currentRoll.dice}
            defenseAdvDice={currentRoll.defenseAdvDice ?? 0}
            offenseSuccesses={currentRoll.offenseSuccesses ?? 0}
            defenseSuccesses={currentRoll.defenseSuccesses ?? 0}
          />
        ) : isDamage && currentRoll.dieResult != null ? (
          <DamageBreakdown
            dice={currentRoll.dice}
            dieResult={currentRoll.dieResult}
            dieType={dieType}
            multiplier={currentRoll.damageMultiplier ?? 1}
            afterMult={currentRoll.damageAfterMult ?? currentRoll.dieResult}
            successes={currentRoll.damageSuccesses ?? 1}
            total={currentRoll.total}
          />
        ) : (
          <div className="space-y-4">
            {/* Legend for advantage dice */}
            {advDiceCount > 0 && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-accent border border-border inline-block shrink-0" />
                  First {advDiceCount} dice: adv (3+)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded border-2 border-primary inline-block shrink-0" />
                  Rest: {t}+
                </span>
              </div>
            )}

            {/* Individual dice grid */}
            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto py-1">
              {currentRoll.dice.map((d, i) => {
                const isAdvDie = i < advDiceCount;
                const threshold = isAdvDie ? 3 : t;
                const isSuccess = d >= threshold;
                return (
                  <div key={i} className="relative">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border-2 select-none ${
                      isSuccess
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      {d}
                    </div>
                    {isAdvDie && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-background" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Guaranteed successes */}
            {guaranteed > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: guaranteed }).map((_, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border-2 border-dashed border-primary bg-primary/10 text-primary select-none">
                    ✓
                  </div>
                ))}
                <span className="text-xs text-muted-foreground italic">{guaranteed} guaranteed success{guaranteed > 1 ? 'es' : ''}</span>
              </div>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <span className="text-3xl font-bold text-foreground">{currentRoll.successes}</span>
                <span className="text-sm text-muted-foreground ml-2">successes</span>
                {hasExtras ? (
                  <div className="text-xs text-muted-foreground">
                    {currentRoll.rolledSuccesses} rolled
                    {guaranteed > 0 ? ` + ${guaranteed} guaranteed` : ''}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{t === 6 ? '6 only' : `${t}+`} counts as success</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-foreground">Σ {currentRoll.total}</div>
                <div className="text-xs text-muted-foreground">{currentRoll.diceCount} dice rolled</div>
              </div>
            </div>

            {/* Aim difficulty effective hits */}
            {currentRoll.aimDifficulty !== undefined && currentRoll.aimDifficulty > 0 && (
              <div className="flex items-center justify-between bg-muted/40 border border-border rounded px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {currentRoll.successes} successes − {currentRoll.aimDifficulty} difficulty
                </span>
                <div className="text-right">
                  <span className="text-xl font-bold text-primary">{currentRoll.effectiveHits}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">effective hits</span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
