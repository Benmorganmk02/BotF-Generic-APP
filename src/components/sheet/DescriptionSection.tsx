import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

/** A description that can be shown or hidden: a small "Description" line with an arrow (and a dot when there is text);
 * open it to read or edit the text. When closed, `preview` shows the first line of the text underneath. */
export default function DescriptionSection({ value, onChange, label = 'Description', placeholder = 'Write a description...', preview = false, defaultOpen = false, className = '' }: {
  value: string; onChange: (text: string) => void; label?: string; placeholder?: string;
  /** Show the first lines of the text under the toggle while it is hidden. */
  preview?: boolean; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const has = value.trim().length > 0;
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
        {has && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Has a description" />}
      </button>
      {open ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
          rows={Math.min(8, Math.max(2, value.split('\n').length))} className="mt-1 text-xs min-h-0" />
      ) : preview && has ? (
        <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{value}</p>
      ) : null}
    </div>
  );
}
