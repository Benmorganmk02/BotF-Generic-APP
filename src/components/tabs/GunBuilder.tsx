import { useState } from 'react';
import { useChar } from '../../context/CharacterContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Minus, Plus } from 'lucide-react';
import type { Firearm } from '../../types/character';
import {
  GUN_RECEIVERS, ATTACHMENT_SLOTS, RIFLING_OPTIONS, STOCK_OPTIONS, STORAGE_OPTIONS, CYCLING_OPTIONS, AUTO_CYCLING, AUTO_MODES, defaultMagazineSize, barrelLabel, MAX_BARREL_LEVEL,
  GUN_PROFICIENCIES, getGunReceiver, getAmmo, ammoDice, getLoadOptions, getLoadedAmmo, getLoadedRound, fmtMult, fmtAp, getGunProfDef, resolveGunProf, getGunWeaponBonus, getGunBonusParts,
} from '../../utils/gunData';
import { genId } from '../../utils/defaults';

interface Props {
  onSave: (g: Firearm) => void;
  onCancel?: () => void;
  initialGun?: Firearm;
}

const NONE = '__none__';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

export default function GunBuilder({ onSave, onCancel, initialGun }: Props) {
  const { character: c } = useChar();
  const [name, setName] = useState(initialGun?.name ?? '');
  const [receiverId, setReceiverId] = useState(initialGun?.receiver ?? '');
  const [ammoId, setAmmoId] = useState(initialGun?.ammoId ?? '');
  const [roundId, setRoundId] = useState<string | undefined>(initialGun?.roundId);
  const [loadedAmmoId, setLoadedAmmoId] = useState<string | undefined>(initialGun?.loadedAmmoId);
  const [profOverride, setProfOverride] = useState<string | undefined>(initialGun?.profOverride);
  const [overrideOpen, setOverrideOpen] = useState(!!initialGun?.profOverride);
  const [rifling, setRifling] = useState(initialGun?.rifling ?? RIFLING_OPTIONS[0].id);
  const [stock, setStock] = useState(initialGun?.stock ?? STOCK_OPTIONS[0].id);
  const [barrelLevel, setBarrelLevel] = useState(initialGun?.barrelLevel ?? 0);
  const [storage, setStorage] = useState(initialGun?.storage ?? STORAGE_OPTIONS[0].id);
  const [cycling, setCycling] = useState(initialGun?.cycling ?? CYCLING_OPTIONS[0].id);
  const [autoModes, setAutoModes] = useState<string[]>(initialGun?.autoModes?.length ? initialGun.autoModes : [AUTO_MODES[0].id]);
  // The toggle remembers the manual choice so switching Automatic off restores it
  const [manualCycling, setManualCycling] = useState(initialGun && initialGun.cycling !== AUTO_CYCLING ? initialGun.cycling : CYCLING_OPTIONS[0].id);
  const automatic = cycling === AUTO_CYCLING;
  const toggleAutomatic = (on: boolean) => { if (on) { setManualCycling(cycling); setCycling(AUTO_CYCLING); } else setCycling(manualCycling); };
  const toggleMode = (id: string) => setAutoModes(m => m.includes(id) ? (m.length > 1 ? m.filter(x => x !== id) : m) : [...m, id]);
  const [attachments, setAttachments] = useState<Record<string, string>>(initialGun?.attachments ?? {});
  // Magazine size: blank uses the default for the reload method
  const [magSize, setMagSize] = useState(initialGun?.magazineSize ? String(initialGun.magazineSize) : '');

  const receiver = getGunReceiver(receiverId);
  const ammo = getAmmo(ammoId);
  const loaded = getLoadedAmmo({ ammoId, loadedAmmoId, roundId });
  const round = getLoadedRound({ ammoId, loadedAmmoId, roundId });
  const changeAmmo = (id: string) => { setAmmoId(id); setLoadedAmmoId(undefined); setRoundId(getAmmo(id)?.rounds[0]?.id); };
  const complete = !!receiver && !!ammo;

  const changeReceiver = (id: string) => {
    const r = getGunReceiver(id);
    if (!r) return;
    setReceiverId(id);
    if (!r.ammo.includes(ammoId)) { setAmmoId(''); setLoadedAmmoId(undefined); setRoundId(undefined); }
  };

  const draft: Firearm = {
    id: initialGun?.id ?? genId(), name: name.trim(), receiver: receiverId, ammoId, roundId, loadedAmmoId, profOverride,
    rifling, stock, barrelLevel, storage, cycling, autoModes: cycling === AUTO_CYCLING ? AUTO_MODES.filter(m => autoModes.includes(m.id)).map(m => m.id) : undefined, attachments, mentalStat: initialGun?.mentalStat,
    magazineSize: Number.parseInt(magSize, 10) > 0 ? Number.parseInt(magSize, 10) : undefined, rounds: initialGun?.rounds,
  };
  const fit = resolveGunProf(c, draft);
  const profDef = getGunProfDef(fit.key ?? fit.fits[0]?.key);
  const ownsProf = !!fit.prof;
  const others = fit.fits.filter(f => f.key !== fit.key);
  const sizeNow = Number.parseInt(magSize, 10) > 0 ? Number.parseInt(magSize, 10) : defaultMagazineSize(storage, cycling);
  const bonus = getGunWeaponBonus(draft);
  const parts = getGunBonusParts(draft).filter(p => p.value !== 0);

  const handleSave = () => {
    if (!name.trim() || !complete) return;
    onSave({ ...draft, attachments: Object.fromEntries(Object.entries(attachments).filter(([, v]) => v)) });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialGun ? 'Edit Firearm' : 'New Firearm'}
      </span>

      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Firearm name..." className="h-8" />

      {/* Core receiver */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Core receiver</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Receiver">
            <Select value={receiverId} onValueChange={changeReceiver}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a receiver..." /></SelectTrigger>
              <SelectContent>
                {GUN_RECEIVERS.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {receiver && (
            <Field label="Chambered ammunition (sets the damage dice)">
              <Select value={ammoId} onValueChange={changeAmmo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick ammo..." /></SelectTrigger>
                <SelectContent>
                  {receiver.ammo.map(id => {
                    const a = getAmmo(id)!;
                    const compat = (a.compatible ?? []).map(c => getAmmo(c)?.label).filter(Boolean).join(', ');
                    return <SelectItem key={id} value={id}>{a.label} — {ammoDice(a)}{compat ? ` (also loads ${compat})` : ''}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </Field>
          )}
          {ammo && (
            <div className="sm:col-span-2">
              <Field label="Loaded ammo (round type)">
                <Select value={`${loaded?.id ?? ammoId}:${round?.id ?? ''}`} onValueChange={v => { const [am, ro] = v.split(':'); setLoadedAmmoId(am === ammoId ? undefined : am); setRoundId(ro); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getLoadOptions(ammoId).map(o => <SelectItem key={`${o.ammoId}:${o.roundId}`} value={`${o.ammoId}:${o.roundId}`}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>
      </div>

      {receiver && (
        <>
          {/* Base attachments */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Base attachments</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Rifling">
                <Select value={rifling} onValueChange={setRifling}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RIFLING_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}{o.bonus ? ` (+${o.bonus})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stock">
                <Select value={stock} onValueChange={setStock}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STOCK_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}{o.bonus ? ` (+${o.bonus})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Barrel length">
                <Select value={String(barrelLevel)} onValueChange={v => setBarrelLevel(Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: MAX_BARREL_LEVEL + 1 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{barrelLabel(i)}{i ? ` (+${i})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reload: ammo storage">
                <Select value={storage} onValueChange={setStorage}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STORAGE_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reload: round cycling">
                {automatic ? (
                  <div className="h-8 px-2 flex items-center rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">Automatic</div>
                ) : (
                  <Select value={cycling} onValueChange={setCycling}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CYCLING_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.group === o.label ? o.label : `${o.group} — ${o.label}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Switch checked={automatic} onCheckedChange={toggleAutomatic} aria-label="Automatic cycling" />
              <span className="text-xs text-foreground">Automatic</span>
              {automatic && (
                <div className="flex items-center gap-1 flex-wrap">
                  {AUTO_MODES.map(m => (
                    <button key={m.id} onClick={() => toggleMode(m.id)}
                      className={`px-2 py-0.5 rounded-md border text-xs transition-colors ${autoModes.includes(m.id) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-[11px] text-muted-foreground">{automatic ? 'Pick one, two or all three fire modes.' : 'Turn on to cycle automatically instead.'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {[STORAGE_OPTIONS.find(o => o.id === storage)?.note, CYCLING_OPTIONS.find(o => o.id === cycling)?.note].filter(Boolean).join(' ')}
            </p>
          </div>

          {/* Magazine */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Magazine</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMagSize(String(Math.max(1, sizeNow - 1)))} disabled={sizeNow <= 1}><Minus className="h-3 w-3" /></Button>
              <Input type="number" min={1} value={sizeNow} onChange={e => setMagSize(e.target.value)} className="h-8 w-20 text-xs text-center" aria-label="Magazine size" />
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMagSize(String(sizeNow + 1))}><Plus className="h-3 w-3" /></Button>
              <span className="text-[11px] text-muted-foreground">rounds. You pick it; the starting value is a placeholder default for this reload method ({defaultMagazineSize(storage, cycling)}).</span>
              {magSize !== '' && <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setMagSize('')}>Use default</Button>}
            </div>
            <p className="text-[11px] text-muted-foreground">Each attack uses one round. Reload on the gun card refills it from your Inventory ammo.</p>
          </div>

          {/* Interchangeable attachments */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Attachments <span className="font-normal text-muted-foreground">(optional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ATTACHMENT_SLOTS.map(slot => (
                <Field key={slot.id} label={slot.label}>
                  <Select value={attachments[slot.id] ?? NONE}
                    onValueChange={v => setAttachments(a => ({ ...a, [slot.id]: v === NONE ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {slot.options.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Proficiency comes from the build; the override picks one by hand */}
      {receiver && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Proficiency{profOverride ? ' (override)' : ' (from the build)'}:{' '}
              <span className="font-semibold text-foreground">{profDef?.name ?? 'none fits this build'}{fit.penalty > 0 ? ` at -${fit.penalty}` : ''}</span>
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setOverrideOpen(o => !o)}>
              {overrideOpen ? 'Hide override' : 'Override'}
            </Button>
          </div>
          {overrideOpen && (
            <Select value={profOverride ?? NONE} onValueChange={v => setProfOverride(v === NONE ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Automatic (from the build)</SelectItem>
                {GUN_PROFICIENCIES.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {!profOverride && fit.penalty > 0 && fit.reason && (
            <p className="text-[11px] text-muted-foreground">Fires at -{fit.penalty}: {fit.reason}.</p>
          )}
          {!profOverride && others.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {others.map(f => `${getGunProfDef(f.key)?.name} at -${f.penalty}`).join(' and ')} also work{others.length === 1 ? 's' : ''} for this build; the best one you have taken is used.
            </p>
          )}
          {!profOverride && fit.fits.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No proficiency fits this build: at barrel level 2 a stocked gun needs Carbine ammo or heavier. It can still be fired without a proficiency, or pick one with the override.</p>
          )}
          {profDef && !ownsProf && (
            <p className="text-[11px] text-muted-foreground">You don't have the {profDef.name} proficiency. You can still fire with the weapon bonus plus INT or WIS; taking it (Proficiencies tab, Firearms) adds its level.</p>
          )}
          <details>
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">How the build picks a proficiency</summary>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {GUN_PROFICIENCIES.map(p => <li key={p.key}><span className="font-semibold text-foreground">{p.name}:</span> {p.summary}</li>)}
            </ul>
          </details>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs space-y-0.5 flex-1">
            <div>
              <span className="text-muted-foreground">Damage: </span>
              <span className="font-semibold text-foreground">{loaded && round ? `${ammoDice(loaded)} (${loaded.label} ${round.label}), ${fmtMult(round.multiplier)} multiplier, ${fmtAp(round.ap)}, base injury ${loaded.baseInjury}` : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weapon bonus: </span>
              <span className="font-semibold text-primary">+{bonus}</span>
              <span className="text-muted-foreground ml-1.5 text-[10px]">({parts.map(p => p.label === 'Base' ? `Base ${p.value}` : `${p.label} +${p.value}`).join(', ')})</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {onCancel && <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={onCancel}>Cancel</Button>}
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={!name.trim() || !complete}>
              {initialGun ? 'Save Changes' : 'Create Firearm'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
