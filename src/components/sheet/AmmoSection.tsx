import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import {
  AMMO, getAmmo, ammoDice, ammoKey, getAmmoCount, getGunCartridges, fmtMult, fmtAp,
} from '../../utils/gunData';
import { numberWidth } from '../../utils/numberWidth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus } from 'lucide-react';

/** Ammo stock, kept per cartridge and round type (Character.ammoStock). Cartridges show here when one of the
 * character's guns can load them, or when there is some in stock; "Add ammo" works for any cartridge, gun or not.
 * A gun's Reload draws from this stock. */
export default function AmmoSection() {
  const { character: c, setCharacter } = useChar();
  const guns = c.firearms ?? [];

  // Which guns can load each cartridge
  const gunsFor = new Map<string, string[]>();
  for (const g of guns) for (const id of getGunCartridges(g)) gunsFor.set(id, [...(gunsFor.get(id) ?? []), g.name]);
  const stockedIds = new Set(Object.entries(c.ammoStock ?? {}).filter(([, n]) => n > 0).map(([k]) => k.split(':')[0]));
  const visible = AMMO.filter(a => gunsFor.has(a.id) || stockedIds.has(a.id));

  const setCount = (key: string, n: number) =>
    setCharacter(p => ({ ...p, ammoStock: { ...(p.ammoStock ?? {}), [key]: Math.max(0, Math.floor(n) || 0) } }));

  // Add ammo (any cartridge, with or without a gun)
  const [addAmmoId, setAddAmmoId] = useState('');
  const [addRoundId, setAddRoundId] = useState('');
  const [addQty, setAddQty] = useState(10);
  const addCartridge = getAmmo(addAmmoId);
  const canAdd = !!addCartridge && !!addRoundId && addQty > 0;
  const add = () => {
    if (!canAdd) return;
    const key = ammoKey(addAmmoId, addRoundId);
    setCount(key, getAmmoCount(c, addAmmoId, addRoundId) + addQty);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Ammo</h4>
        <span className="text-[11px] text-muted-foreground">Reload on a gun draws from this</span>
      </div>

      {/* Add ammo */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={addAmmoId} onValueChange={v => { setAddAmmoId(v); setAddRoundId(getAmmo(v)?.rounds[0]?.id ?? ''); }}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]"><SelectValue placeholder="Add ammo: pick a cartridge..." /></SelectTrigger>
          <SelectContent>
            {AMMO.map(a => <SelectItem key={a.id} value={a.id}>{a.label} — {ammoDice(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        {addCartridge && addCartridge.rounds.length > 1 && (
          <Select value={addRoundId} onValueChange={setAddRoundId}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {addCartridge.rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.label} ({fmtMult(r.multiplier)}, {fmtAp(r.ap)})</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="number" min={1} value={addQty} onChange={e => setAddQty(Math.max(0, parseInt(e.target.value) || 0))} className="h-8 text-xs text-center" style={numberWidth(addQty, 3)} aria-label="Rounds to add" />
        <Button size="sm" className="h-8" onClick={add} disabled={!canAdd}><Plus className="h-4 w-4 mr-1" />Add ammo</Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No ammo yet. Ammo for the guns you build shows up here; use Add ammo for any cartridge, even without a gun.</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map(a => {
            const forGuns = gunsFor.get(a.id);
            return (
              <div key={a.id} className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{a.label} <span className="text-xs font-normal text-muted-foreground">{ammoDice(a)}</span></span>
                  <span className="text-[11px] text-muted-foreground">{forGuns ? `for ${forGuns.join(', ')}` : 'no gun for this yet'}</span>
                </div>
                {a.rounds.map(r => {
                  const key = ammoKey(a.id, r.id);
                  const n = getAmmoCount(c, a.id, r.id);
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground">{r.label} <span className="text-muted-foreground text-[11px]">{fmtMult(r.multiplier)}, {fmtAp(r.ap)}</span></span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setCount(key, n - 1)} disabled={n <= 0}><Minus className="h-3 w-3" /></Button>
                        <Input type="number" min={0} value={n} onChange={e => setCount(key, parseInt(e.target.value))} className="h-6 text-xs text-center px-1" style={numberWidth(n, 2)} aria-label={`${a.label} ${r.label} rounds`} />
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setCount(key, n + 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
