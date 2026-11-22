import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BattleState } from '../../utils/battle';
import {
  DRAW_COLORS, EFFECT_KINDS, MIN_EFFECT_RADIUS, MAX_EFFECT_RADIUS, recolorStroke, removeStroke, removeEffect, upsertEffect,
} from '../../utils/battle';
import { EFFECT_STYLES } from './EffectView';

/** What the GM right-clicked (or pressed and held) on the map. */
export interface MapMenuTarget { cx: number; cy: number; kind: 'stroke' | 'effect'; id: string }

/** The right-click menu for a drawing (change its colour, remove it) or a magic effect (change what it is and how big
 * it is, remove it). It reads the live map, so what it shows follows every change. */
export default function MapMenu({ target, battle, onEdit, onClose }: {
  target: MapMenuTarget; battle: BattleState; onEdit: (fn: (b: BattleState) => BattleState) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stroke = target.kind === 'stroke' ? battle.drawings?.find(d => d.id === target.id) : undefined;
  const fx = target.kind === 'effect' ? battle.effects?.find(e => e.id === target.id) : undefined;

  // closes on a click anywhere else, on Escape, and when the thing it points at is gone
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [onClose]);
  useEffect(() => { if (!stroke && !fx) onClose(); }, [stroke, fx, onClose]);
  if (!stroke && !fx) return null;

  const left = Math.max(8, Math.min(target.cx, window.innerWidth - 240));
  const top = Math.max(8, Math.min(target.cy, window.innerHeight - 250));

  return createPortal(
    <div ref={ref} role="menu" aria-label={stroke ? 'Drawing menu' : 'Effect menu'} style={{ left, top }}
      className="fixed z-50 w-56 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-2.5 space-y-2.5"
      onContextMenu={e => e.preventDefault()}>
      {stroke && (
        <>
          <p className="text-xs font-semibold">Drawing</p>
          <div className="flex items-center gap-1.5">
            {DRAW_COLORS.map(c => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={stroke.color === c} onClick={() => onEdit(b => recolorStroke(b, stroke.id, c))}
                className={`h-6 w-6 rounded-full border-2 ${stroke.color === c ? 'border-primary' : 'border-border'}`} style={{ background: c }} />
            ))}
          </div>
          <Button size="sm" variant="destructive" className="h-7 w-full text-xs gap-1" onClick={() => { onEdit(b => removeStroke(b, stroke.id)); onClose(); }}>
            <Trash2 className="h-3 w-3" />Remove drawing
          </Button>
        </>
      )}
      {fx && (
        <>
          <p className="text-xs font-semibold">{EFFECT_STYLES[fx.kind].emoji} {EFFECT_STYLES[fx.kind].label}</p>
          <div className="flex items-center gap-1 flex-wrap">
            {EFFECT_KINDS.map(k => (
              <button key={k} type="button" aria-label={EFFECT_STYLES[k].label} title={EFFECT_STYLES[k].label} aria-pressed={fx.kind === k} onClick={() => onEdit(b => upsertEffect(b, { ...fx, kind: k }))}
                className={`h-7 w-7 rounded-md border-2 text-sm leading-none ${fx.kind === k ? 'border-primary bg-primary/10' : 'border-border'}`}>{EFFECT_STYLES[k].emoji}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Smaller" disabled={fx.radius <= MIN_EFFECT_RADIUS} onClick={() => onEdit(b => upsertEffect(b, { ...fx, radius: fx.radius - 1 }))}><Minus className="h-3 w-3" /></Button>
            <Input key={fx.radius} type="number" min={MIN_EFFECT_RADIUS} max={MAX_EFFECT_RADIUS} step={0.5} defaultValue={fx.radius} aria-label="Radius in metres" className="h-7 w-16 text-xs text-center px-1"
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onBlur={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v !== fx.radius) onEdit(b => upsertEffect(b, { ...fx, radius: v })); }} />
            <span className="text-xs text-muted-foreground">m radius</span>
            <Button size="icon" variant="outline" className="h-7 w-7 ml-auto" aria-label="Bigger" disabled={fx.radius >= MAX_EFFECT_RADIUS} onClick={() => onEdit(b => upsertEffect(b, { ...fx, radius: fx.radius + 1 }))}><Plus className="h-3 w-3" /></Button>
          </div>
          <Button size="sm" variant="destructive" className="h-7 w-full text-xs gap-1" onClick={() => { onEdit(b => removeEffect(b, fx.id)); onClose(); }}>
            <Trash2 className="h-3 w-3" />Remove effect
          </Button>
        </>
      )}
    </div>,
    document.body,
  );
}
