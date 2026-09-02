import { cn } from '@/lib/utils';

interface BoxTrackerProps {
  current: number; max: number;
  onChange: (value: number) => void;
  filledClass?: string;
}

export default function BoxTracker({ current, max, onChange, filledClass = 'bg-primary' }: BoxTrackerProps) {
  if (max <= 0) return <p className="text-sm text-muted-foreground italic">No points available</p>;
  const rows: number[][] = [];
  for (let i = 0; i < max; i += 10) rows.push(Array.from({ length: Math.min(10, max - i) }, (_, j) => i + j));
  const handleClick = (idx: number) => onChange(idx < current ? idx : idx + 1);
  return (
    <div className="space-y-1.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 flex-wrap">
          {row.map(idx => (
            <button key={idx} onClick={() => handleClick(idx)}
              className={cn('w-5 h-5 rounded border-2 transition-all hover:scale-110',
                idx < current ? cn(filledClass, 'border-transparent') : 'border-border bg-transparent hover:border-primary/50')} />
          ))}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{current} / {max}</p>
    </div>
  );
}
