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
  /** Top-left square. */
  x: number;
  y: number;
  /** Metres walked this turn (a character walks WALK_SPEED metres per turn). */
  moved?: number;
}

export interface BattleState {
  /** True while the GM has combat running; the map shows for everyone then. */
  active: boolean;
  cols: number;
  rows: number;
  tokens: BattleToken[];
  startedAt?: string;
}

export const newBattle = (): BattleState => ({ active: true, cols: BATTLE_COLS, rows: BATTLE_ROWS, tokens: [], startedAt: new Date().toISOString() });

/** Reads the stored battle JSON, ignoring anything that is not a battle. */
export function parseBattle(raw: unknown): BattleState | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<BattleState>;
  if (typeof b.active !== 'boolean' || !Array.isArray(b.tokens)) return null;
  const tokens = b.tokens.filter((t): t is BattleToken =>
    !!t && typeof t.id === 'string' && typeof t.name === 'string' && (t.kind === 'pc' || t.kind === 'npc') && typeof t.x === 'number' && typeof t.y === 'number');
  return { active: b.active, cols: typeof b.cols === 'number' ? b.cols : BATTLE_COLS, rows: typeof b.rows === 'number' ? b.rows : BATTLE_ROWS, tokens, startedAt: b.startedAt };
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

/** The GM sees every name; a player sees their own and their allies' names but an enemy is just a red marker. */
export const showTokenName = (t: BattleToken, viewerId: string, isGM: boolean): boolean => isGM || playerRole(t, viewerId) !== 'enemy';

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
  return { ...b, tokens: [...b.tokens, { ...t, ...spot }] };
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
export const setHostile = (b: BattleState, id: string, hostile: boolean): BattleState => ({ ...b, tokens: b.tokens.map(t => (t.id === id ? { ...t, hostile } : t)) });
