/** Spell map geometry. The game grid is 1 meter squares and a medium humanoid
 * fills 2x2 squares. Square (x, y) spans [x, x+1] x [y, y+1], so its centre is
 * (x + 0.5, y + 0.5). Everything here is pure so it can be tested on its own. */

export const GRID_W = 24;
export const GRID_H = 16;
export const TOKEN_SIZE = 2;

export interface Point { x: number; y: number }
export interface Token { id: string; kind: 'caster' | 'enemy' | 'ally'; x: number; y: number }
export type Square = `${number},${number}`;

const sq = (x: number, y: number): Square => `${x},${y}`;
export const tokenRect = (t: Pick<Token, 'x' | 'y'>) => ({ x: t.x, y: t.y, w: TOKEN_SIZE, h: TOKEN_SIZE });
export const tokenCenter = (t: Pick<Token, 'x' | 'y'>): Point => ({ x: t.x + TOKEN_SIZE / 2, y: t.y + TOKEN_SIZE / 2 });

export const tokenSquares = (t: Pick<Token, 'x' | 'y'>): Square[] => {
  const out: Square[] = [];
  for (let dx = 0; dx < TOKEN_SIZE; dx++) for (let dy = 0; dy < TOKEN_SIZE; dy++) out.push(sq(t.x + dx, t.y + dy));
  return out;
};

const allSquares = (): Array<{ x: number; y: number }> => {
  const out: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) out.push({ x, y });
  return out;
};

/** Distance from a point to a rectangle (0 when inside). */
function distToRect(p: Point, r: { x: number; y: number; w: number; h: number }) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** An area spell only affects a grid square if it covers at least this share of the square. */
export const MIN_COVER = 1 / 5;
const SAMPLES = 12;

/** Squares an area covers by at least MIN_COVER of their own area (measured by sampling a
 * SAMPLES x SAMPLES grid inside each square). `exclude` squares are never included. */
function coverageSquares(inside: (p: Point) => boolean, exclude?: Set<Square>): Set<Square> {
  const out = new Set<Square>();
  const needed = MIN_COVER * SAMPLES * SAMPLES - 1e-9;
  for (const { x, y } of allSquares()) {
    const s = sq(x, y);
    if (exclude?.has(s)) continue;
    let n = 0;
    for (let i = 0; i < SAMPLES; i++) for (let j = 0; j < SAMPLES; j++) {
      if (inside({ x: x + (i + 0.5) / SAMPLES, y: y + (j + 0.5) / SAMPLES })) n++;
    }
    if (n >= needed) out.add(s);
  }
  return out;
}

/** Blast: the squares at least a third covered by a circle of `radius` meters around the aim point. */
export function blastSquares(aim: Point, radius: number): Set<Square> {
  return coverageSquares(p => Math.hypot(p.x - aim.x, p.y - aim.y) <= radius);
}

/** Wave: the ring around the caster's footprint out to `radius` meters (the footprint itself excluded). */
export function waveSquares(caster: Pick<Token, 'x' | 'y'>, radius: number): Set<Square> {
  const rect = tokenRect(caster);
  return coverageSquares(p => distToRect(p, rect) <= radius, new Set(tokenSquares(caster)));
}

