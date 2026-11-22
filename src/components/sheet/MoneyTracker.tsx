import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Coins, Minus, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useChar } from '../../context/CharacterContext';
import { genId, newMoney } from '../../utils/defaults';
import {
  MONEY_UNITS, WALLETS, MAX_COPPER, COPPER_PER_SILVER, COPPER_PER_GOLD, COPPER_PER_PLATINUM, SKOL_IN_COPPER,
  coins, inAlgeir, inSkol, describeCopper, describePurse, purseAmount, exchange, totalCopper, unitWallet, walletBalance, walletLabel,
  type MoneyUnit, type Wallet,
} from '../../utils/money';
import type { MoneyEntry, MoneyTracker as Money } from '../../types/character';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MAX_LOG = 30;
const COIN_STYLE: Record<string, string> = { platinum: 'text-slate-200', gold: 'text-amber-300', silver: 'text-zinc-300', copper: 'text-orange-400' };
const round2 = (n: number) => Math.round(n * 100) / 100;

type Change = { wallet: Wallet; delta: number; note: string };
/** The tracker after some changes to its purses (a purse never goes below zero); each change is listed in the history. */
function applyChanges(m: Money, changes: Change[]): Money {
  const next: Money = { ...m };
  const at = new Date().toISOString();
  const entries: MoneyEntry[] = [];
  for (const ch of changes) {
    if (ch.wallet === 'kronur') next.amount = Math.max(0, Math.min(MAX_COPPER, next.amount + ch.delta));
    else if (ch.wallet === 'algeir') next.algeir = Math.max(0, round2((next.algeir ?? 0) + ch.delta));
    else next.skol = Math.max(0, round2((next.skol ?? 0) + ch.delta));
    entries.unshift({ id: genId(), delta: ch.delta, note: ch.note, at, currency: ch.wallet });
  }
  next.log = [...entries, ...m.log].slice(0, MAX_LOG);
  return next;
}

/** The money every character carries: Krönur (Copper, Silver, Gold, Platinum: each 100 of the one below), Algeir and Skøl,
 * each in its own purse. Add or spend in any unit, edit a purse to set it by hand, and exchange one currency for another at
 * the rates. The last changes are listed. */
