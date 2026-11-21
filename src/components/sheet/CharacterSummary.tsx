import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, SKILL_LABELS } from '../../types/character';
import type { SkillKey } from '../../types/character';
import { Badge } from '@/components/ui/badge';
import { getWorld } from '../../data/worlds';

/** What a campaign character shows at the Basics and Stats visibility levels. `data` is the redacted character the
 * database sends: it only contains the fields that level allows, so anything missing is simply not shown. */
export default function CharacterSummary({ data, level }: { data: Record<string, any>; level: 'basic' | 'stats' }) {
  const attrs = data.attributes as Record<string, number> | undefined;
  const skills = Object.entries((data.skills ?? {}) as Record<string, number>).filter(([, v]) => v !== 0);
  const profs = (data.proficiencies ?? []) as { name: string; level: number }[];
  const abilities = ((data.abilities ?? []) as (string | { name: string })[]).map(a => (typeof a === 'string' ? a : a.name));
  const bits = [data.race, data.archetype, data.background ? `${data.background} background` : '', data.world ? (getWorld(data.world)?.name ?? data.world) : '']
    .filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-foreground">{data.name || 'Unnamed Character'}</h2>
          <Badge variant="secondary">{data.characterType === 'gm' ? 'GM/NPC' : 'Normal'}</Badge>
          <span className="text-sm text-muted-foreground">Level {data.level ?? 0}</span>
        </div>
        {bits.length > 0 && <p className="text-sm text-muted-foreground">{bits.join(' · ')}</p>}
        {(data.bodyType || data.age) && <p className="text-xs text-muted-foreground">{[data.bodyType, data.age && `Age ${data.age}`].filter(Boolean).join(' · ')}</p>}
        {data.player && <p className="text-xs text-muted-foreground">Player: {data.player}</p>}
      </div>

      {level === 'stats' && (
        <>
          {data.hitPoints && (
            <div className="grid grid-cols-3 gap-2">
              {[
                ['HP', `${data.hitPoints.current}/${data.hitPoints.max}`],
                ['Stamina', data.stamina ? `${data.stamina.current}/${data.stamina.max}` : '—'],
                ['Mana', data.mana ? `${data.mana.current}/${data.mana.max}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-card px-3 py-2 text-center">
                  <div className="text-lg font-bold text-foreground leading-none">{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}

          {attrs && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attributes</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ATTRIBUTE_KEYS.map(k => (
                  <div key={k} className="rounded-md border border-border bg-card px-2 py-1.5 text-center">
                    <div className="text-lg font-bold text-foreground leading-none">{attrs[k] ?? 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{ATTRIBUTE_INFO[k].abbr}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {skills.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">{SKILL_LABELS[k as SkillKey] ?? k} {v > 0 ? `+${v}` : v}</Badge>
                ))}
              </div>
            </section>
          )}

          {profs.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proficiencies</h3>
              <div className="flex flex-wrap gap-1.5">
                {profs.map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p.name} · Lv {p.level}</Badge>)}
              </div>
            </section>
          )}

          {abilities.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abilities</h3>
              <div className="flex flex-wrap gap-1.5">
                {abilities.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