/** Where a ray from the footprint's centre leaves the footprint. */
export function coneApex(caster: Pick<Token, 'x' | 'y'>, angle: number): Point {
  const c = tokenCenter(caster);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = (TOKEN_SIZE / 2) / Math.max(Math.abs(dx), Math.abs(dy));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** The true cone shape: a pointed wedge from the footprint edge, `length` meters long
 * and `widthAtEnd` meters wide at the far end. */
export function coneTriangle(caster: Pick<Token, 'x' | 'y'>, angle: number, length: number, widthAtEnd: number): Point[] {
  const apex = coneApex(caster, angle);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  return [
    apex,
    { x: apex.x + dx * length - dy * (widthAtEnd / 2), y: apex.y + dy * length + dx * (widthAtEnd / 2) },
    { x: apex.x + dx * length + dy * (widthAtEnd / 2), y: apex.y + dy * length - dx * (widthAtEnd / 2) },
  ];
}

/** Total reach a Wave/Cone modifier gives: length + width at the end, in meters.
 * 20 for the first mana, +6 per extra mana. */
export const conePool = (mana: number) => (mana > 0 ? 20 + (mana - 1) * 6 : 0);

/** A cone is never narrower than this at its far end, in meters. */
export const MIN_CONE_WIDTH = 2;

/** Blast radius in meters: 3 for the first mana, +1 per extra mana. */
export const blastRadiusFor = (mana: number) => (mana > 0 ? 3 + (mana - 1) : 0);

/** Wave radius (meters out from the caster's footprint): 2 for the first mana, +1 per extra mana. */
export const waveRadiusFor = (mana: number) => (mana > 0 ? 2 + (mana - 1) : 0);

export interface ConeAim {
  /** 'wave' when the marker sits on top of the caster: the spell goes all the way around (360 degrees). */
  mode: 'wave' | 'cone';
  angle: number;
  length: number;
  width: number;
}

/** Where the marker is decides the cone: its distance past the caster's edge is the cone's
 * length, and whatever is left of the pool becomes the width at the far end. A marker on top
 * of the caster turns it into a 360 degree wave. The length never goes below 0.5 m and leaves
 * at least MIN_CONE_WIDTH for the width. */
export function coneFromAim(caster: Pick<Token, 'x' | 'y'>, aim: Point, pool: number): ConeAim {
  const c = tokenCenter(caster);
  const angle = Math.atan2(aim.y - c.y, aim.x - c.x);
  if (pointInToken(aim, caster)) return { mode: 'wave', angle, length: 0, width: pool };
  const apex = coneApex(caster, angle);
  const reach = Math.hypot(aim.x - apex.x, aim.y - apex.y);
  const length = clamp(Math.round(reach * 2) / 2, 0.5, Math.max(0.5, pool - MIN_CONE_WIDTH));
  return { mode: 'cone', angle, length, width: Math.round((pool - length) * 2) / 2 };
}

function pointInTriangle(p: Point, t: Point[]) {
  const side = (a: Point, b: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const d1 = side(t[0], t[1]), d2 = side(t[1], t[2]), d3 = side(t[2], t[0]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Samples per side inside each square when measuring a cone (finer than SAMPLES: a cone is thin near its tip). */
const CONE_SAMPLES = 24;

/** Cone: a square is hit when the wedge covers at least MIN_COVER of it. On top of that the cone always
 * hits at least one square in every meter of its length: if no square in a 1 m slice reaches the
 * MIN_COVER mark, the square the wedge fills the most within that slice is hit instead. */
export function coneSquares(caster: Pick<Token, 'x' | 'y'>, angle: number, length: number, widthAtEnd: number): Set<Square> {
  const tri = coneTriangle(caster, angle, length, widthAtEnd);
  const apex = tri[0];
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const own = new Set(tokenSquares(caster));
  const slices = Math.max(1, Math.ceil(length - 1e-9));
  const needed = MIN_COVER * CONE_SAMPLES * CONE_SAMPLES - 1e-9;

  const minX = Math.floor(Math.min(...tri.map(p => p.x))), maxX = Math.ceil(Math.max(...tri.map(p => p.x)));
  const minY = Math.floor(Math.min(...tri.map(p => p.y))), maxY = Math.ceil(Math.max(...tri.map(p => p.y)));

  // For each square near the wedge: how many samples fall in the wedge, and in which 1 m slice.
  const cells: Array<{ s: Square; total: number; perSlice: number[] }> = [];
  for (let x = Math.max(0, minX); x < Math.min(GRID_W, maxX); x++) {
    for (let y = Math.max(0, minY); y < Math.min(GRID_H, maxY); y++) {
      const s = sq(x, y);
      if (own.has(s)) continue;
      const perSlice = new Array<number>(slices).fill(0);
      let total = 0;
      for (let i = 0; i < CONE_SAMPLES; i++) for (let j = 0; j < CONE_SAMPLES; j++) {
        const p = { x: x + (i + 0.5) / CONE_SAMPLES, y: y + (j + 0.5) / CONE_SAMPLES };
        if (!pointInTriangle(p, tri)) continue;
        const along = (p.x - apex.x) * dx + (p.y - apex.y) * dy;
        perSlice[Math.min(slices - 1, Math.max(0, Math.floor(along)))]++;
        total++;
      }
      if (total > 0) cells.push({ s, total, perSlice });
    }
  }

  const out = new Set<Square>();
  for (const c of cells) if (c.total >= needed) out.add(c.s);

  for (let k = 0; k < slices; k++) {
    if (cells.some(c => out.has(c.s) && c.perSlice[k] > 0)) continue;
    let best: (typeof cells)[number] | undefined;
    for (const c of cells) if (c.perSlice[k] > 0 && (!best || c.perSlice[k] > best.perSlice[k])) best = c;
    if (best) { out.add(best.s); continue; }
    // the wedge is thinner than the sampling here: take the square on the cone's axis in the middle of the slice
    const mid = Math.min(k + 0.5, length);
    const ax = Math.floor(apex.x + dx * mid), ay = Math.floor(apex.y + dy * mid);
    const s = sq(ax, ay);
    if (ax >= 0 && ax < GRID_W && ay >= 0 && ay < GRID_H && !own.has(s)) out.add(s);
  }
  return out;
}

/** Does any of the token's squares fall in the affected set? */
export const tokenHit = (t: Pick<Token, 'x' | 'y'>, squares: Set<Square>) => tokenSquares(t).some(s => squares.has(s));

/** Is a point inside the token's footprint? */
export const pointInToken = (p: Point, t: Pick<Token, 'x' | 'y'>) =>
  p.x >= t.x && p.x <= t.x + TOKEN_SIZE && p.y >= t.y && p.y <= t.y + TOKEN_SIZE;

/** How many extra targets Chain jumps to: 1 per mana spent on it. */
export const chainTargetCount = (chainMana: number) => Math.max(0, chainMana);

/** Advanced molding follow-up shapes. A Blast starts 2 m in radius; a Cone starts 10 m in total, split
 * evenly between its length and its width at the end (5 m x 5 m). Each size step (up to MAX_FOLLOW_SIZE)
 * adds 1 m of blast radius or 2 m of cone total. */
export const MAX_FOLLOW_SIZE = 2;
export const followBlastRadius = (steps: number) => 2 + steps;
export const followConePool = (steps: number) => 10 + steps * 2;

/** Chain range: how far from the main target the spell can reach, in meters. */
export const CHAIN_RANGE = 15;

const centreDist = (a: Token, b: Token) => { const p = tokenCenter(a), q = tokenCenter(b); return Math.hypot(p.x - q.x, p.y - q.y); };

/** Can Chain reach this enemy? It must be someone other than the main target, within CHAIN_RANGE meters
 * of the main target (centre to centre). */
export const chainEligible = (primary: Token, enemy: Token, range = CHAIN_RANGE) =>
  enemy.id !== primary.id && centreDist(primary, enemy) <= range + 1e-9;

/** Chain: from the main target it jumps to the nearest eligible enemy, then on to the nearest remaining one
 * from there, up to `count` jumps. `preferred[i]` is the enemy the player chose for jump i (by dragging its
 * marker); it is used when still eligible, and the other jumps keep choosing the nearest automatically
 * without taking an enemy another jump has been aimed at. */
export function chainHops(primary: Token, enemies: Token[], count: number, range = CHAIN_RANGE, preferred: Array<string | undefined> = []): Token[] {
  const pool = enemies.filter(e => chainEligible(primary, e, range));
  const hops: Token[] = [];
  let current = primary;
  for (let i = 0; i < count; i++) {
    let pick: Token | undefined;
    const want = preferred[i];
    if (want) {
      const idx = pool.findIndex(e => e.id === want);
      if (idx >= 0) pick = pool.splice(idx, 1)[0];
    }
    if (!pick) {
      const reserved = new Set(preferred.slice(i + 1).filter((id): id is string => !!id));
      let bi = -1;
      for (let k = 0; k < pool.length; k++) {
        if (reserved.has(pool[k].id)) continue;
        if (bi < 0 || centreDist(current, pool[k]) < centreDist(current, pool[bi])) bi = k;
      }
      if (bi < 0) continue;
      pick = pool.splice(bi, 1)[0];
    }
    hops.push(pick);
    current = pick;
  }
  return hops;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
