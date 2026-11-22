import type { EffectKind, MapEffect } from '../../utils/battle';

type Motion = 'rise' | 'twinkle' | 'flash' | 'spin' | 'ripple' | 'pulse';

/** How each effect looks and what the map calls the state it puts an area in. Colours follow the spell map's elements. */
export const EFFECT_STYLES: Record<EffectKind, { label: string; emoji: string; color: string; color2: string; motion: Motion }> = {
  fire: { label: 'Burning', emoji: '🔥', color: '#ef4444', color2: '#fdba74', motion: 'rise' },
  frost: { label: 'Frozen', emoji: '❄️', color: '#38bdf8', color2: '#e0f2fe', motion: 'twinkle' },
  lightning: { label: 'Electrified', emoji: '⚡', color: '#facc15', color2: '#fef9c3', motion: 'flash' },
  poison: { label: 'Poison gas', emoji: '☠️', color: '#22c55e', color2: '#bbf7d0', motion: 'rise' },
  arcane: { label: 'Arcane energy', emoji: '✨', color: '#a78bfa', color2: '#ddd6fe', motion: 'spin' },
  water: { label: 'Flooded', emoji: '💧', color: '#3b82f6', color2: '#93c5fd', motion: 'ripple' },
  darkness: { label: 'Darkness', emoji: '🌑', color: '#312e81', color2: '#6d28d9', motion: 'pulse' },
};

// The same effect always scatters its sparks the same way (seeded by its id), so it does not jump when the map redraws
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One effect on the map: an animated area (like a spell's blast) that shows a fire burning, a patch of ice, and so on. */
export default function EffectView({ fx, interactive }: { fx: MapEffect; interactive: boolean }) {
  const st = EFFECT_STYLES[fx.kind];
  const r = fx.radius;
  const rand = seeded(fx.id + fx.kind);
  const gid = `fxg-${fx.id}`;
  const count = Math.min(36, Math.round(r * r * 1.1) + 3);
  const dots = Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.82;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 0.1 + rand() * 0.16, t: 1.1 + rand() * 1.6, b: -rand() * 3 };
  });
  const slow = fx.kind === 'poison' ? 2 : 1;
  // a jagged bolt for lightning
  const bolt = (k: number) => {
    const pts: string[] = [];
    const x0 = (rand() - 0.5) * r, y0 = -r * 0.7;
    for (let i = 0; i <= 5; i++) pts.push(`${(x0 + (rand() - 0.5) * r * 0.5 + k * 0.3).toFixed(2)},${(y0 + (i * r * 1.4) / 5).toFixed(2)}`);
    return pts.join(' ');
  };

  return (
    <g data-effect={fx.id} data-kind={fx.kind} transform={`translate(${fx.x} ${fx.y})`} style={{ pointerEvents: interactive ? 'auto' : 'none', cursor: interactive ? 'grab' : undefined }}>
      <title>{`${st.label} (${r} m)`}</title>
      <defs>
        <radialGradient id={gid}>
          <stop offset="0%" stopColor={st.color2} stopOpacity={0.55} />
          <stop offset="60%" stopColor={st.color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={st.color} stopOpacity={0.06} />
        </radialGradient>
      </defs>

      <circle r={r} fill={`url(#${gid})`} stroke={st.color} strokeOpacity={0.75} strokeWidth={0.1}>
        {st.motion === 'rise' && <animate attributeName="opacity" values="0.75;1;0.8;0.95" dur="0.8s" repeatCount="indefinite" />}
        {st.motion === 'flash' && <animate attributeName="opacity" values="0.55;1;0.5;0.9;0.55" dur="0.9s" repeatCount="indefinite" />}
        {st.motion === 'twinkle' && <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />}
        {st.motion === 'pulse' && <animate attributeName="opacity" values="0.7;1;0.7" dur="4s" repeatCount="indefinite" />}
        {(st.motion === 'rise' || st.motion === 'pulse') && <animate attributeName="r" values={`${r};${r * 1.04};${r * 0.97};${r}`} dur={st.motion === 'pulse' ? '4s' : '1.1s'} repeatCount="indefinite" />}
      </circle>
      {fx.kind === 'darkness' && <circle r={r * 0.7} fill="#000" fillOpacity={0.35} />}

      {st.motion === 'rise' && dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y + r * 0.3} r={d.s} fill={i % 2 ? st.color2 : st.color}>
          <animate attributeName="cy" values={`${d.y + r * 0.3};${d.y - r * 0.5}`} dur={`${d.t * slow}s`} begin={`${d.b}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.95;0" dur={`${d.t * slow}s`} begin={`${d.b}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {st.motion === 'twinkle' && dots.map((d, i) => (
        <rect key={i} x={d.x - d.s} y={d.y - d.s} width={d.s * 2} height={d.s * 2} fill={st.color2} transform={`rotate(45 ${d.x} ${d.y})`}>
          <animate attributeName="opacity" values="0.15;1;0.15" dur={`${d.t * 1.6}s`} begin={`${d.b}s`} repeatCount="indefinite" />
        </rect>
      ))}
      {st.motion === 'flash' && [0, 1].map(k => (
        <polyline key={k} points={bolt(k)} fill="none" stroke={st.color2} strokeWidth={0.14} strokeLinejoin="round" strokeLinecap="round">
          <animate attributeName="opacity" values="0;1;0;0;1;0;0" dur="1.8s" begin={`${-k * 0.9}s`} repeatCount="indefinite" />
        </polyline>
      ))}
      {st.motion === 'spin' && (
        <g>
          <circle r={r * 0.68} fill="none" stroke={st.color2} strokeWidth={0.1} strokeDasharray="0.55 0.4" strokeOpacity={0.9} />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
        </g>
      )}
      {st.motion === 'spin' && dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.s * 0.7} fill={st.color2}>
          <animate attributeName="opacity" values="0.1;1;0.1" dur={`${d.t}s`} begin={`${d.b}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {st.motion === 'ripple' && [0, 1, 2].map(k => (
        <circle key={k} r={0.2} fill="none" stroke={st.color2} strokeWidth={0.1}>
          <animate attributeName="r" values={`0.2;${r}`} dur="3.3s" begin={`${-k * 1.1}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="3.3s" begin={`${-k * 1.1}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {interactive && (
        <circle data-fx-handle={fx.id} cx={r * Math.SQRT1_2} cy={r * Math.SQRT1_2} r={0.4} fill="#ffffff" stroke={st.color} strokeWidth={0.12} style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }}>
          <title>Drag to make it bigger or smaller</title>
        </circle>
      )}
      <text y={0.3} textAnchor="middle" fontSize={Math.min(1.6, 0.7 + r * 0.25)} style={{ pointerEvents: 'none' }}>{st.emoji}</text>
      <text y={r + 0.62} textAnchor="middle" fontSize={0.5} fontWeight={700} fill="#ffffff" stroke="#000000" strokeWidth={0.13} paintOrder="stroke" style={{ pointerEvents: 'none' }}>{st.label}</text>
    </g>
  );
}
