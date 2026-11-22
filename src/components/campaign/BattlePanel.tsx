import type { GetCampaignCharactersOutputType, MapPing } from '../../lib/api/social';
import { useState } from 'react';
import type { BattleState, BattleToken, Drawing, EffectKind, MapEffect } from '../../utils/battle';
import { DRAW_COLORS, EFFECT_KINDS, MIN_EFFECT_RADIUS, MAX_EFFECT_RADIUS, upsertEffect, removeEffect, clearEffects, addToken, removeToken, setHostile, setLabel, undoStroke, clearDrawings, defaultNpcBase, resizeBattle, resetMovement, stepMapSize, WALK_SPEED, GM_COLORS, PLAYER_COLORS } from '../../utils/battle';
import BattleMap from './BattleMap';
import type { MapTool } from './BattleMap';
import { EFFECT_STYLES } from './EffectView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crosshair, Eraser, Flame, Footprints, Minus, Trash2, Maximize2, Minimize2, MousePointer2, Pencil, Plus, Swords, Undo2, X } from 'lucide-react';

type CampaignChar = GetCampaignCharactersOutputType['characters'][0];

const Dot = ({ color }: { color: string }) => <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />;
const isNpcChar = (c: CampaignChar) => c.characterType === 'gm' || c.isNpc;

/** The battle map for a running combat. Everyone in the campaign sees the map and a player moves their own token; the
 * GM moves every token, adds characters to it, and sets whether each NPC is friendly or hostile. */