export default function MoneyTracker() {
  const { character: c, setCharacter } = useChar();
  const money: Money = c.money ?? newMoney();
  const purse = coins(money.amount);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<MoneyUnit>('silver');
  const [note, setNote] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [showEx, setShowEx] = useState(false);
  const [xAmount, setXAmount] = useState('');
  const [xFrom, setXFrom] = useState<MoneyUnit>('algeir');
  const [xTo, setXTo] = useState<Wallet>('kronur');

  const change = (changes: Change[]) => setCharacter(p => ({ ...p, money: applyChanges(p.money ?? newMoney(), changes) }));

  const entered = purseAmount(Number(amount), unit);
  const move = (sign: 1 | -1) => {
    if (!(entered > 0)) return;
    const wallet = unitWallet(unit);
    if (sign < 0 && entered > walletBalance(money, wallet)) { toast.error(`Not enough: you have ${describePurse(walletBalance(money, wallet), wallet)}.`); return; }
    change([{ wallet, delta: sign * entered, note: note.trim() }]);
    setAmount(''); setNote('');
  };
  // Editing a purse sets it by hand (for Krönur, one coin count at a time; the other coins stay as they are)
  const setCoin = (kind: 'platinum' | 'gold' | 'silver' | 'copper', raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw)));
    if (!Number.isFinite(n)) return;
    const per = { platinum: COPPER_PER_PLATINUM, gold: COPPER_PER_GOLD, silver: COPPER_PER_SILVER, copper: 1 }[kind];
    const delta = (n - purse[kind]) * per;
    if (delta !== 0) change([{ wallet: 'kronur', delta, note: 'Set by hand' }]);
  };
  const setOther = (wallet: 'algeir' | 'skol', raw: string) => {
    const n = Math.max(0, round2(Number(raw)));
    if (!Number.isFinite(n)) return;
    const delta = round2(n - walletBalance(money, wallet));
    if (delta !== 0) change([{ wallet, delta, note: 'Set by hand' }]);
  };

  // Exchange: what leaves one purse, and what the other receives at the rates (rounded down)
  const fromWallet = unitWallet(xFrom);
  const spend = purseAmount(Number(xAmount), xFrom);
  const receive = spend > 0 && fromWallet !== xTo ? exchange(spend, fromWallet, xTo) : 0;
  const canExchange = spend > 0 && fromWallet !== xTo && receive > 0 && spend <= walletBalance(money, fromWallet);
  const doExchange = () => {
    if (!canExchange) { if (spend > walletBalance(money, fromWallet)) toast.error(`Not enough: you have ${describePurse(walletBalance(money, fromWallet), fromWallet)}.`); return; }
    change([
      { wallet: fromWallet, delta: -spend, note: `Exchanged for ${walletLabel(xTo)}` },
      { wallet: xTo, delta: receive, note: `Exchanged from ${walletLabel(fromWallet)}` },
    ]);
    setXAmount('');
    toast.success(`Exchanged ${describePurse(spend, fromWallet)} for ${describePurse(receive, xTo)}`);
  };

  const entryText = (e: MoneyEntry) => `${e.delta >= 0 ? '+' : '−'}${describePurse(Math.abs(e.delta), e.currency ?? 'kronur')}`;
  const chosen = MONEY_UNITS.find(u => u.id === unit)!;
  const total = totalCopper(money);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Coins className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-foreground">Money</span>
        <span className="ml-auto text-[11px] text-muted-foreground" title="Everything you hold, at the exchange rates">
          Worth {describeCopper(Math.round(total))} Krönur · {inAlgeir(total)} Algeir · {inSkol(total)} Skøl
        </span>
      </div>

      {/* Krönur: four coins */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Krönur <span className="font-normal">(Cassan)</span></p>
        <div className="grid grid-cols-4 gap-2">
          {(['platinum', 'gold', 'silver', 'copper'] as const).map(kind => (
            <label key={kind} className="rounded-md border border-border/60 bg-muted/20 px-1.5 py-1 text-center">
              <span className={`block text-[10px] font-semibold uppercase tracking-wide ${COIN_STYLE[kind]}`}>{kind}</span>
              <Input key={`${kind}${purse[kind]}`} type="number" min={0} defaultValue={purse[kind]} aria-label={`${kind} Krönur`}
                onFocus={e => e.target.select()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onBlur={e => setCoin(kind, e.target.value)} className="h-7 text-base font-bold text-center px-1 border-none bg-transparent focus-visible:ring-1" />
            </label>
          ))}
        </div>
      </div>

      {/* Algeir and Skøl: one purse each */}
      <div className="grid grid-cols-2 gap-2">
        {(['algeir', 'skol'] as const).map(w => (
          <label key={w} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-center" title={MONEY_UNITS.find(u => u.id === w)!.hint}>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{walletLabel(w)}</span>
            <Input key={`${w}${walletBalance(money, w)}`} type="number" min={0} step={0.01} defaultValue={walletBalance(money, w)} aria-label={`${walletLabel(w)} held`}
              onFocus={e => e.target.select()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onBlur={e => setOther(w, e.target.value)} className="h-7 text-base font-bold text-center px-1 border-none bg-transparent focus-visible:ring-1" />
          </label>
        ))}
      </div>

      {/* add or spend */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Input type="number" min={0} step={unitWallet(unit) === 'kronur' ? 1 : 0.01} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" aria-label="Amount"
          onKeyDown={e => { if (e.key === 'Enter') move(1); }} className="h-8 w-24 text-sm text-center px-1" />
        <Select value={unit} onValueChange={v => setUnit(v as MoneyUnit)}>
          <SelectTrigger className="h-8 w-28 text-xs" aria-label="Unit" title={chosen.hint}><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONEY_UNITS.map(u => <SelectItem key={u.id} value={u.id}>{u.label}{u.id === 'algeir' || u.id === 'skol' ? '' : ' Krönur'}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="What for? (optional)" aria-label="Note" className="h-8 flex-1 min-w-[8rem] text-xs" />
        <Button size="sm" className="h-8 gap-1" onClick={() => move(1)} disabled={!(entered > 0)}><Plus className="h-3.5 w-3.5" />Add</Button>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => move(-1)} disabled={!(entered > 0)}><Minus className="h-3.5 w-3.5" />Spend</Button>
      </div>

      {/* exchange between the currencies */}
      <div>
        <button type="button" onClick={() => setShowEx(s => !s)} aria-expanded={showEx} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          {showEx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<Repeat className="h-3 w-3" />Exchange
        </button>
        {showEx && (
          <div className="mt-1.5 rounded-md border border-border/60 bg-muted/10 p-2 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Input type="number" min={0} step={unitWallet(xFrom) === 'kronur' ? 1 : 0.01} value={xAmount} onChange={e => setXAmount(e.target.value)} placeholder="Amount" aria-label="Exchange amount" className="h-8 w-24 text-sm text-center px-1" />
              <Select value={xFrom} onValueChange={v => { setXFrom(v as MoneyUnit); if (unitWallet(v as MoneyUnit) === xTo) setXTo(WALLETS.find(w => w.id !== unitWallet(v as MoneyUnit))!.id); }}>
                <SelectTrigger className="h-8 w-28 text-xs" aria-label="Exchange from"><SelectValue /></SelectTrigger>
                <SelectContent>{MONEY_UNITS.map(u => <SelectItem key={u.id} value={u.id}>{u.label}{u.id === 'algeir' || u.id === 'skol' ? '' : ' Krönur'}</SelectItem>)}</SelectContent>
              </Select>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Select value={xTo} onValueChange={v => setXTo(v as Wallet)}>
                <SelectTrigger className="h-8 w-28 text-xs" aria-label="Exchange to"><SelectValue /></SelectTrigger>
                <SelectContent>{WALLETS.filter(w => w.id !== fromWallet).map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1" onClick={doExchange} disabled={!canExchange}><Repeat className="h-3.5 w-3.5" />Exchange</Button>
            </div>
            <p className="text-xs text-muted-foreground min-h-[1rem]" aria-live="polite">
              {spend > 0 && receive > 0 ? <>{describePurse(spend, fromWallet)} gives <span className="font-semibold text-foreground">{describePurse(receive, xTo)}</span> <span className="text-[11px]">(rounded down)</span></>
                : spend > 0 ? 'That is too little to exchange for even one of the smallest unit.' : 'Enter an amount to see what it is worth.'}
            </p>
            <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border/50 pt-1.5">
              <p className="font-semibold">Rates</p>
              <p>Krönur (Cassan): 100 Copper = 1 Silver · 100 Silver = 1 Gold · 100 Gold = 1 Platinum</p>
              <p>1 Algeir (Ysvuhl Syndicate) = 3 Silver Krönur = 3.15 Skøl</p>
              <p>1 Skøl (3rd and 4th age Buirlan, about $1 US in 1931) ≈ {Math.round(SKOL_IN_COPPER)} Copper Krönur</p>
            </div>
          </div>
        )}
      </div>

      {money.log.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowLog(s => !s)} aria-expanded={showLog} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            {showLog ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}History ({money.log.length})
          </button>
          {showLog && (
            <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
              {money.log.map(e => (
                <li key={e.id} className="flex items-baseline gap-2 text-xs">
                  <span className={`font-semibold shrink-0 ${e.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{entryText(e)}</span>
                  <span className="text-muted-foreground flex-1 truncate">{e.note}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
