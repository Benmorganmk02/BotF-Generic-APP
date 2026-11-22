/** Money in Malconia. The base money is Krönur (Cassan's name for its currency), in four coins that are each worth 100 of
 * the one below: Copper, Silver, Gold, Platinum. A character's balance is kept as one whole number of Copper Krönur.
 *
 * Other currencies are shown and spent by their worth in Krönur:
 *  - Algeir, the currency of the Ysvuhl Syndicate: 1 Algeir = 3 Silver Krönur (= 3.15 Skøl)
 *  - Skøl, used in the 3rd and 4th age of Buirlan (about $1 US in 1931): 3.15 Skøl = 1 Algeir, so 1 Skøl is a little under
 *    1 Silver Krönur */

export const COPPER_PER_SILVER = 100;
export const COPPER_PER_GOLD = 100 * COPPER_PER_SILVER;
export const COPPER_PER_PLATINUM = 100 * COPPER_PER_GOLD;
/** 1 Algeir = 3 Silver Krönur. */
export const ALGEIR_IN_COPPER = 3 * COPPER_PER_SILVER;
/** 1 Algeir = 3.15 Skøl. */
export const SKOL_PER_ALGEIR = 3.15;
export const SKOL_IN_COPPER = ALGEIR_IN_COPPER / SKOL_PER_ALGEIR;
/** The most a purse can hold (keeps the numbers sane). */
export const MAX_COPPER = 1_000_000_000_000;

export type MoneyUnit = 'copper' | 'silver' | 'gold' | 'platinum' | 'algeir' | 'skol';
export const MONEY_UNITS: { id: MoneyUnit; label: string; copper: number; hint: string }[] = [
  { id: 'copper', label: 'Copper', copper: 1, hint: 'Copper Krönur (Cassan)' },
  { id: 'silver', label: 'Silver', copper: COPPER_PER_SILVER, hint: 'Silver Krönur = 100 Copper' },
  { id: 'gold', label: 'Gold', copper: COPPER_PER_GOLD, hint: 'Gold Krönur = 100 Silver' },
  { id: 'platinum', label: 'Platinum', copper: COPPER_PER_PLATINUM, hint: 'Platinum Krönur = 100 Gold' },
  { id: 'algeir', label: 'Algeir', copper: ALGEIR_IN_COPPER, hint: 'Algeir (Ysvuhl Syndicate): 3 Silver Krönur = 3.15 Skøl' },
  { id: 'skol', label: 'Skøl', copper: SKOL_IN_COPPER, hint: 'Skøl (3rd and 4th age Buirlan, about $1 US in 1931): 3.15 Skøl = 1 Algeir' },
];

/** An amount in a unit as whole Copper Krönur (Skøl and decimals round to the nearest Copper). */
export const toCopper = (amount: number, unit: MoneyUnit): number =>
  Math.round(amount * (MONEY_UNITS.find(u => u.id === unit)?.copper ?? 1));

/** A balance as whole coins: Platinum, Gold, Silver and Copper Krönur. */
export function coins(copper: number): { platinum: number; gold: number; silver: number; copper: number } {
  let rest = Math.max(0, Math.floor(copper));
  const platinum = Math.floor(rest / COPPER_PER_PLATINUM); rest -= platinum * COPPER_PER_PLATINUM;
  const gold = Math.floor(rest / COPPER_PER_GOLD); rest -= gold * COPPER_PER_GOLD;
  const silver = Math.floor(rest / COPPER_PER_SILVER); rest -= silver * COPPER_PER_SILVER;
  return { platinum, gold, silver, copper: rest };
}

/** The worth of a balance in Algeir and in Skøl (two decimals). */
export const inAlgeir = (copper: number) => Math.round((copper / ALGEIR_IN_COPPER) * 100) / 100;
export const inSkol = (copper: number) => Math.round((copper / SKOL_IN_COPPER) * 100) / 100;

/** "2 Gold 15 Silver 3 Copper" (only the coins that are there; "0 Copper" for nothing). */
export function describeCopper(copper: number): string {
  const c = coins(Math.abs(copper));
  const parts = ([['Platinum', c.platinum], ['Gold', c.gold], ['Silver', c.silver], ['Copper', c.copper]] as const)
    .filter(([, n]) => n > 0).map(([name, n]) => `${n} ${name}`);
  return parts.length ? parts.join(' ') : '0 Copper';
}

// ── Purses: Krönur (kept in Copper), Algeir and Skøl are tracked separately, and exchanged at the rates above ──
export type Wallet = 'kronur' | 'algeir' | 'skol';
export const WALLETS: { id: Wallet; label: string }[] = [{ id: 'kronur', label: 'Krönur' }, { id: 'algeir', label: 'Algeir' }, { id: 'skol', label: 'Skøl' }];
export const walletLabel = (w: Wallet) => WALLETS.find(x => x.id === w)!.label;
export const unitWallet = (u: MoneyUnit): Wallet => (u === 'algeir' ? 'algeir' : u === 'skol' ? 'skol' : 'kronur');
/** How much one unit of a purse is worth in Copper Krönur (Krönur are counted in Copper). */
export const walletCopper = (w: Wallet) => (w === 'kronur' ? 1 : w === 'algeir' ? ALGEIR_IN_COPPER : SKOL_IN_COPPER);

export interface MoneyLike { amount: number; algeir?: number; skol?: number }
export const walletBalance = (m: MoneyLike, w: Wallet) => (w === 'kronur' ? m.amount : w === 'algeir' ? (m.algeir ?? 0) : (m.skol ?? 0));
/** Everything a character holds, as Copper Krönur (a decimal). */
export const totalCopper = (m: MoneyLike) => m.amount + (m.algeir ?? 0) * ALGEIR_IN_COPPER + (m.skol ?? 0) * SKOL_IN_COPPER;

const round2 = (n: number) => Math.round(n * 100) / 100;
/** An amount of a unit in its own purse: whole Copper for Krönur coins, two decimals for Algeir and Skøl. */
export const purseAmount = (amount: number, unit: MoneyUnit): number => (unitWallet(unit) === 'kronur' ? toCopper(amount, unit) : round2(amount));

/** What an exchange gives: `spend` (in the source purse's own units) worth of money in the target purse, rounded down to
 * a whole Copper or to two decimals, so an exchange never makes money. */
export function exchange(spend: number, from: Wallet, to: Wallet): number {
  const copper = spend * walletCopper(from);
  if (to === 'kronur') return Math.floor(copper + 1e-9);
  return Math.floor((copper / walletCopper(to)) * 100 + 1e-9) / 100;
}

/** An amount in a purse as words: "2 Gold 15 Silver" for Krönur, "3.15 Skøl" for the others. */
export const describePurse = (n: number, w: Wallet) => (w === 'kronur' ? describeCopper(n) : `${n} ${walletLabel(w)}`);
