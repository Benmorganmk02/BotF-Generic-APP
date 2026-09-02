import { BowStyle, BowDrawWeight, CrossbowDrawWeight } from '../types/character';
export type { BowStyle, BowDrawWeight, CrossbowDrawWeight };
export type CrossbowMechanism = 'lever' | 'windlass';

export interface BowStyleDef {
  id: BowStyle; label: string; multBonus: number;
}
export interface BowDrawWeightDef {
  id: BowDrawWeight; label: string; lbs: string;
  die: string; multBonus: number; minStr: number; weaponBonus: number;
}
export interface CrossbowDrawWeightDef {
  id: CrossbowDrawWeight; label: string; mechanism: CrossbowMechanism; lbs: string;
  die: string; multBonus: number; weaponBonus: number; reloadCost: string;
}

export const BOW_STYLES: BowStyleDef[] = [
  { id: 'longbow',  label: 'Longbow',  multBonus: 0   },
  { id: 'shortbow', label: 'Shortbow', multBonus: 0.5 },
  { id: 'recurve',  label: 'Recurve',  multBonus: 1   },
];

export const BOW_DRAW_WEIGHTS: BowDrawWeightDef[] = [
  { id: 'hunting', label: 'Hunting', lbs: '45-60 lbs',  die: 'd6',  multBonus: 0,   minStr: 0, weaponBonus: 1 },
  { id: 'sporting', label: 'Sporting', lbs: '75-90 lbs', die: 'd8',  multBonus: 0.5, minStr: 2, weaponBonus: 2 },
  { id: 'war',     label: 'War',     lbs: '100+ lbs',  die: 'd10', multBonus: 1,   minStr: 5, weaponBonus: 3 },
];

export const CROSSBOW_DRAW_WEIGHTS: CrossbowDrawWeightDef[] = [
  { id: 'hand',     label: 'Hand',     mechanism: 'lever',    lbs: '76-100 lbs',   die: 'd4',  multBonus: 0.5, weaponBonus: 2, reloadCost: '1 action' },
  { id: 'hunting',  label: 'Hunting',  mechanism: 'lever',    lbs: '100-300 lbs',  die: 'd6',  multBonus: 1,   weaponBonus: 2, reloadCost: '1 action' },
  { id: 'war',      label: 'War',      mechanism: 'lever',    lbs: '300-600 lbs',  die: 'd8',  multBonus: 1.5, weaponBonus: 2, reloadCost: '1 action' },
  { id: 'siege',    label: 'Siege',    mechanism: 'windlass', lbs: '1100-1500 lbs', die: 'd12', multBonus: 2,   weaponBonus: 4, reloadCost: '2 actions + 3 reactions' },
  { id: 'arbalest', label: 'Arbalest', mechanism: 'windlass', lbs: '1500+ lbs',    die: 'd20', multBonus: 2,   weaponBonus: 4, reloadCost: '2 actions + 3 reactions' },
];

export function getBowMultiplier(style: BowStyle, drawWeight: BowDrawWeight): number {
  return 1 + BOW_STYLES.find(s => s.id === style)!.multBonus
           + BOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.multBonus;
}
export function getBowDie(drawWeight: BowDrawWeight): string {
  return BOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.die;
}
export function getBowWeaponBonus(drawWeight: BowDrawWeight): number {
  return BOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.weaponBonus;
}
export function getCrossbowMultiplier(drawWeight: CrossbowDrawWeight): number {
  return 1 + CROSSBOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.multBonus;
}
export function getCrossbowDie(drawWeight: CrossbowDrawWeight): string {
  return CROSSBOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.die;
}
export function getCrossbowWeaponBonus(drawWeight: CrossbowDrawWeight): number {
  return CROSSBOW_DRAW_WEIGHTS.find(d => d.id === drawWeight)!.weaponBonus;
}
