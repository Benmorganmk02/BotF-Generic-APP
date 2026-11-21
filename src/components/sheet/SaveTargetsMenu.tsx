import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';

/** Another sheet of the same character that a save can also update. */
export interface SyncTarget {
  /** 'main' for the character in the main menu, otherwise the id of the campaign copy. */
  id: string;
  label: string;
  kind: 'main' | 'campaign';
}

/** "Also update" picker next to Save: this sheet always saves, and each box is another sheet of the same character
 * (the main character, or its copy in a campaign) that gets the same changes. Unticked sheets are left alone. */
export default function SaveTargetsMenu({ targets, unchecked, onChange }: {
  targets: SyncTarget[];
  unchecked: string[];
  onChange: (unchecked: string[]) => void;
}) {
  const selected = targets.filter(t => !unchecked.includes(t.id)).length;
  const toggle = (id: string) => onChange(unchecked.includes(id) ? unchecked.filter(x => x !== id) : [...unchecked, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" title="Choose which other sheets of this character a save also updates">
          Also update {selected}/{targets.length}<ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="end">
        <p className="text-xs font-medium text-foreground">Save also updates:</p>
        <div className="space-y-1.5">
          {targets.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={!unchecked.includes(t.id)} onChange={() => toggle(t.id)} />
              <span className="truncate">{t.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">This sheet always saves. Unticked sheets are left exactly as they are, so they can drift apart until you save with them ticked.</p>
      </PopoverContent>
    </Popover>
  );
}
