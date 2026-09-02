import SkillCard from '../sheet/SkillCard';
import { ATTRIBUTE_KEYS, ATTRIBUTE_INFO } from '../../types/character';

export default function SkillsTab() {
  return (
    <div className="p-4 space-y-6">
      {ATTRIBUTE_KEYS.map(attrKey => {
        const { abbr, full, skills } = ATTRIBUTE_INFO[attrKey];
        return (
          <div key={attrKey}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-primary">{abbr}</h3>
              <span className="text-xs text-muted-foreground">{full}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {skills.map(sk => <SkillCard key={sk} skillKey={sk} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
