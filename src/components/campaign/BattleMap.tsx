import { useRef, useState } from 'react';
import type { BattleState, BattleToken } from '../../utils/battle';
import { TOKEN_SIZE, WALK_SPEED, movementLeft, playerRole, tokenColor, showTokenName } from '../../utils/battle';

const short = (name: string) => (name.length > 9 ? `${name.slice(0, 8)}…` : name);

/** The battle grid: 1 metre squares, characters as 2x2 tokens. The GM can drag every token, a player only their own. */
export default function BattleMap({ battle, isGM, viewerId, canMove, onMove }: {
  battle: BattleState; isGM: boolean; viewerId: string; canMove: (t: BattleToken) => boolean;
  /** Reports a new square; returns where the token really ended up (a player can be held to their movement). */
  onMove: (id: string, x: number, y: number) => { x: number; y: number } | void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const { cols, rows } = battle;

  const toGrid = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * cols, y: ((clientY - r.top) / r.height) * rows };
  };

  const startDrag = (e: React.PointerEvent, t: BattleToken) => {
    if (!canMove(t)) return;
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

  return (
    <svg ref={svgRef} viewBox={`0 0 ${cols} ${rows}`} className="w-full h-auto block select-none touch-none rounded-lg border border-border" role="img" aria-label="Battle map">
      <rect x={0} y={0} width={cols} height={rows} fill="#0b0a14" />
      {Array.from({ length: cols + 1 }, (_, i) => <line key={`v${i}`} x1={i} y1={0} x2={i} y2={rows} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} strokeWidth={0.03} />)}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i} x2={cols} y2={i} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} strokeWidth={0.03} />)}
      {battle.tokens.map(t => {
        const x = drag?.id === t.id ? drag.x : t.x;
        const y = drag?.id === t.id ? drag.y : t.y;
        const color = tokenColor(t, viewerId, isGM);
        const named = showTokenName(t, viewerId, isGM);
        // movement left this turn: a player sees their own, the GM sees it once a token has moved
        const showMove = isGM ? (t.moved ?? 0) > 0 : t.kind === 'pc' && playerRole(t, viewerId) === 'self';
        const left = movementLeft(t);
        return (
          <g key={t.id} data-token={t.id} data-color={color} transform={`translate(${x} ${y})`} onPointerDown={e => startDrag(e, t)}
            style={{ cursor: canMove(t) ? 'grab' : 'default' }}>
            <title>{named ? t.name : 'Enemy'}</title>
            <rect width={TOKEN_SIZE} height={TOKEN_SIZE} rx={0.35} fill={color} fillOpacity={0.9} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={0.08} />
            <text x={TOKEN_SIZE / 2} y={TOKEN_SIZE / 2 + 0.28} textAnchor="middle" fontSize={0.9} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
              {named ? t.name.charAt(0).toUpperCase() : '?'}
            </text>
            {named && (
              <text x={TOKEN_SIZE / 2} y={TOKEN_SIZE + 0.62} textAnchor="middle" fontSize={0.55} fill="#ffffff" stroke="#000000" strokeWidth={0.14} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                {short(t.name)}
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
    </svg>
  );
}
