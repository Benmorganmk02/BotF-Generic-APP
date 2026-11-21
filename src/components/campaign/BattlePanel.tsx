import type { GetCampaignCharactersOutputType } from '../../lib/api/social';
import type { BattleState, BattleToken } from '../../utils/battle';
import { addToken, removeToken, setHostile, GM_COLORS, PLAYER_COLORS } from '../../utils/battle';
import BattleMap from './BattleMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Swords, X } from 'lucide-react';

type CampaignChar = GetCampaignCharactersOutputType['characters'][0];

const Dot = ({ color }: { color: string }) => <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />;
const isNpcChar = (c: CampaignChar) => c.characterType === 'gm' || c.isNpc;

/** The battle map for a running combat. Everyone in the campaign sees the map and a player moves their own token; the
 * GM moves every token, adds characters to it, and sets whether each NPC is friendly or hostile. */
export default function BattlePanel({ battle, characters, isGM, viewerId, onChange, onMoveToken, onEnd }: {
  battle: BattleState; characters: CampaignChar[]; isGM: boolean; viewerId: string;
  onChange: (next: BattleState) => void; onMoveToken: (id: string, x: number, y: number) => void; onEnd: () => void;
}) {
  const off = characters.filter(c => !battle.tokens.some(t => t.id === c.id));
  const add = (c: CampaignChar) => onChange(addToken(battle, {
    id: c.id, name: c.name, kind: isNpcChar(c) ? 'npc' : 'pc', owner: isNpcChar(c) ? undefined : c.playerId || undefined, hostile: isNpcChar(c) ? true : undefined,
  }));

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Combat</h2>
          <Badge variant="outline" className="text-[10px]">1 square = 1 m</Badge>
        </div>
        {isGM && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onEnd}>End combat</Button>}
      </div>

      <BattleMap battle={battle} isGM={isGM} viewerId={viewerId}
        canMove={t => isGM || (t.kind === 'pc' && t.owner === viewerId)}
        onMove={onMoveToken} />

      {/* legend: the colours mean different things to the GM and to a player */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
        {isGM ? (
          <>
            <span className="flex items-center gap-1.5"><Dot color={GM_COLORS.pc} />Players</span>
            <span className="flex items-center gap-1.5"><Dot color={GM_COLORS.friendly} />Friendly NPCs</span>
            <span className="flex items-center gap-1.5"><Dot color={GM_COLORS.hostile} />Hostile NPCs</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><Dot color={PLAYER_COLORS.self} />You</span>
            <span className="flex items-center gap-1.5"><Dot color={PLAYER_COLORS.ally} />Allies</span>
            <span className="flex items-center gap-1.5"><Dot color={PLAYER_COLORS.enemy} />Enemies</span>
            <span className="text-[11px]">Drag your own token to move it. The map updates live for everyone.</span>
          </>
        )}
      </div>

      {isGM && (
        <div className="space-y-2">
          {battle.tokens.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 px-2.5">
              {battle.tokens.map((t: BattleToken) => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-t border-border/50 first:border-t-0">
                  <Dot color={t.kind === 'pc' ? GM_COLORS.pc : t.hostile ? GM_COLORS.hostile : GM_COLORS.friendly} />
                  <span className="text-xs font-medium text-foreground flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t.kind === 'pc' ? 'Player' : t.hostile ? 'Hostile NPC' : 'Friendly NPC'}</span>
                  {t.kind === 'npc' && (
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => onChange(setHostile(battle, t.id, !t.hostile))}>
                      Make {t.hostile ? 'friendly' : 'hostile'}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange(removeToken(battle, t.id))} aria-label={`Remove ${t.name} from the map`}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
          {off.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">Add to the map:</span>
              {off.map(c => (
                <Button key={c.id} size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1" onClick={() => add(c)}>
                  <Plus className="h-3 w-3" />{c.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
