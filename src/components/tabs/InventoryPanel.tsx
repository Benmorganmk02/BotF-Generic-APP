import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { InventoryItem } from '../../types/character';
import { genId } from '../../utils/defaults';
import { numberWidth } from '../../utils/numberWidth';
import AmmoSection from '../sheet/AmmoSection';
import DescriptionSection from '../sheet/DescriptionSection';
import MoneyTracker from '../sheet/MoneyTracker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';

type WeaponList = 'weapons' | 'bows' | 'crossbows' | 'firearms';

export default function InventoryPanel() {
  const { character: c, setCharacter } = useChar();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [weight, setWeight] = useState(0);
  const [desc, setDesc] = useState('');

  const totalWeight = c.inventory.reduce((s, i) => s + i.quantity * i.weight, 0);

  // Every weapon built in the Weapons tab shows up here by itself (the same weapon, not a copy: its name and description
  // are shared, and taking it out of the Weapons tab takes it out of here)
  const weaponRows: { id: string; name: string; kind: string; list: WeaponList; description: string }[] = [
    ...(c.weapons ?? []).map(w => ({ id: w.id, name: w.name, kind: w.swordProfKey ? 'Sword' : 'Weapon', list: 'weapons' as const, description: w.description ?? '' })),
    ...(c.bows ?? []).map(w => ({ id: w.id, name: w.name, kind: 'Bow', list: 'bows' as const, description: w.description ?? '' })),
    ...(c.crossbows ?? []).map(w => ({ id: w.id, name: w.name, kind: 'Crossbow', list: 'crossbows' as const, description: w.description ?? '' })),
    ...(c.firearms ?? []).map(w => ({ id: w.id, name: w.name, kind: 'Firearm', list: 'firearms' as const, description: w.description ?? '' })),
  ];
  const setWeaponDescription = (list: WeaponList, id: string, description: string) =>
    setCharacter(p => ({ ...p, [list]: ((p[list] ?? []) as { id: string }[]).map(w => (w.id === id ? { ...w, description } : w)) }));

  const addItem = () => {
    if (!name.trim()) return;
    const item: InventoryItem = { id: genId(), name: name.trim(), quantity: qty, weight, ...(desc.trim() ? { description: desc.trim() } : {}) };
    setCharacter(p => ({ ...p, inventory: [...p.inventory, item] }));
    setName(''); setQty(1); setWeight(0); setDesc('');
  };
  const removeItem = (id: string) => setCharacter(p => ({ ...p, inventory: p.inventory.filter(i => i.id !== id) }));
  const updateItem = (id: string, patch: Partial<InventoryItem>) =>
    setCharacter(p => ({ ...p, inventory: p.inventory.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const moveItem = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= c.inventory.length) return;
    setCharacter(p => {
      const items = [...p.inventory];
      [items[idx], items[t]] = [items[t], items[idx]];
      return { ...p, inventory: items };
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Every character carries money: Krönur, Algeir and Skøl, with an exchange between them */}
      <MoneyTracker />

      <AmmoSection />

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Item name..." className="flex-1 min-w-[140px]" />
          <Input type="number" value={qty} onChange={e => setQty(+e.target.value)} min={1} className="text-center" style={numberWidth(qty, 2)} />
          <Input type="number" value={weight} onChange={e => setWeight(+e.target.value)} step={0.1} min={0} className="text-center" style={numberWidth(weight, 4)} placeholder="kg" />
          <Button onClick={addItem} disabled={!name.trim()} size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" aria-label="New item description" rows={2} className="text-xs min-h-0" />
      </div>

      {weaponRows.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-foreground flex items-center gap-1.5">
            Weapons <span className="font-normal text-muted-foreground">added from the Weapons tab</span>
          </div>
          {weaponRows.map(r => (
            <div key={`${r.list}:${r.id}`} className="px-3 py-1.5 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{r.kind}</Badge>
              </div>
              <DescriptionSection value={r.description} onChange={d => setWeaponDescription(r.list, r.id, d)} preview className="mt-0.5" />
            </div>
          ))}
        </div>
      )}

      {c.inventory.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="text-left px-3 py-2 text-xs">Item</th><th className="px-2 py-2 text-xs text-center">Qty</th><th className="px-2 py-2 text-xs text-center">Weight</th><th className="px-2 py-2 text-xs text-center">Total</th><th className="px-2 py-2"></th></tr>
            </thead>
            <tbody>
              {c.inventory.map((item, idx) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-3 py-1.5">
                    <Input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} className="h-6 text-xs border-none bg-transparent p-0 focus-visible:ring-0" />
                    <DescriptionSection value={item.description ?? ''} onChange={d => updateItem(item.id, { description: d })} preview className="mt-0.5" />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, { quantity: +e.target.value })} className="h-6 text-xs text-center mx-auto" style={numberWidth(item.quantity, 2)} min={1} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Input type="number" value={item.weight} step={0.1} onChange={e => updateItem(item.id, { weight: +e.target.value })} className="h-6 text-xs text-center mx-auto" style={numberWidth(item.weight, 4)} min={0} />
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">{(item.quantity * item.weight).toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, -1)} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, 1)} disabled={idx === c.inventory.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 bg-muted/30 border-t border-border text-xs text-right text-muted-foreground">
            Total: <span className="font-medium text-foreground">{totalWeight.toFixed(1)} kg</span>
          </div>
        </div>
      ) : weaponRows.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-6">Inventory is empty.</p> : null}
    </div>
  );
}
