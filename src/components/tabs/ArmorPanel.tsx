import { useChar } from '../../context/CharacterContext';
import {
  ARMOR_LAYERS, ARMOR_SLOTS, ARMOR_LAYER_LABELS, ARMOR_SLOT_LABELS, ArmorLayer, ArmorSlot,
  ARMOR_LAYER_MAX, INJURY_LOCATIONS, INJURY_LOCATION_LABELS,
} from '../../types/character';
import { getArmorForLocation, getArmorForSlot, getArmorPieceAt, ARMOR_SLOTS_FOR_LOCATION } from '../../utils/armorInjury';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, ShieldHalf } from 'lucide-react';

export default function ArmorPanel() {
  const { character: c, setCharacter } = useChar();

  const updateValue = (layer: ArmorLayer, slot: ArmorSlot, raw: string) => {
    const max = ARMOR_LAYER_MAX[layer];
    const value = Math.max(0, Math.min(max, Math.round(Number(raw) || 0)));
    const piece = getArmorPieceAt(c, layer, slot);
    setCharacter(p => ({ ...p, armor: { ...p.armor, [layer]: { ...p.armor[layer], [slot]: { ...piece, value } } } }));
  };
  const updateName = (layer: ArmorLayer, slot: ArmorSlot, name: string) => {
    const piece = getArmorPieceAt(c, layer, slot);
    setCharacter(p => ({ ...p, armor: { ...p.armor, [layer]: { ...p.armor[layer], [slot]: { ...piece, name } } } }));
  };
  const toggleHard = (layer: ArmorLayer, slot: ArmorSlot) => {
    const piece = getArmorPieceAt(c, layer, slot);
    setCharacter(p => ({ ...p, armor: { ...p.armor, [layer]: { ...p.armor[layer], [slot]: { ...piece, hard: !piece.hard } } } }));
  };

  return (
    <div className="p-4 space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted-foreground py-1 pr-3 font-medium w-32">Layer (max)</th>
              {ARMOR_SLOTS.map(s => (
                <th key={s} className="text-xs text-muted-foreground py-1 px-1 font-medium text-center min-w-[110px]">{ARMOR_SLOT_LABELS[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ARMOR_LAYERS.map(layer => (
              <tr key={layer} className="border-t border-border">
                <td className="text-xs font-medium text-foreground py-2 pr-3 align-top">
                  {ARMOR_LAYER_LABELS[layer]} <span className="text-muted-foreground">(+{ARMOR_LAYER_MAX[layer]})</span>
                </td>
                {ARMOR_SLOTS.map(slot => {
                  const piece = getArmorPieceAt(c, layer, slot);
                  return (
                    <td key={slot} className="py-1.5 px-1 align-top">
                      <div className="space-y-1">
                        <Input
                          value={piece.name}
                          onChange={e => updateName(layer, slot, e.target.value)}
                          placeholder="Name"
                          className="h-6 text-[10px] px-1.5 w-full"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={0} max={ARMOR_LAYER_MAX[layer]}
                            value={piece.value}
                            onChange={e => updateValue(layer, slot, e.target.value)}
                            onFocus={e => e.target.select()}
                            className="h-7 text-xs px-1.5 w-full text-center"
                          />
                          <Button
                            type="button" size="icon" variant={piece.hard ? 'default' : 'outline'}
                            className="h-7 w-7 shrink-0"
                            title={piece.hard ? 'Hard armor -- only Heavy attacks/armor-breakers degrade it' : 'Soft armor -- click to mark as hard'}
                            onClick={() => toggleHard(layer, slot)}
                          >
                            {piece.hard ? <Shield className="h-3.5 w-3.5" /> : <ShieldHalf className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-border">
              <td className="text-xs font-semibold text-foreground py-2 pr-3">Slot total</td>
              {ARMOR_SLOTS.map(slot => (
                <td key={slot} className="text-xs font-semibold text-center text-foreground py-2">{getArmorForSlot(c, slot)}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Layers stack -- a slot's total is Clothing + Inner + Middle + Outer, each capped at that layer's own max. The shield toggle marks a piece as <span className="font-medium text-foreground">hard</span> armor (plate, durasteel...) -- it still blocks hits normally, but only a Heavy attack or dedicated armor-breaker can actually degrade it; a normal hit that would damage it degrades the next eligible layer inward instead.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> Armor by Injury Location
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {INJURY_LOCATIONS.map(loc => (
            <div key={loc} className="bg-card border border-border rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">{INJURY_LOCATION_LABELS[loc]}</p>
              <p className="text-lg font-bold text-foreground">{getArmorForLocation(c, loc)}</p>
              <p className="text-[9px] text-muted-foreground">
                {ARMOR_SLOTS_FOR_LOCATION[loc].map(s => ARMOR_SLOT_LABELS[s]).join(' + ')}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Torso is covered by its own slot plus both shoulders; each arm/leg is covered by its own slot (arms also by their shoulder). One point of armor absorbs one success; a hit that meets or exceeds this total automatically costs the location 1 armor point -- outermost eligible layer first -- via the Injuries tab's hit calculator.
        </p>
      </div>
    </div>
  );
}
