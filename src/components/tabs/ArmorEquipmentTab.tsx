import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChar } from '../../context/CharacterContext';
import ResourcesPanel from './ResourcesPanel';
import ArmorPanel from './ArmorPanel';
import LoadoutPanel from './LoadoutPanel';
import InventoryPanel from './InventoryPanel';
import InjuriesPanel from './InjuriesPanel';
import WeaponsPanel from './WeaponsPanel';
import { Textarea } from '@/components/ui/textarea';

export default function ArmorEquipmentTab() {
  const { character: c, setCharacter } = useChar();
  return (
    <Tabs defaultValue="resources" className="w-full">
      <div className="px-4 pt-4">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="armor">Armor</TabsTrigger>
          <TabsTrigger value="injuries">Injuries</TabsTrigger>
          <TabsTrigger value="loadouts">Loadouts</TabsTrigger>
          <TabsTrigger value="weapons">Weapons</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="resources"><ResourcesPanel /></TabsContent>
      <TabsContent value="armor"><ArmorPanel /></TabsContent>
      <TabsContent value="injuries"><InjuriesPanel /></TabsContent>
      <TabsContent value="loadouts"><LoadoutPanel /></TabsContent>
      <TabsContent value="weapons"><WeaponsPanel /></TabsContent>
      <TabsContent value="inventory"><InventoryPanel /></TabsContent>
      <TabsContent value="notes">
        <div className="p-4">
          <Textarea value={c.notes} onChange={e => setCharacter(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notes, quests, backstory..." className="font-mono text-sm min-h-[300px] resize-y" rows={15} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
