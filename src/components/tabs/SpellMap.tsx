import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  GRID_W, GRID_H, TOKEN_SIZE, blastSquares, waveSquares, coneSquares, tokenHit, tokenCenter,
  pointInToken, chainTargetCount, clamp, type Point, type Token, type Square,
} from '../../utils/spellGeometry';

const CELL = 28;

const ELEMENT_COLORS: Record<string, string> = {
  Fire: '#ef4444', Lightning: '#facc15', Frost: '#38bdf8', Poison: '#22c55e', Arcane: '#a78bfa',
};
const HEAL_COLOR = '#34d399';

interface Props {
  boltName: string;
  element: string;
  isHealing: boolean;
  /** Mana spent on each modifier (0 = not active). */
  blastMana: number;
  waveConeMana: number;
  chainMana: number;
  /** Cone size in meters (from the builder's length/width splitter). */
  coneLength: number;
  coneWidth: number;
}

type Drag = { kind: 'caster' | 'aim' | 'token'; id?: string; dx: number; dy: number; moved: boolean };

const snap = (v: number, step: number) => Math.round(v / step) * step;

export default function SpellMap({ boltName, element, isHealing, blastMana, waveConeMana, chainMana, coneLength, coneWidth }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [caster, setCaster] = useState<Token>({ id: 'caster', kind: 'caster', x: 3, y: 7 });
  const [aim, setAim] = useState<Point>({ x: 11, y: 8 });
  const [tokens, setTokens] = useState<Token[]>([]);
  const [shape, setShape] = useState<'wave' | 'cone'>('cone');
  const [chainIds, setChainIds] = useState<string[]>([]);
  const nextId = useRef(1);

  const color = isHealing ? HEAL_COLOR : ELEMENT_COLORS[element] ?? '#a78bfa';
  const blastRadius = blastMana > 0 ? 2 + (blastMana - 1) : 0;
  const waveRadius = waveConeMana > 0 ? 1 + (waveConeMana - 1) : 0;
  const chainCount = chainTargetCount(chainMana);

  const casterC = tokenCenter(caster);
  const angle = Math.atan2(aim.y - casterC.y, aim.x - casterC.x);

  // ── Affected squares ──
  const areas: Array<{ key: string; squares: Set<Square>; opacity: number }> = [];
  if (blastMana > 0) areas.push({ key: 'blast', squares: blastSquares(aim, blastRadius), opacity: 0.45 });
  if (waveConeMana > 0) {
    areas.push(shape === 'wave'
      ? { key: 'wave', squares: waveSquares(caster, waveRadius), opacity: 0.4 }
      : { key: 'cone', squares: coneSquares(caster, angle, coneLength, coneWidth), opacity: 0.4 });
  }

  // ── Who is hit ──
  const primary = tokens.find(t => t.kind !== 'caster' && pointInToken(aim, t));
  const chainTargets = chainIds
    .map(id => tokens.find(t => t.id === id))
    .filter((t): t is Token => !!t && t.kind === 'enemy' && t.id !== primary?.id)
    .slice(0, chainCount);
  const hitIds = new Set<string>();
  if (primary) hitIds.add(primary.id);
  for (const t of chainTargets) hitIds.add(t.id);
  for (const t of tokens) if (areas.some(a => tokenHit(t, a.squares))) hitIds.add(t.id);
  const casterInArea = areas.some(a => tokenHit(caster, a.squares));
  const enemiesHit = tokens.filter(t => t.kind === 'enemy' && hitIds.has(t.id)).length;
  const alliesHit = tokens.filter(t => t.kind === 'ally' && hitIds.has(t.id)).length;

  // ── Pointer handling ──
  const toGrid = (e: React.PointerEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * GRID_W, y: ((e.clientY - r.top) / r.height) * GRID_H };
  };
  const startDrag = (e: React.PointerEvent, kind: Drag['kind'], origin: Point, id?: string) => {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    const p = toGrid(e);
    drag.current = { kind, id, dx: p.x - origin.x, dy: p.y - origin.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toGrid(e);
    d.moved = true;
    if (d.kind === 'aim') {
      setAim({ x: clamp(snap(p.x - d.dx, 0.5), 0, GRID_W), y: clamp(snap(p.y - d.dy, 0.5), 0, GRID_H) });
      return;
    }
    const pos = { x: clamp(Math.round(p.x - d.dx), 0, GRID_W - TOKEN_SIZE), y: clamp(Math.round(p.y - d.dy), 0, GRID_H - TOKEN_SIZE) };
    if (d.kind === 'caster') setCaster(c => ({ ...c, ...pos }));
    else setTokens(ts => ts.map(t => (t.id === d.id ? { ...t, ...pos } : t)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // a tap (no drag) on an enemy picks it as a Chain hop
    if (d && d.kind === 'token' && !d.moved && chainCount > 0) {
      const t = tokens.find(x => x.id === d.id);
      if (t && t.kind === 'enemy' && t.id !== primary?.id) {
        setChainIds(ids => (ids.includes(t.id) ? ids.filter(i => i !== t.id) : ids.length < chainCount ? [...ids, t.id] : ids));
      }
    }
  };

  const addToken = (kind: 'enemy' | 'ally') => {
    const n = tokens.filter(t => t.kind === kind).length;
    const x = kind === 'enemy' ? 13 + (n % 4) * 3 : 3 + (n % 4) * 3;
    const y = kind === 'enemy' ? 2 + Math.floor(n / 4) * 3 + (n % 2) : 12 - Math.floor(n / 4) * 3;
    setTokens(ts => [...ts, { id: `t${nextId.current++}`, kind, x: clamp(x, 0, GRID_W - TOKEN_SIZE), y: clamp(y, 0, GRID_H - TOKEN_SIZE) }]);
  };
  const removeToken = (id: string) => {
    setTokens(ts => ts.filter(t => t.id !== id));
    setChainIds(ids => ids.filter(i => i !== id));
  };

  const fillFor = (kind: Token['kind']) => (kind === 'enemy' ? '#7f1d1d' : kind === 'ally' ? '#14532d' : '#312e81');
  const strokeFor = (kind: Token['kind']) => (kind === 'enemy' ? '#f87171' : kind === 'ally' ? '#4ade80' : '#a5b4fc');

  const renderToken = (t: Token) => {
    const hit = hitIds.has(t.id);
    const chainIndex = chainTargets.findIndex(c => c.id === t.id);
    const x = t.x * CELL, y = t.y * CELL, s = TOKEN_SIZE * CELL;
    return (
      <g key={t.id} onPointerDown={e => startDrag(e, t.kind === 'caster' ? 'caster' : 'token', { x: t.x, y: t.y }, t.id)} style={{ cursor: 'grab' }}>
        <rect x={x + 2} y={y + 2} width={s - 4} height={s - 4} rx={8} fill={fillFor(t.kind)} stroke={hit ? '#ffffff' : strokeFor(t.kind)} strokeWidth={hit ? 3 : 1.5} />
        <text x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {t.kind === 'caster' ? 'You' : t.kind === 'enemy' ? 'Foe' : 'Ally'}
        </text>
        {chainIndex >= 0 && (
          <text x={x + 8} y={y + 16} fontSize={11} fontWeight="bold" fill="#facc15" style={{ pointerEvents: 'none' }}>⛓{chainIndex + 1}</text>
        )}
        {t.kind !== 'caster' && (
          <g onPointerDown={e => { e.stopPropagation(); removeToken(t.id); }} style={{ cursor: 'pointer' }}>
            <circle cx={x + s - 7} cy={y + 7} r={7} fill="#111827" stroke="#9ca3af" />
            <text x={x + s - 7} y={y + 11} textAnchor="middle" fontSize={10} fill="#e5e7eb" style={{ pointerEvents: 'none' }}>×</text>
          </g>
        )}
      </g>
    );
  };

  const chainPath = [primary, ...chainTargets].filter((t): t is Token => !!t);
  const hasArea = areas.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground">Spell Map</span>
        <span className="text-[10px] text-muted-foreground">1 square = 1 m · a medium creature fills 2×2</span>
        <div className="ml-auto flex gap-1.5 flex-wrap">
          {waveConeMana > 0 && (
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {(['wave', 'cone'] as const).map(s => (
                <button key={s} onClick={() => setShape(s)}
                  className={`px-2 py-1 text-[11px] font-semibold capitalize ${shape === s ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToken('enemy')}>+ Enemy</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToken('ally')}>+ Ally</Button>
          {tokens.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setTokens([]); setChainIds([]); }}>Clear</Button>}
        </div>
      </div>

      <div className="rounded-md border border-border bg-background overflow-hidden">
        <svg ref={svgRef} viewBox={`0 0 ${GRID_W * CELL} ${GRID_H * CELL}`} className="w-full h-auto block select-none"
          style={{ touchAction: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect x={0} y={0} width={GRID_W * CELL} height={GRID_H * CELL} fill="#0b0a14" />
          {Array.from({ length: GRID_W + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={GRID_H * CELL} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} />
          ))}
          {Array.from({ length: GRID_H + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * CELL} x2={GRID_W * CELL} y2={i * CELL} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} />
          ))}

          {areas.map(a => [...a.squares].map(s => {
            const [sx, sy] = s.split(',').map(Number);
            return <rect key={`${a.key}-${s}`} x={sx * CELL} y={sy * CELL} width={CELL} height={CELL} fill={color} fillOpacity={a.opacity} stroke={color} strokeOpacity={0.7} />;
          }))}

          {/* Bolt line and Chain hops */}
          <line x1={casterC.x * CELL} y1={casterC.y * CELL} x2={aim.x * CELL} y2={aim.y * CELL} stroke={color} strokeWidth={2} strokeDasharray="5 4" />
          {chainPath.length > 1 && (
            <polyline points={chainPath.map(t => { const c = tokenCenter(t); return `${c.x * CELL},${c.y * CELL}`; }).join(' ')}
              fill="none" stroke="#facc15" strokeWidth={2.5} />
          )}

          {tokens.map(renderToken)}
          {renderToken(caster)}

          {/* Aim point */}
          <g onPointerDown={e => startDrag(e, 'aim', aim)} style={{ cursor: 'crosshair' }}>
            <circle cx={aim.x * CELL} cy={aim.y * CELL} r={14} fill="transparent" />
            <circle cx={aim.x * CELL} cy={aim.y * CELL} r={7} fill="none" stroke="#ffffff" strokeWidth={2} />
            <line x1={aim.x * CELL - 11} y1={aim.y * CELL} x2={aim.x * CELL + 11} y2={aim.y * CELL} stroke="#ffffff" strokeWidth={1.5} />
            <line x1={aim.x * CELL} y1={aim.y * CELL - 11} x2={aim.x * CELL} y2={aim.y * CELL + 11} stroke="#ffffff" strokeWidth={1.5} />
          </g>
        </svg>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>
          Drag <span className="text-foreground">You</span>, the foes/allies and the <span className="text-foreground">crosshair</span> (the aim point).
          {blastMana > 0 && ` Blast: ${blastRadius} m radius around the crosshair.`}
          {waveConeMana > 0 && (shape === 'wave'
            ? ` Wave: ${waveRadius} m out from you.`
            : ` Cone: ${coneLength} m long, ${coneWidth} m wide at the end, toward the crosshair.`)}
        </p>
        {chainCount > 0 && (
          <p>Chain: aim at an enemy, then tap up to {chainCount} more enemies to hop to ({chainTargets.length}/{chainCount} chosen).</p>
        )}
        {tokens.length > 0 && (
          <p className="text-foreground">
            {boltName}: {enemiesHit} enem{enemiesHit === 1 ? 'y' : 'ies'} hit · {alliesHit} all{alliesHit === 1 ? 'y' : 'ies'} {isHealing ? 'reached' : 'hit'}
            {casterInArea && hasArea ? ' · you are inside the area' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