export default function BattlePanel({ battle, characters, isGM, viewerId, onChange, onMoveToken, onEnd, pings, onPing, onDrawStroke, onEffect, onEdit }: {
  battle: BattleState; characters: CampaignChar[]; isGM: boolean; viewerId: string;
  onChange: (next: BattleState) => void; onMoveToken: (id: string, x: number, y: number) => { x: number; y: number } | void; onEnd: () => void;
  pings: MapPing[]; onPing: (x: number, y: number) => void; onDrawStroke: (s: Drawing) => void; onEffect: (e: MapEffect) => void;
  onEdit: (fn: (b: BattleState) => BattleState) => void;
}) {
  const [tool, setTool] = useState<MapTool>('move');
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [fxKind, setFxKind] = useState<EffectKind>('fire');
  const [fxRadius, setFxRadius] = useState(2);
  const toolButton = (id: MapTool, label: string, Icon: typeof Pencil) => (
    <Button size="sm" variant={tool === id ? 'default' : 'outline'} className="h-7 text-xs gap-1" onClick={() => setTool(id)} aria-pressed={tool === id}><Icon className="h-3 w-3" />{label}</Button>
  );
  const off = characters.filter(c => !battle.tokens.some(t => t.id === c.id));
  const bigger = stepMapSize(battle, 1), smaller = stepMapSize(battle, -1);
  const resize = (s: { cols: number; rows: number } | null) => { if (s) onChange(resizeBattle(battle, s.cols, s.rows)); };
  const add = (c: CampaignChar) => onChange(addToken(battle, {
    id: c.id, name: c.name, kind: isNpcChar(c) ? 'npc' : 'pc', owner: isNpcChar(c) ? undefined : c.playerId || undefined, hostile: isNpcChar(c) ? true : undefined,
  }));

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Combat</h2>
          <Badge variant="outline" className="text-[10px]">1 square = 1 m · {battle.cols} × {battle.rows} m</Badge>
        </div>
        {isGM && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onChange(resetMovement(battle))} title={`Everyone gets their ${WALK_SPEED} m of walking back`}><Footprints className="h-3 w-3" />New round</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => resize(smaller)} disabled={!smaller} title="Make the map smaller"><Minimize2 className="h-3 w-3" />Smaller map</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => resize(bigger)} disabled={!bigger} title="Make the map bigger"><Maximize2 className="h-3 w-3" />Bigger map</Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onEnd}>End combat</Button>
          </div>
        )}
      </div>

      {/* tools: move tokens, draw on the map (GM), or ping a spot for everyone */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {toolButton('move', 'Move', MousePointer2)}
        {isGM && toolButton('draw', 'Draw', Pencil)}
        {isGM && toolButton('erase', 'Erase', Eraser)}
        {isGM && toolButton('effect', 'Effect', Flame)}
        {toolButton('ping', 'Ping', Crosshair)}
        {isGM && tool === 'draw' && (
          <>
            <span className="flex items-center gap-1 ml-1">
              {DRAW_COLORS.map(c => (
                <button key={c} type="button" aria-label={`Draw in ${c}`} aria-pressed={drawColor === c} onClick={() => setDrawColor(c)}
                  className={`h-5 w-5 rounded-full border-2 ${drawColor === c ? 'border-primary' : 'border-border'}`} style={{ background: c }} />
              ))}
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onChange(undoStroke(battle))} disabled={!battle.drawings?.length}><Undo2 className="h-3 w-3" />Undo</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onChange(clearDrawings(battle))} disabled={!battle.drawings?.length}><Trash2 className="h-3 w-3" />Clear all</Button>
          </>
        )}
        {isGM && tool === 'effect' && (
          <>
            <span className="flex items-center gap-1 ml-1">
              {EFFECT_KINDS.map(k => (
                <button key={k} type="button" aria-label={EFFECT_STYLES[k].label} title={EFFECT_STYLES[k].label} aria-pressed={fxKind === k} onClick={() => setFxKind(k)}
                  className={`h-7 w-7 rounded-md border-2 text-sm leading-none ${fxKind === k ? 'border-primary bg-primary/10' : 'border-border'}`}>{EFFECT_STYLES[k].emoji}</button>
              ))}
            </span>
            <span className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFxRadius(r => Math.max(MIN_EFFECT_RADIUS, r - 1))} disabled={fxRadius <= MIN_EFFECT_RADIUS} aria-label="Smaller effect"><Minus className="h-3 w-3" /></Button>
              <Input type="number" min={MIN_EFFECT_RADIUS} max={MAX_EFFECT_RADIUS} step={0.5} value={fxRadius} aria-label="Effect radius in metres" className="h-7 w-16 text-xs text-center px-1"
                onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setFxRadius(Math.max(MIN_EFFECT_RADIUS, Math.min(MAX_EFFECT_RADIUS, v))); }} />
              <span className="text-xs text-muted-foreground">m radius</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFxRadius(r => Math.min(MAX_EFFECT_RADIUS, r + 1))} disabled={fxRadius >= MAX_EFFECT_RADIUS} aria-label="Bigger effect"><Plus className="h-3 w-3" /></Button>
            </span>
          </>
        )}
        {tool === 'effect' && <span className="text-[11px] text-muted-foreground">Tap the map to put the effect down. Drag one to move it.</span>}
        {tool === 'ping' && <span className="text-[11px] text-muted-foreground">Tap the map to ping a spot. Everyone sees it for a few seconds.</span>}
        {isGM && tool === 'erase' && <span className="text-[11px] text-muted-foreground">Drag across a line to erase just that line.</span>}
        {isGM && tool === 'move' && ((battle.drawings?.length ?? 0) > 0 || (battle.effects?.length ?? 0) > 0) && <span className="text-[11px] text-muted-foreground">Right-click (or press and hold) a drawing or effect to edit or remove it.</span>}
        {tool === 'draw' && <span className="text-[11px] text-muted-foreground">Drag on the map to draw. Players see it live.</span>}
      </div>

      <BattleMap battle={battle} isGM={isGM} viewerId={viewerId}
        canMove={t => isGM || (t.kind === 'pc' && t.owner === viewerId)}
        onMove={onMoveToken} tool={tool} drawColor={drawColor} pings={pings} onPing={onPing} onStroke={onDrawStroke}
        effectKind={fxKind} effectRadius={fxRadius} onEffect={onEffect} onEdit={onEdit} />

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
            <span className="text-[11px]">Drag your own token to move it: {WALK_SPEED} m of walking per turn. The map updates live for everyone.</span>
          </>
        )}
      </div>

      {isGM && (battle.effects?.length ?? 0) > 0 && (
        <div className="rounded-md border border-border bg-muted/20 px-2.5">
          {battle.effects!.map(fx => (
            <div key={fx.id} className="flex items-center gap-2 py-1.5 border-t border-border/50 first:border-t-0">
              <span className="text-sm leading-none">{EFFECT_STYLES[fx.kind].emoji}</span>
              <span className="text-xs font-medium text-foreground flex-1">{EFFECT_STYLES[fx.kind].label}</span>
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onChange(upsertEffect(battle, { ...fx, radius: fx.radius - 1 }))} disabled={fx.radius <= MIN_EFFECT_RADIUS} aria-label={`Smaller ${EFFECT_STYLES[fx.kind].label}`}><Minus className="h-3 w-3" /></Button>
              <Input key={fx.radius} type="number" min={MIN_EFFECT_RADIUS} max={MAX_EFFECT_RADIUS} step={0.5} defaultValue={fx.radius} aria-label={`${EFFECT_STYLES[fx.kind].label} radius in metres`} className="h-6 w-14 text-[11px] text-center px-1"
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onBlur={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v !== fx.radius) onChange(upsertEffect(battle, { ...fx, radius: v })); }} />
              <span className="text-[11px] text-muted-foreground">m</span>
              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onChange(upsertEffect(battle, { ...fx, radius: fx.radius + 1 }))} disabled={fx.radius >= MAX_EFFECT_RADIUS} aria-label={`Bigger ${EFFECT_STYLES[fx.kind].label}`}><Plus className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange(removeEffect(battle, fx.id))} aria-label={`Remove ${EFFECT_STYLES[fx.kind].label}`} title="Put the effect out"><X className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="py-1.5 border-t border-border/50 text-right">
            <button className="text-[11px] text-muted-foreground underline underline-offset-2" onClick={() => onChange(clearEffects(battle))}>Clear all effects</button>
          </div>
        </div>
      )}

      {isGM && (
        <div className="space-y-2">
          {battle.tokens.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 px-2.5">
              {battle.tokens.map((t: BattleToken) => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-t border-border/50 first:border-t-0">
                  <Dot color={t.kind === 'pc' ? GM_COLORS.pc : t.hostile ? GM_COLORS.hostile : GM_COLORS.friendly} />
                  <span className="text-xs font-medium text-foreground flex-1 truncate min-w-[3rem]">{t.name}{t.kind === 'npc' && t.num ? <span className="text-muted-foreground font-normal"> #{t.num}</span> : null}</span>
                  {t.kind === 'npc' && (
                    <Input key={t.label ?? ''} defaultValue={t.label ?? ''} maxLength={30} aria-label={`Name players see for ${t.name}`}
                      placeholder={`${defaultNpcBase(t)} ${t.num ?? ''} (players see)`.replace('  ', ' ')}
                      title="What players call this NPC, in front of its number. Leave it empty to show Enemy or Ally. The real name stays with you."
                      className="h-6 w-40 text-[11px] px-2"
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      onBlur={e => { const v = e.target.value.trim(); if (v !== (t.label ?? '')) onChange(setLabel(battle, t.id, v)); }} />
                  )}
                  <span className="text-[10px] text-muted-foreground">{t.kind === 'pc' ? 'Player' : t.hostile ? 'Hostile NPC' : 'Friendly NPC'}</span>
                  {(t.moved ?? 0) > 0 && (
                    <button className={`text-[10px] underline underline-offset-2 ${(t.moved ?? 0) > WALK_SPEED ? 'text-red-400' : 'text-muted-foreground'}`} title="Give this token its walking speed back"
                      onClick={() => onChange(resetMovement(battle, t.id))}>{t.moved}/{WALK_SPEED} m · reset</button>
                  )}
                  {t.kind === 'npc' && (
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => onChange(setHostile(battle, t.id, !t.hostile))}>
                      Make {t.hostile ? 'friendly' : 'hostile'}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange(removeToken(battle, t.id))} aria-label={`Remove ${t.name} from the map`} title="Take off the map (the character is kept)"><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Players see each NPC as a name plus its number (Enemy 1, Ally 2). Type a name in the box to show it instead of Enemy or Ally; the real name stays with you.</p>
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
