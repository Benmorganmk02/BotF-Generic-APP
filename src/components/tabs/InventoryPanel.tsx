import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { InventoryItem } from '../../types/character';
import { genId } from '../../utils/defaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';

export default function InventoryPanel() {
  const { character: c, setCharacter } = useChar();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [weight, setWeight] = useState(0);

  const totalWeight = c.inventory.reduce((s, i) => s + i.quantity * i.weight, 0);

  const addItem = () => {
    if (!name.trim()) return;
    const item: InventoryItem = { id: genId(), name: name.trim(), quantity: qty, weight };
    setCharacter(p => ({ ...p, inventory: [...p.inventory, item] }));
    setName(''); setQty(1); setWeight(0);
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
      <div className="flex gap-2 flex-wrap">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Item name..." className="flex-1 min-w-[140px]" />
        <Input type="number" value={qty} onChange={e => setQty(+e.target.value)} min={1} className="w-16 text-center" />
        <Input type="number" value={weight} onChange={e => setWeight(+e.target.value)} step={0.1} min={0} className="w-20 text-center" placeholder="kg" />
        <Button onClick={addItem} disabled={!name.trim()} size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>

      {c.inventory.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="text-left px-3 py-2 text-xs">Item</th><th className="px-2 py-2 text-xs text-center">Qty</th><th className="px-2 py-2 text-xs text-center">Weight</th><th className="px-2 py-2 text-xs text-center">Total</th><th className="px-2 py-2"></th></tr>
            </thead>
            <tbody>
              {c.inventory.map((item, idx) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} className="h-6 text-xs border-none bg-transparent p-0 focus-visible:ring-0" />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, { quantity: +e.target.value })} className="h-6 w-14 text-xs text-center mx-auto" min={1} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Input type="number" value={item.weight} step={0.1} onChange={e => updateItem(item.id, { weight: +e.target.value })} className="h-6 w-16 text-xs text-center mx-auto" min={0} />
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
      ) : <p className="text-sm text-muted-foreground italic text-center py-6">Inventory is empty.</p>}
    </div>
  );
}
