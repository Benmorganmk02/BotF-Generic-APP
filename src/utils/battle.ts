/** The campaign's battle map: one shared state, written by the GM and read by everyone in the campaign. The grid
 * matches the spell map: 1 metre squares, and a medium character takes up 2x2 squares. */
export const BATTLE_COLS = 24;
export const BATTLE_ROWS = 16;
export const TOKEN_SIZE = 2;

export type TokenKind = 'pc' | 'npc';

export interface BattleToken {
  /** The campaign character this token stands for. */
  id: string;
  name: string;
  /** A player's character, or an NPC. */
  kind: TokenKind;
  /** For a player's character: the player's user id (so the map can show a player their own). */
  owner?: string;
  /** For an NPC: hostile to the players (an enemy) or friendly (an ally). */
  hostile?: boolean;
  /** For an NPC: its number on this map. Players see an NPC as a name plus this number (Enemy 3, Wolf 2). */
  num?: number;
  /** For an NPC: the name the GM chose to show players instead of "Enemy" / "Ally" (the real name stays GM-only). */
  label?: string;
  /** Top-left square. */
  x: number;
  y: number;
  /** Metres walked this turn (a character walks WALK_SPEED metres per turn). */
  moved?: number;
}

/** A freehand line the GM drew on the map (grid coordinates, in metres). */
export interface Drawing {
  id: string;
  color: string;
  points: [number, number][];
}
export const MAX_STROKES = 60;
/** The colours the GM can draw in. */
export const DRAW_COLORS = ['#ffffff', '#ef4444', '#facc15', '#22c55e', '#38bdf8'];

/** The kinds of magic effect the GM can put down on the map (see EffectView for how each looks). */
export const EFFECT_KINDS = ['fire', 'frost', 'lightning', 'poison', 'arcane', 'water', 'darkness'] as const;
export type EffectKind = typeof EFFECT_KINDS[number];
/** An area effect on the map, like a spell's blast: a fire burning, a patch of ice. Centre in metres, radius in metres. */
export interface MapEffect { id: string; kind: EffectKind; x: number; y: number; radius: number }
export const MAX_EFFECTS = 30;
export const MIN_EFFECT_RADIUS = 0.5;
export const MAX_EFFECT_RADIUS = 30;
export const MAX_POINTS = 400;

export interface BattleState {
  /** The GM's drawings on the map. */
  drawings?: Drawing[];
  /** Magic effects the GM put down (fire, ice...). */
  effects?: MapEffect[];
  /** True while the GM has combat running; the map shows for everyone then. */
  active: boolean;
  cols: number;
  rows: number;
  tokens: BattleToken[];
  startedAt?: string;
}

export const newBattle = (): BattleState => ({ active: true, cols: BATTLE_COLS, rows: BATTLE_ROWS, tokens: [], startedAt: new Date().toISOString() });

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function parseEffects(raw: unknown): MapEffect[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: MapEffect[] = [];
  for (const e of raw) {
    if (!e || typeof e.id !== 'string' || !(EFFECT_KINDS as readonly string[]).includes(e.kind) || typeof e.x !== 'number' || typeof e.y !== 'number' || typeof e.radius !== 'number') continue;
    out.push({ id: e.id, kind: e.kind, x: e.x, y: e.y, radius: clampN(e.radius, MIN_EFFECT_RADIUS, MAX_EFFECT_RADIUS) });
  }
  return out.slice(0, MAX_EFFECTS);
}

