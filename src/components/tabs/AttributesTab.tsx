import AttributeCard from '../sheet/AttributeCard';
import { ATTRIBUTE_KEYS } from '../../types/character';

export default function AttributesTab() {
  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ATTRIBUTE_KEYS.map(key => <AttributeCard key={key} attrKey={key} />)}
      </div>
    </div>
  );
}
