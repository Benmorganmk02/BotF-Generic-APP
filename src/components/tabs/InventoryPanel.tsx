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
import { Trash2, Plus, ArrowUp, ArrowDown, Pencil } from 'lucide-react';

type WeaponList = 'weapons' | 'bows' | 'crossbows' | 'firearms';

/** The edit form for one thing in the inventory: its name and description, and for a normal item its quantity and weight. */
function EditForm({ initial, withStats, onSave, onCancel }: {
  initial: { name: string; quantity?: number; weight?: number; description: string }; withStats: boolean;
  onSave: (v: { name: string; quantity: number; weight: number; description: string }) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [quantity, setQuantity] = useState(String(initial.quantity ?? 1));
  const [weight, setWeight] = useState(String(initial.weight ?? 0));
  const [description, setDescription] = useState(initial.description);
  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), quantity: Math.max(0, Number(quantity) || 0), weight: Math.max(0, Number(weight) || 0), description: description.trim() });
  };
  const keys = (e: React.KeyboardEvent) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); };
  return (
    <div className="rounded-md border border-primary/40 bg-card p-2.5 space-y-2">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex-1 min-w-[10rem] space-y-0.5">
          <span className="text-[11px] text-muted-foreground">Name</span>
          <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={keys} aria-label="Item name" autoFocus className="h-8 text-sm" />
        </label>
        {withStats && (
          <>
            <label className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">Quantity</span>
              <Input type="number" min={0} value={quantity} onChange={e => setQuantity(e.target.value)} onKeyDown={keys} aria-label="Item quantity" className="h-8 text-sm text-center" style={numberWidth(quantity, 3)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">Weight (kg)</span>
              <Input type="number" min={0} step={0.1} value={weight} onChange={e => setWeight(e.target.value)} onKeyDown={keys} aria-label="Item weight" className="h-8 text-sm text-center" style={numberWidth(weight, 4)} />
            </label>
          </>
        )}
      </div>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-muted-foreground">Description</span>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }} aria-label="Item description" rows={3} className="text-xs min-h-0" placeholder="What it is, what it does..." />
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={!name.trim()}>Save</Button>
      </div>
    </div>
  );
}

export default function InventoryPanel() {
  const { character: c, setCharacter } = useChar();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [weight, setWeight] = useState(0);
  const [desc, setDesc] = useState('');
  // Which thing is open for editing: an inventory item ("item:<id>") or a weapon ("weapon:<list>:<id>")
  const [editing, setEditing] = useState<string | null>(null);

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
  const editWeapon = (list: WeaponList, id: string, name: string, description: string) =>
    setCharacter(p => ({ ...p, [list]: ((p[list] ?? []) as { id: string }[]).map(w => (w.id === id ? { ...w, name, description } : w)) }));

  const addItem = () => {
    if (!name.trim()) return;
    const item: InventoryItem = { id: genId(), name: name.trim(), quantity: qty, weight, ...(desc.trim() ? { description: desc.trim() } : {}) };
    setCharacter(p => ({ ...p, inventory: [...p.inventory, item] }));
    setName(''); setQty(1); setWeight(0); setDesc('');
  };
  const removeItem = (id: string) => { setCharacter(p => ({ ...p, inventory: p.inventory.filter(i => i.id !== id) })); setEditing(e => (e === `item:${id}` ? null : e)); };
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
          {weaponRows.map(r => {
            const key = `weapon:${r.list}:${r.id}`;
            return (
              <div key={key} className="px-3 py-1.5 border-t border-border/60">
                {editing === key ? (
                  <EditForm initial={{ name: r.name, description: r.description }} withStats={false}
                    onSave={v => { editWeapon(r.list, r.id, v.name, v.description); setEditing(null); }} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{r.kind}</Badge>
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto shrink-0" onClick={() => setEditing(key)} aria-label={`Edit ${r.name}`} title="Edit name and description (the build is edited in the Weapons tab)">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <DescriptionSection value={r.description} onChange={d => setWeaponDescription(r.list, r.id, d)} preview className="mt-0.5" />
                  </>
                )}
              </div>
            );
          })}
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
                editing === `item:${item.id}` ? (
                  <tr key={item.id} className="border-t border-border">
                    <td colSpan={5} className="p-2">
                      <EditForm initial={{ name: item.name, quantity: item.quantity, weight: item.weight, description: item.description ?? '' }} withStats
                        onSave={v => { updateItem(item.id, { name: v.name, quantity: v.quantity, weight: v.weight, description: v.description || undefined }); setEditing(null); }}
                        onCancel={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="px-3 py-1.5">
                      <span className="text-xs font-medium text-foreground break-words">{item.name}</span>
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
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(`item:${item.id}`)} aria-label={`Edit ${item.name}`} title="Edit this item"><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, -1)} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, 1)} disabled={idx === c.inventory.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                )
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
