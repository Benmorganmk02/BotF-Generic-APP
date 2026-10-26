import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GRID_W, GRID_H, TOKEN_SIZE, blastSquares, waveSquares, coneSquares, coneTriangle, coneFromAim, conePool,
  waveRadiusFor, blastRadiusFor, followBlastRadius, followConePool, tokenHit, tokenCenter, pointInToken, chainTargetCount, chainHops, chainEligible, CHAIN_RANGE, clamp,
  type Point, type Token, type Square,
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
  /** Advanced molding: a Blast or Wave that follows the Chain, and how many chained hits it fires from (the main target counts as the first). */
  followShape: 'blast' | 'cone' | null;
  followCount: number;
  /** Size steps bought for the follow-up shape (0-2). */
  followSize: number;
}

type Drag = { kind: 'caster' | 'aim' | 'token' | 'hop'; lastP?: Point; id?: string; dx: number; dy: number; moved: boolean; carryAim?: boolean; lastX?: number; lastY?: number };

const snap = (v: number, step: number) => Math.round(v / step) * step;
const px = (v: number) => v * CELL;

const FOLLOW_COLOR = '#fb923c';

export default function SpellMap({ boltName, element, isHealing, blastMana, waveConeMana, chainMana, followShape, followCount, followSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [caster, setCaster] = useState<Token>({ id: 'caster', kind: 'caster', x: 3, y: 7 });
  const [aim, setAim] = useState<Point>({ x: 11, y: 8 });
  const [tokens, setTokens] = useState<Token[]>([]);
  // which enemy the player aimed each Chain jump at (index = jump); undefined = automatic nearest
  const [hopOverrides, setHopOverrides] = useState<Array<string | undefined>>([]);
  const [hopDrag, setHopDrag] = useState<{ index: number; p: Point } | null>(null);
  const nextId = useRef(1);
  // The map starts folded away; token positions are kept while it is closed.
  const [open, setOpen] = useState(false);

  const color = isHealing ? HEAL_COLOR : ELEMENT_COLORS[element] ?? '#a78bfa';
  const blastRadius = blastRadiusFor(blastMana);
  const pool = conePool(waveConeMana);
  const waveRadius = waveRadiusFor(waveConeMana);
  const chainCount = chainTargetCount(chainMana);

  const casterC = tokenCenter(caster);
  const cone = waveConeMana > 0 ? coneFromAim(caster, aim, pool) : null;

  // ── The true shapes, and the grid squares each one touches ──
  const squaresByKey: Record<string, Set<Square>> = {};
  if (blastMana > 0) squaresByKey.blast = blastSquares(aim, blastRadius);
  if (cone) {
    squaresByKey.sweep = cone.mode === 'wave'
      ? waveSquares(caster, waveRadius)
      : coneSquares(caster, cone.angle, cone.length, cone.width);
  }
  const areas = Object.values(squaresByKey);

  // ── Who is hit ──
  const primary = tokens.find(t => t.kind !== 'caster' && pointInToken(aim, t));
  const chainTargets = primary && primary.kind === 'enemy' && chainCount > 0
    ? chainHops(primary, tokens.filter(t => t.kind === 'enemy'), chainCount, CHAIN_RANGE, hopOverrides)
    : [];
  // Advanced molding: the follow-up shape fires from the main target, then from the first chained hits.
  // A follow-up Cone points away from where the spell came from: from the caster into the main target,
  // and from the previous hit into each chained hit.
  const followChain = primary ? [primary, ...chainTargets] : [];
  const followBlastR = followBlastRadius(followSize);
  const followHalf = followConePool(followSize) / 2;
  const followShapes = (followShape ? followChain.slice(0, followCount) : []).map(src => {
    const idx = followChain.indexOf(src);
    const from = idx === 0 ? casterC : tokenCenter(followChain[idx - 1]);
    const c = tokenCenter(src);
    const angle = Math.atan2(c.y - from.y, c.x - from.x);
    return { src, angle };
  });
  const followSquares = new Set<Square>();
  for (const { src, angle } of followShapes) {
    const squares = followShape === 'blast'
      ? blastSquares(tokenCenter(src), followBlastR)
      : coneSquares(src, angle, followHalf, followHalf);
    squares.forEach(s => followSquares.add(s));
  }
  const hitIds = new Set<string>();
  if (primary) hitIds.add(primary.id);
  for (const t of chainTargets) hitIds.add(t.id);
  for (const t of tokens) if (areas.some(a => tokenHit(t, a))) hitIds.add(t.id);
  const followHitIds = new Set(tokens.filter(t => followSquares.size > 0 && tokenHit(t, followSquares)).map(t => t.id));
  followHitIds.forEach(id => hitIds.add(id));
  const followEnemies = tokens.filter(t => t.kind === 'enemy' && followHitIds.has(t.id)).length;
  const followAllies = tokens.filter(t => t.kind === 'ally' && followHitIds.has(t.id)).length;
  const casterInArea = areas.some(a => tokenHit(caster, a)) || (followSquares.size > 0 && tokenHit(caster, followSquares));
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
    drag.current = {
      kind, id, dx: p.x - origin.x, dy: p.y - origin.y, moved: false,
      // a marker sitting on top of the caster travels with them, so a 360 wave stays a 360 wave
      carryAim: kind === 'caster' && pointInToken(aim, caster),
      lastX: caster.x, lastY: caster.y,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toGrid(e);
    d.moved = true;
    if (d.kind === 'hop') {
      const hp = { x: p.x - d.dx, y: p.y - d.dy };
      d.lastP = hp;
      setHopDrag({ index: Number(d.id), p: hp });
      return;
    }
    if (d.kind === 'aim') {
      setAim({ x: clamp(snap(p.x - d.dx, 0.5), 0, GRID_W), y: clamp(snap(p.y - d.dy, 0.5), 0, GRID_H) });
      return;
    }
    const pos = { x: clamp(Math.round(p.x - d.dx), 0, GRID_W - TOKEN_SIZE), y: clamp(Math.round(p.y - d.dy), 0, GRID_H - TOKEN_SIZE) };
    if (d.kind === 'caster') {
      if (d.carryAim) {
        const mx = pos.x - (d.lastX ?? pos.x), my = pos.y - (d.lastY ?? pos.y);
        setAim(a => ({ x: a.x + mx, y: a.y + my }));
      }
      d.lastX = pos.x; d.lastY = pos.y;
      setCaster(c => ({ ...c, ...pos }));
    } else setTokens(ts => ts.map(t => (t.id === d.id ? { ...t, ...pos } : t)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === 'hop') {
      const index = Number(d.id);
      const target = d.moved && d.lastP && primary
        ? tokens.find(t => t.kind === 'enemy' && pointInToken(d.lastP!, t) && chainEligible(primary, t))
        : undefined;
      // dropped on an eligible enemy: aim this jump there; dropped anywhere else: back to automatic
      if (d.moved) setHopOverrides(o => { const next = [...o]; next[index] = target?.id; return next; });
      setHopDrag(null);
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
  };

  const fillFor = (kind: Token['kind']) => (kind === 'enemy' ? '#7f1d1d' : kind === 'ally' ? '#14532d' : '#312e81');
  const strokeFor = (kind: Token['kind']) => (kind === 'enemy' ? '#f87171' : kind === 'ally' ? '#4ade80' : '#a5b4fc');

  const renderToken = (t: Token) => {
    const hit = hitIds.has(t.id);
    const x = px(t.x), y = px(t.y), s = px(TOKEN_SIZE);
    return (
      <g key={t.id} onPointerDown={e => startDrag(e, t.kind === 'caster' ? 'caster' : 'token', { x: t.x, y: t.y }, t.id)} style={{ cursor: 'grab' }}>
        <rect x={x + 2} y={y + 2} width={s - 4} height={s - 4} rx={8} fill={fillFor(t.kind)} stroke={hit ? '#ffffff' : strokeFor(t.kind)} strokeWidth={hit ? 3 : 1.5} />
        <text x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {t.kind === 'caster' ? 'You' : t.kind === 'enemy' ? 'Foe' : 'Ally'}
        </text>
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

  // True shapes drawn under the shaded grid squares
  const trueShapeProps = { fill: color, fillOpacity: 0.16, stroke: color, strokeWidth: 2, strokeOpacity: 0.95 };
  const squareLayer = (key: string, squares: Set<Square>) => [...squares].map(s => {
    const [sx, sy] = s.split(',').map(Number);
    return <rect key={`${key}-${s}`} x={px(sx)} y={px(sy)} width={CELL} height={CELL} fill={color} fillOpacity={0.42} stroke={color} strokeOpacity={0.8} />;
  });

  const sweepText = !cone ? '' : cone.mode === 'wave'
    ? ` Marker on you: a 360° wave, ${waveRadius} m out from you.`
    : ` Cone: ${cone.length} m long, ${cone.width} m wide at the end (${pool} m total: the nearer the marker, the wider it gets).`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 -ml-1 text-xs font-semibold text-foreground hover:bg-muted">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Spell Map {open ? '' : '(tap to open)'}
        </button>
        {open && <span className="text-[10px] text-muted-foreground">1 square = 1 m · a medium creature fills 2×2</span>}
        {open && <div className="ml-auto flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToken('enemy')}>+ Enemy</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToken('ally')}>+ Ally</Button>
          {tokens.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTokens([])}>Clear</Button>}
        </div>}
      </div>

      {open && (<>

      <div className="rounded-md border border-border bg-background overflow-hidden">
        <svg ref={svgRef} viewBox={`0 0 ${GRID_W * CELL} ${GRID_H * CELL}`} className="w-full h-auto block select-none"
          style={{ touchAction: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect x={0} y={0} width={GRID_W * CELL} height={GRID_H * CELL} fill="#0b0a14" />
          {Array.from({ length: GRID_W + 1 }, (_, i) => (
            <line key={`v${i}`} x1={px(i)} y1={0} x2={px(i)} y2={GRID_H * CELL} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} />
          ))}
          {Array.from({ length: GRID_H + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={px(i)} x2={GRID_W * CELL} y2={px(i)} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.14 : 0.07} />
          ))}

          {/* 1. the true shapes */}
          {blastMana > 0 && <circle cx={px(aim.x)} cy={px(aim.y)} r={px(blastRadius)} {...trueShapeProps} />}
          {cone?.mode === 'cone' && (
            <polygon points={coneTriangle(caster, cone.angle, cone.length, cone.width).map(p => `${px(p.x)},${px(p.y)}`).join(' ')} {...trueShapeProps} />
          )}
          {cone?.mode === 'wave' && (
            <rect x={px(caster.x - waveRadius)} y={px(caster.y - waveRadius)} width={px(TOKEN_SIZE + waveRadius * 2)} height={px(TOKEN_SIZE + waveRadius * 2)}
              rx={px(waveRadius)} {...trueShapeProps} />
          )}

          {/* Follow-up shapes (advanced molding), from the main target and the chained hits */}
          {followShapes.map(({ src, angle }) => {
            const c = tokenCenter(src);
            return followShape === 'blast'
              ? <circle key={`fs-${src.id}`} cx={px(c.x)} cy={px(c.y)} r={px(followBlastR)} fill={FOLLOW_COLOR} fillOpacity={0.14} stroke={FOLLOW_COLOR} strokeWidth={2} strokeDasharray="6 4" />
              : <polygon key={`fs-${src.id}`} points={coneTriangle(src, angle, followHalf, followHalf).map(p => `${px(p.x)},${px(p.y)}`).join(' ')}
                  fill={FOLLOW_COLOR} fillOpacity={0.14} stroke={FOLLOW_COLOR} strokeWidth={2} strokeDasharray="6 4" />;
          })}

          {/* 2. the grid squares they touch, on top */}
          {Object.entries(squaresByKey).map(([key, squares]) => squareLayer(key, squares))}

          {[...followSquares].map(s => {
            const [sx, sy] = s.split(',').map(Number);
            return <rect key={`f-${s}`} x={px(sx)} y={px(sy)} width={CELL} height={CELL} fill={FOLLOW_COLOR} fillOpacity={0.4} stroke={FOLLOW_COLOR} strokeOpacity={0.8} />;
          })}

          {/* Bolt line and Chain hops */}
          <line x1={px(casterC.x)} y1={px(casterC.y)} x2={px(aim.x)} y2={px(aim.y)} stroke={color} strokeWidth={2} strokeDasharray="5 4" />
          {chainPath.length > 1 && (
            <polyline points={chainPath.map(t => { const c = tokenCenter(t); return `${px(c.x)},${px(c.y)}`; }).join(' ')}
              fill="none" stroke="#facc15" strokeWidth={2.5} />
          )}

          {tokens.map(renderToken)}
          {renderToken(caster)}

          {/* Chain jump markers: drag one onto another enemy to aim that jump yourself */}
          {chainTargets.map((t, i) => {
            const c = hopDrag?.index === i ? hopDrag.p : tokenCenter(t);
            return (
              <g key={`hop${i}`} onPointerDown={e => startDrag(e, 'hop', tokenCenter(t), String(i))} style={{ cursor: 'grab' }}>
                <circle cx={px(c.x)} cy={px(c.y)} r={11} fill="#facc15" stroke="#111827" strokeWidth={1.5} />
                <text x={px(c.x)} y={px(c.y) + 4} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#111827" style={{ pointerEvents: 'none', userSelect: 'none' }}>{i + 1}</text>
              </g>
            );
          })}

          {/* Aim marker */}
          <g onPointerDown={e => startDrag(e, 'aim', aim)} style={{ cursor: 'crosshair' }}>
            <circle cx={px(aim.x)} cy={px(aim.y)} r={14} fill="transparent" />
            <circle cx={px(aim.x)} cy={px(aim.y)} r={7} fill="none" stroke="#ffffff" strokeWidth={2} />
            <line x1={px(aim.x) - 11} y1={px(aim.y)} x2={px(aim.x) + 11} y2={px(aim.y)} stroke="#ffffff" strokeWidth={1.5} />
            <line x1={px(aim.x)} y1={px(aim.y) - 11} x2={px(aim.x)} y2={px(aim.y) + 11} stroke="#ffffff" strokeWidth={1.5} />
          </g>
        </svg>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>
          Drag <span className="text-foreground">You</span>, the foes/allies and the <span className="text-foreground">marker</span> (the crosshair).
          {blastMana > 0 && ` Blast: ${blastRadius} m radius circle around the marker.`}
          {sweepText}
        </p>
        {followShape && (
          <p>
            Follow-up {followShape === 'blast' ? `Blast (${followBlastR} m radius)` : `Cone (${followHalf} m × ${followHalf} m, pointing away from where it was hit)`} (orange): fires from the main target
            {followCount === 2 ? ' and the first chained hit' : followCount > 2 ? ` and the first ${followCount - 1} chained hits` : ''}
            {followShapes.length === 0 ? ' — aim the marker at an enemy to start it.' : `. Hits: ${followEnemies} enem${followEnemies === 1 ? 'y' : 'ies'}, ${followAllies} all${followAllies === 1 ? 'y' : 'ies'} (a second set of damage).`}
          </p>
        )}
        {chainCount > 0 && (
          <p>Chain: aim the marker at an enemy (the main target). Each jump (numbered yellow marker) goes to the nearest enemy within {CHAIN_RANGE} m of the main target on its own ({chainTargets.length}/{chainCount} found). Drag a jump marker onto a different enemy to aim it yourself, or drop it on empty ground to go back to automatic.</p>
        )}
        {tokens.length > 0 && (
          <p className="text-foreground">
            {boltName}: {enemiesHit} enem{enemiesHit === 1 ? 'y' : 'ies'} hit · {alliesHit} all{alliesHit === 1 ? 'y' : 'ies'} {isHealing ? 'reached' : 'hit'}
            {casterInArea && areas.length > 0 ? ' · you are inside the area' : ''}
          </p>
        )}
      </div>
      </>)}
    </div>
  );
}
