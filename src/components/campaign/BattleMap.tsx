import { useRef, useState } from 'react';
import type { BattleState, BattleToken, Drawing, EffectKind, MapEffect } from '../../utils/battle';
import EffectView from './EffectView';
import MapMenu from './MapMenu';
import type { MapMenuTarget } from './MapMenu';
import { TOKEN_SIZE, WALK_SPEED, MAX_POINTS, MIN_EFFECT_RADIUS, MAX_EFFECT_RADIUS, movementLeft, playerRole, tokenColor, tokenName, strokeNear, effectAt, removeStroke } from '../../utils/battle';
import type { MapPing } from '../../lib/api/social';

/** What a click or drag on the map does: move tokens, draw or put down a magic effect (GM), or ping a spot for everyone. */
export type MapTool = 'move' | 'draw' | 'erase' | 'ping' | 'effect';

// long names are cut short, but a trailing number ("Hooded Stranger 2") always stays
const short = (name: string) => {
  const m = name.match(/^(.+?)( \d+)$/);
  const [base, n] = m ? [m[1], m[2]] : [name, ''];
  const room = Math.max(3, 9 - n.length);
  return (base.length > room ? `${base.slice(0, room - 1)}…` : base) + n;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const strokePath = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + (pts.length === 1 ? ' l0 0.01' : '');

/** The battle grid: 1 metre squares, characters as 2x2 tokens. The GM can drag every token, a player only their own.
 * With the Draw tool the GM draws on the map; with the Ping tool anyone drops a marker everyone sees for a moment. */
export default function BattleMap({ battle, isGM, viewerId, canMove, onMove, tool = 'move', drawColor = '#ffffff', pings = [], onPing, onStroke, effectKind = 'fire', effectRadius = 2, onEffect, onEdit }: {
  battle: BattleState; isGM: boolean; viewerId: string; canMove: (t: BattleToken) => boolean;
  /** Reports a new square; returns where the token really ended up (a player can be held to their movement). */
  onMove: (id: string, x: number, y: number) => { x: number; y: number } | void;
  tool?: MapTool; drawColor?: string; pings?: MapPing[];
  onPing?: (x: number, y: number) => void;
  /** The GM's stroke so far (called while drawing and once more when the pen lifts). */
  onStroke?: (stroke: Drawing) => void;
  /** The GM's Effect tool: the kind and radius a new effect gets, and a callback for placing or moving one. */
  effectKind?: EffectKind; effectRadius?: number; onEffect?: (e: MapEffect) => void;
  /** The GM changes the map itself (erase a line, the right-click menu); gets the newest map to change. */
  onEdit?: (fn: (b: BattleState) => BattleState) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [live, setLive] = useState<Drawing | null>(null);
  const [fxDrag, setFxDrag] = useState<{ id: string; x: number; y: number; radius: number } | null>(null);
  const [menu, setMenu] = useState<MapMenuTarget | null>(null);
  const latest = useRef(battle);
  latest.current = battle;
  const { cols, rows } = battle;

  const toGrid = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * cols, y: ((clientY - r.top) / r.height) * rows };
  };
  const inside = (q: { x: number; y: number }): [number, number] => [r1(Math.max(0, Math.min(cols, q.x))), r1(Math.max(0, Math.min(rows, q.y)))];

  const startDrag = (e: React.PointerEvent, t: BattleToken) => {
    if (tool !== 'move' || !canMove(t)) return;
    const { id, x: tx, y: ty } = t;
    e.preventDefault();
    const p = toGrid(e.clientX, e.clientY);
    const dx = p.x - tx, dy = p.y - ty;
    const clampPos = (q: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(cols - TOKEN_SIZE, Math.round(q.x - dx))), y: Math.max(0, Math.min(rows - TOKEN_SIZE, Math.round(q.y - dy))),
    });
    let last = { x: tx, y: ty };
    setDrag({ id, ...last });
    // each time the token crosses into a new square it is sent on, so everyone sees it move while the GM drags
    const move = (ev: PointerEvent) => {
      const next = clampPos(toGrid(ev.clientX, ev.clientY));
      if (next.x === last.x && next.y === last.y) return;
      const applied = onMove(id, next.x, next.y);
      last = applied ? { x: applied.x, y: applied.y } : next;
      setDrag({ id, ...last });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Ping and Draw act on the map itself (a token under the pointer does not block them)
  const onMapDown = (e: React.PointerEvent) => {
    if (tool === 'move') {
      // on a touch screen, press and hold on a drawing or effect opens its menu (there is no right click)
      if (isGM && onEdit && e.pointerType === 'touch' && !(e.target as Element).closest?.('[data-token]')) {
        const { clientX, clientY } = e;
        const cancel = () => { window.clearTimeout(timer); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointermove', moved); };
        const start = { x: clientX, y: clientY };
        const moved = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) cancel(); };
        const timer = window.setTimeout(() => { cancel(); openMenuAt(clientX, clientY); }, 550);
        window.addEventListener('pointerup', cancel);
        window.addEventListener('pointermove', moved);
      }
      return;
    }
    e.preventDefault();
    if (tool === 'erase') {
      // drag across a line to erase just that line
      if (!isGM || !onEdit) return;
      const eraseAt = (cx: number, cy: number) => {
        const id = strokeNear(latest.current.drawings, toGrid(cx, cy));
        if (id) onEdit(b => removeStroke(b, id));
      };
      eraseAt(e.clientX, e.clientY);
      const move = (ev: PointerEvent) => eraseAt(ev.clientX, ev.clientY);
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    const p = toGrid(e.clientX, e.clientY);
    if (tool === 'ping') { const [x, y] = inside(p); onPing?.(x, y); return; }
    if (tool === 'effect') {
      if (!isGM || !onEffect) return;
      const snap = (n: number) => Math.round(n * 2) / 2;
      const handle = (e.target as Element).closest?.('[data-fx-handle]');
      const hit = handle ?? (e.target as Element).closest?.('[data-effect]');
      const old = hit ? battle.effects?.find(k => k.id === (hit.getAttribute('data-fx-handle') ?? hit.getAttribute('data-effect'))) : undefined;
      if (old && handle) {
        // the handle on the edge: drag to make the effect as big or as small as needed
        let lastR = old.radius;
        setFxDrag({ id: old.id, x: old.x, y: old.y, radius: lastR });
        const resize = (ev: PointerEvent) => {
          const q = toGrid(ev.clientX, ev.clientY);
          const radius = Math.max(MIN_EFFECT_RADIUS, Math.min(MAX_EFFECT_RADIUS, Math.round(Math.hypot(q.x - old.x, q.y - old.y) * 2) / 2));
          if (radius === lastR) return;
          lastR = radius;
          setFxDrag({ id: old.id, x: old.x, y: old.y, radius });
          onEffect({ ...old, radius });
        };
        const done = () => { window.removeEventListener('pointermove', resize); window.removeEventListener('pointerup', done); setFxDrag(null); };
        window.addEventListener('pointermove', resize);
        window.addEventListener('pointerup', done);
        return;
      }
      if (!old) {
        // empty ground: put a new effect down
        const [x, y] = inside(p);
        onEffect({ id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind: effectKind, x: snap(x), y: snap(y), radius: effectRadius });
        return;
      }
      // on an effect: drag it (a fire that spreads, a wall of ice that moves)
      const dx = p.x - old.x, dy = p.y - old.y;
      let last = { x: old.x, y: old.y };
      setFxDrag({ id: old.id, ...last, radius: old.radius });
      const move = (ev: PointerEvent) => {
        const q = toGrid(ev.clientX, ev.clientY);
        const [nx, ny] = inside({ x: q.x - dx, y: q.y - dy });
        const next = { x: snap(nx), y: snap(ny) };
        if (next.x === last.x && next.y === last.y) return;
        last = next;
        setFxDrag({ id: old.id, ...last, radius: old.radius });
        onEffect({ ...old, ...last });
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setFxDrag(null); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    if (!isGM || !onStroke) return;
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    let pts: [number, number][] = [inside(p)];
    let lastSent = 0;
    const stroke = (): Drawing => ({ id, color: drawColor, points: pts });
    setLive(stroke());
    const move = (ev: PointerEvent) => {
      const [x, y] = inside(toGrid(ev.clientX, ev.clientY));
      const prev = pts[pts.length - 1];
      if (Math.hypot(x - prev[0], y - prev[1]) < 0.25 || pts.length >= MAX_POINTS) return;
      pts = [...pts, [x, y]];
      setLive(stroke());
      const now = Date.now();
      if (now - lastSent > 120) { lastSent = now; onStroke(stroke()); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onStroke(stroke());
      setLive(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Right click (or press and hold) on a drawing or an effect: edit or remove it
  const openMenuAt = (cx: number, cy: number) => {
    const p = toGrid(cx, cy);
    const strokeId = strokeNear(latest.current.drawings, p);
    if (strokeId) { setMenu({ cx, cy, kind: 'stroke', id: strokeId }); return; }
    const fxId = effectAt(latest.current.effects, p);
    if (fxId) setMenu({ cx, cy, kind: 'effect', id: fxId });
  };
  const onContextMenu = (e: React.MouseEvent) => {
    if (!isGM || !onEdit) return;
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  };

  const pingColor = (p: MapPing) => (p.gm ? '#fbbf24' : p.senderId === viewerId ? '#3b82f6' : isGM ? '#a855f7' : '#22c55e');
  const strokes = [...(battle.drawings ?? []).filter(d => d.id !== live?.id), ...(live ? [live] : [])];

  return (
    <>
    <svg ref={svgRef} viewBox={`0 0 ${cols} ${rows}`} className="w-full h-auto block select-none touch-none rounded-lg border border-border" role="img" aria-label="Battle map"
      style={{ cursor: tool === 'move' ? undefined : 'crosshair' }} onPointerDown={onMapDown} onContextMenu={onContextMenu}>
      <rect x={0} y={0} width={cols} height={rows} fill="#0b0a14" />
      {Array.from({ length: cols + 1 }, (_, i) => <line key={`v${i}`} x1={i} y1={0} x2={i} y2={rows} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} strokeWidth={0.03} />)}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i} x2={cols} y2={i} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} strokeWidth={0.03} />)}
      {(battle.effects ?? []).map(fx => {
        const at = fxDrag?.id === fx.id ? { ...fx, x: fxDrag.x, y: fxDrag.y, radius: fxDrag.radius } : fx;
        return <EffectView key={fx.id} fx={at} interactive={tool === 'effect' && isGM} />;
      })}
      {strokes.map(d => (
        <path key={d.id} data-drawing={d.id} d={strokePath(d.points)} fill="none" stroke={d.color} strokeWidth={0.22} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.9} style={{ pointerEvents: 'none' }} />
      ))}
      {battle.tokens.map(t => {
        const x = drag?.id === t.id ? drag.x : t.x;
        const y = drag?.id === t.id ? drag.y : t.y;
        const color = tokenColor(t, viewerId, isGM);
        const shown = tokenName(t, viewerId, isGM);
        const named = true;
        // movement left this turn: a player sees their own, the GM sees it once a token has moved
        const showMove = battle.combat === false ? false : isGM ? (t.moved ?? 0) > 0 : t.kind === 'pc' && playerRole(t, viewerId) === 'self';
        const left = movementLeft(t);
        return (
          <g key={t.id} data-token={t.id} data-color={color} transform={`translate(${x} ${y})`} onPointerDown={e => startDrag(e, t)}
            style={{ cursor: tool === 'move' && canMove(t) ? 'grab' : undefined }}>
            <title>{shown}</title>
            <rect width={TOKEN_SIZE} height={TOKEN_SIZE} rx={0.35} fill={color} fillOpacity={0.9} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={0.08} />
            <text x={TOKEN_SIZE / 2} y={TOKEN_SIZE / 2 + 0.28} textAnchor="middle" fontSize={0.9} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
              {t.kind === 'npc' && t.num ? t.num : shown.charAt(0).toUpperCase()}
            </text>
            {named && (
              <text x={TOKEN_SIZE / 2} y={TOKEN_SIZE + 0.62} textAnchor="middle" fontSize={0.55} fill="#ffffff" stroke="#000000" strokeWidth={0.14} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                {short(shown)}
              </text>
            )}
            {showMove && named && (
              <text x={TOKEN_SIZE / 2} y={TOKEN_SIZE + 1.22} textAnchor="middle" fontSize={0.45} fill={left === 0 ? '#fca5a5' : '#e5e7eb'} stroke="#000000" strokeWidth={0.12} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                {left} / {WALK_SPEED} m
              </text>
            )}
          </g>
        );
      })}
      {pings.map(p => {
        const c = pingColor(p);
        return (
          <g key={p.id} data-ping={p.id} data-color={c} transform={`translate(${p.x} ${p.y})`} style={{ pointerEvents: 'none' }}>
            <circle r={0.32} fill={c} stroke="#ffffff" strokeWidth={0.08} />
            <circle r={0.3} fill="none" stroke={c} strokeWidth={0.16}>
              <animate attributeName="r" from="0.3" to="2.6" dur="1.1s" repeatCount="4" />
              <animate attributeName="opacity" from="1" to="0" dur="1.1s" repeatCount="4" />
            </circle>
            {p.name && (
              <text y={-0.7} textAnchor="middle" fontSize={0.55} fontWeight={700} fill="#ffffff" stroke="#000000" strokeWidth={0.14} paintOrder="stroke">{short(p.name)}</text>
            )}
          </g>
        );
      })}
    </svg>
    {menu && onEdit && <MapMenu target={menu} battle={battle} onEdit={onEdit} onClose={() => setMenu(null)} />}
    </>
  );
}
