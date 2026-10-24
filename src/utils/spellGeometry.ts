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

/** Blast: every square whose centre is within `radius` meters of the aim point. */
export function blastSquares(aim: Point, radius: number): Set<Square> {
  const out = new Set<Square>();
  for (const { x, y } of allSquares()) {
    if (Math.hypot(x + 0.5 - aim.x, y + 0.5 - aim.y) <= radius + 1e-9) out.add(sq(x, y));
  }
  return out;
}

/** Wave: the ring of squares within `radius` meters of the caster's footprint (the footprint itself excluded). */
export function waveSquares(caster: Pick<Token, 'x' | 'y'>, radius: number): Set<Square> {
  const rect = tokenRect(caster);
  const own = new Set(tokenSquares(caster));
  const out = new Set<Square>();
  for (const { x, y } of allSquares()) {
    const s = sq(x, y);
    if (own.has(s)) continue;
    if (distToRect({ x: x + 0.5, y: y + 0.5 }, rect) <= radius + 1e-9) out.add(s);
  }
  return out;
}

/** Where a ray from the footprint's centre leaves the footprint. */
export function coneApex(caster: Pick<Token, 'x' | 'y'>, angle: number): Point {
  const c = tokenCenter(caster);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = (TOKEN_SIZE / 2) / Math.max(Math.abs(dx), Math.abs(dy));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Do a triangle and an axis-aligned square overlap by more than a touch? (separating axis test) */
function triangleTouchesSquare(tri: Point[], sx: number, sy: number) {
  const square: Point[] = [{ x: sx, y: sy }, { x: sx + 1, y: sy }, { x: sx + 1, y: sy + 1 }, { x: sx, y: sy + 1 }];
  const axes: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < 3; i++) {
    const p = tri[i], q = tri[(i + 1) % 3];
    axes.push({ x: -(q.y - p.y), y: q.x - p.x });
  }
  for (const ax of axes) {
    const len = Math.hypot(ax.x, ax.y) || 1;
    const proj = (pts: Point[]) => pts.map(p => (p.x * ax.x + p.y * ax.y) / len);
    const t = proj(tri), q = proj(square);
    if (Math.max(...t) <= Math.min(...q) + 1e-9 || Math.max(...q) <= Math.min(...t) + 1e-9) return false;
  }
  return true;
}

/** Cone: a pointed wedge from the footprint edge, `length` meters long and `widthAtEnd`
 * meters wide at the far end. Every square the wedge touches is filled. */
export function coneSquares(caster: Pick<Token, 'x' | 'y'>, angle: number, length: number, widthAtEnd: number): Set<Square> {
  const apex = coneApex(caster, angle);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const tri: Point[] = [
    apex,
    { x: apex.x + dx * length - dy * (widthAtEnd / 2), y: apex.y + dy * length + dx * (widthAtEnd / 2) },
    { x: apex.x + dx * length + dy * (widthAtEnd / 2), y: apex.y + dy * length - dx * (widthAtEnd / 2) },
  ];
  const own = new Set(tokenSquares(caster));
  const out = new Set<Square>();
  for (const { x, y } of allSquares()) {
    const s = sq(x, y);
    if (!own.has(s) && triangleTouchesSquare(tri, x, y)) out.add(s);
  }
  return out;
}

/** Does any of the token's squares fall in the affected set? */
export const tokenHit = (t: Pick<Token, 'x' | 'y'>, squares: Set<Square>) => tokenSquares(t).some(s => squares.has(s));

/** Is a point inside the token's footprint? */
export const pointInToken = (p: Point, t: Pick<Token, 'x' | 'y'>) =>
  p.x >= t.x && p.x <= t.x + TOKEN_SIZE && p.y >= t.y && p.y <= t.y + TOKEN_SIZE;

/** How many extra targets Chain jumps to: 2 for the first mana, +2 per extra mana. */
export const chainTargetCount = (chainMana: number) => (chainMana > 0 ? 2 + (chainMana - 1) * 2 : 0);

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