function parseDrawings(raw: unknown): Drawing[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Drawing[] = [];
  for (const d of raw) {
    if (!d || typeof d.id !== 'string' || typeof d.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(d.color) || !Array.isArray(d.points)) continue;
    const points = d.points.filter((p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number').slice(0, MAX_POINTS);
    if (points.length) out.push({ id: d.id, color: d.color, points });
  }
  return out.slice(-MAX_STROKES);
}

/** Reads the stored battle JSON, ignoring anything that is not a battle. */
export function parseBattle(raw: unknown): BattleState | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<BattleState>;
  if (typeof b.active !== 'boolean' || !Array.isArray(b.tokens)) return null;
  const tokens = b.tokens.filter((t): t is BattleToken =>
    !!t && typeof t.id === 'string' && typeof t.name === 'string' && (t.kind === 'pc' || t.kind === 'npc') && typeof t.x === 'number' && typeof t.y === 'number');
  let top = Math.max(0, ...tokens.filter(t => t.kind === 'npc').map(t => t.num ?? 0));
  const numbered = tokens.map(t => (t.kind === 'npc' && !t.num ? { ...t, num: ++top } : t));
  return { active: b.active, cols: typeof b.cols === 'number' ? b.cols : BATTLE_COLS, rows: typeof b.rows === 'number' ? b.rows : BATTLE_ROWS, tokens: numbered, startedAt: b.startedAt, drawings: parseDrawings((b as { drawings?: unknown }).drawings), effects: parseEffects((b as { effects?: unknown }).effects) };
}

/** How a player sees a token: their own character, an ally (other players and friendly NPCs) or an enemy. */
export type PlayerRole = 'self' | 'ally' | 'enemy';
export function playerRole(t: BattleToken, viewerId: string): PlayerRole {
  if (t.kind === 'pc') return t.owner === viewerId ? 'self' : 'ally';
  return t.hostile ? 'enemy' : 'ally';
}

/** Player view: own character blue, allies green, enemies red. */
export const PLAYER_COLORS: Record<PlayerRole, string> = { self: '#3b82f6', ally: '#22c55e', enemy: '#ef4444' };
/** GM view: players purple, friendly NPCs blue, hostile NPCs orange. */
export const GM_COLORS = { pc: '#a855f7', friendly: '#3b82f6', hostile: '#f97316' } as const;

export function tokenColor(t: BattleToken, viewerId: string, isGM: boolean): string {
  if (isGM) return t.kind === 'pc' ? GM_COLORS.pc : t.hostile ? GM_COLORS.hostile : GM_COLORS.friendly;
  return PLAYER_COLORS[playerRole(t, viewerId)];
}

/** The name written on a token. The GM sees real names. A player sees the names of the player characters, and an NPC
 * as a name plus its number: "Enemy 3" or "Ally 2", or the name the GM chose for it ("Wolf 2"); never the real name. */
export function tokenName(t: BattleToken, _viewerId: string, isGM: boolean): string {
  if (isGM || t.kind === 'pc') return t.name;
  const base = t.label?.trim() || (t.hostile ? 'Enemy' : 'Ally');
  return t.num ? `${base} ${t.num}` : base;
}
/** What players see on an NPC token when the GM has chosen no name: Enemy or Ally. */
export const defaultNpcBase = (t: BattleToken) => (t.hostile ? 'Enemy' : 'Ally');

/** How far a character can walk in one combat turn, in metres (squares). */
export const WALK_SPEED = 10;
/** Squares walked to get from one spot to another: a diagonal step counts as one. */
export const stepCost = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const movementLeft = (t: BattleToken) => Math.max(0, WALK_SPEED - (t.moved ?? 0));

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < TOKEN_SIZE && Math.abs(a.y - b.y) < TOKEN_SIZE;

/** A free spot for a new token: players start down the left edge, NPCs down the right, filling inward. */
export function freeSpot(b: BattleState, side: 'left' | 'right'): { x: number; y: number } {
  const colsToTry = Array.from({ length: Math.floor(b.cols / TOKEN_SIZE) }, (_, i) => (side === 'left' ? 1 + i * TOKEN_SIZE : b.cols - 1 - TOKEN_SIZE - i * TOKEN_SIZE));
  for (const x of colsToTry) {
    for (let y = 1; y + TOKEN_SIZE <= b.rows; y += TOKEN_SIZE) {
      const spot = { x: clamp(x, 0, b.cols - TOKEN_SIZE), y };
      if (!b.tokens.some(t => overlaps(t, spot))) return spot;
    }
  }
  return { x: 0, y: 0 };
}

export function addToken(b: BattleState, t: Omit<BattleToken, 'x' | 'y'>): BattleState {
  if (b.tokens.some(x => x.id === t.id)) return b;
  const spot = freeSpot(b, t.kind === 'pc' ? 'left' : 'right');
  const num = t.kind === 'npc' ? Math.max(0, ...b.tokens.map(k => k.num ?? 0)) + 1 : undefined;
  return { ...b, tokens: [...b.tokens, { ...t, ...spot, ...(num ? { num } : {}) }] };
}

/** Moves a token (onto the grid, whole squares) and counts the squares walked against its turn's movement. */
export const moveToken = (b: BattleState, id: string, x: number, y: number): BattleState => ({
  ...b,
  tokens: b.tokens.map(t => {
    if (t.id !== id) return t;
    const to = { x: clamp(Math.round(x), 0, b.cols - TOKEN_SIZE), y: clamp(Math.round(y), 0, b.rows - TOKEN_SIZE) };
    return { ...t, ...to, moved: (t.moved ?? 0) + stepCost(t, to) };
  }),
});

/** Where a token can actually get to: a player is held to the movement the token has left this turn, stopping
 * partway along the line to where they asked. `cost` is the squares walked to get there. */
export function limitMove(b: BattleState, id: string, x: number, y: number): { x: number; y: number; cost: number; limited: boolean } {
  const t = b.tokens.find(k => k.id === id);
  const to = { x: clamp(Math.round(x), 0, b.cols - TOKEN_SIZE), y: clamp(Math.round(y), 0, b.rows - TOKEN_SIZE) };
  if (!t) return { ...to, cost: 0, limited: false };
  const cost = stepCost(t, to), left = movementLeft(t);
  if (cost <= left) return { ...to, cost, limited: false };
  const f = left / cost;
  const stop = { x: t.x + Math.trunc((to.x - t.x) * f), y: t.y + Math.trunc((to.y - t.y) * f) };
  return { ...stop, cost: stepCost(t, stop), limited: true };
}

/** A new turn: the movement of one token (or of every token) is back to the full walking speed. */
export const resetMovement = (b: BattleState, id?: string): BattleState => ({
  ...b, tokens: b.tokens.map(t => (!id || t.id === id ? { ...t, moved: 0 } : t)),
});
/** While this device still has its own change on its way, other people's token moves are taken in without touching what
 * this device moved: the positions of every token not in `mine` come from `remote`. */
export const mergeRemotePositions = (local: BattleState, remote: BattleState, mine: ReadonlySet<string>): BattleState => ({
  ...local,
  tokens: local.tokens.map(t => {
    const r = remote.tokens.find(x => x.id === t.id);
    return r && !mine.has(t.id) && (r.x !== t.x || r.y !== t.y || (r.moved ?? 0) !== (t.moved ?? 0)) ? { ...t, x: r.x, y: r.y, moved: r.moved } : t;
  }),
});
/** The sizes the GM can step the map through (columns x rows, in metres), always 3:2. */
export const MAP_SIZES: ReadonlyArray<readonly [number, number]> = [[24, 16], [30, 20], [36, 24], [48, 32], [60, 40]];
/** The next bigger (dir 1) or smaller (dir -1) size than the map has now, or null at the end of the list. */
export function stepMapSize(b: BattleState, dir: 1 | -1): { cols: number; rows: number } | null {
  const next = dir === 1 ? MAP_SIZES.find(([c]) => c > b.cols) : [...MAP_SIZES].reverse().find(([c]) => c < b.cols);
  return next ? { cols: next[0], rows: next[1] } : null;
}
/** Changes the grid size; a token that would fall off a smaller map is pulled back onto it. */
export const resizeBattle = (b: BattleState, cols: number, rows: number): BattleState => ({
  ...b, cols, rows,
  tokens: b.tokens.map(t => ({ ...t, x: clamp(t.x, 0, cols - TOKEN_SIZE), y: clamp(t.y, 0, rows - TOKEN_SIZE) })),
});
export const removeToken = (b: BattleState, id: string): BattleState => ({ ...b, tokens: b.tokens.filter(t => t.id !== id) });
/** GM: the name players see on an NPC's token, in front of its number ('' goes back to Enemy / Ally). */
export const setLabel = (b: BattleState, id: string, label: string): BattleState => ({
  ...b, tokens: b.tokens.map(t => (t.id === id ? { ...t, label: label.trim().slice(0, 30) || undefined } : t)),
});
/** GM drawing: adds a stroke, or replaces the stroke with the same id (it is sent on as it grows). */
export const upsertStroke = (b: BattleState, s: Drawing): BattleState => {
  const all = b.drawings ?? [];
  const next = all.some(d => d.id === s.id) ? all.map(d => (d.id === s.id ? s : d)) : [...all, s];
  return { ...b, drawings: next.slice(-MAX_STROKES) };
};
export const undoStroke = (b: BattleState): BattleState => ({ ...b, drawings: (b.drawings ?? []).slice(0, -1) });
/** Takes away one drawing (the Erase tool and the right-click menu). */
export const removeStroke = (b: BattleState, id: string): BattleState => ({ ...b, drawings: (b.drawings ?? []).filter(d => d.id !== id) });
export const recolorStroke = (b: BattleState, id: string, color: string): BattleState => ({
  ...b, drawings: (b.drawings ?? []).map(d => (d.id === id ? { ...d, color } : d)),
});
const distToSegment = (p: { x: number; y: number }, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / len2));
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
};
/** The drawing nearest to a point, if one passes within `reach` metres of it (the one drawn last wins). */
export function strokeNear(drawings: Drawing[] | undefined, p: { x: number; y: number }, reach = 0.6): string | null {
  const all = drawings ?? [];
  for (let i = all.length - 1; i >= 0; i--) {
    const pts = all[i].points;
    if (pts.length === 1 ? Math.hypot(p.x - pts[0][0], p.y - pts[0][1]) <= reach : pts.some((q, k) => k > 0 && distToSegment(p, pts[k - 1], q) <= reach)) return all[i].id;
  }
  return null;
}
/** The effect whose area contains a point (the smallest one if they overlap, so a small fire inside a big one can be picked). */
export function effectAt(effects: MapEffect[] | undefined, p: { x: number; y: number }): string | null {
  const hits = (effects ?? []).filter(e => Math.hypot(p.x - e.x, p.y - e.y) <= e.radius);
  hits.sort((a, b) => a.radius - b.radius);
  return hits[0]?.id ?? null;
}
export const clearDrawings = (b: BattleState): BattleState => ({ ...b, drawings: [] });
/** GM: puts an effect on the map, or replaces the one with the same id (moving or resizing it). Whole or half metres, on the map. */
export const upsertEffect = (b: BattleState, e: MapEffect): BattleState => {
  const fx: MapEffect = {
    ...e, x: clampN(Math.round(e.x * 2) / 2, 0, b.cols), y: clampN(Math.round(e.y * 2) / 2, 0, b.rows),
    radius: clampN(Math.round((Number.isFinite(e.radius) ? e.radius : 2) * 2) / 2, MIN_EFFECT_RADIUS, MAX_EFFECT_RADIUS),
  };
  const all = b.effects ?? [];
  const next = all.some(k => k.id === fx.id) ? all.map(k => (k.id === fx.id ? fx : k)) : [...all, fx];
  return { ...b, effects: next.slice(-MAX_EFFECTS) };
};
export const removeEffect = (b: BattleState, id: string): BattleState => ({ ...b, effects: (b.effects ?? []).filter(e => e.id !== id) });
export const clearEffects = (b: BattleState): BattleState => ({ ...b, effects: [] });
export const setHostile = (b: BattleState, id: string, hostile: boolean): BattleState => ({ ...b, tokens: b.tokens.map(t => (t.id === id ? { ...t, hostile } : t)) });
