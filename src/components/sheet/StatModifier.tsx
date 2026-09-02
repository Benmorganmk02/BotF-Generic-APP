interface StatModifierProps {
  label?: string; value: number; onChange: (v: number) => void; extra?: string;
}
export default function StatModifier({ label = 'Modifier', value, onChange, extra }: StatModifierProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded border border-teal-600/30 bg-teal-900/20">
      <span className="text-xs text-teal-400">{label}{extra && <span className="text-teal-300/70 ml-1">{extra}</span>}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(value - 1)}
          className="w-5 h-5 rounded text-xs border border-teal-600/40 hover:bg-teal-700/30 flex items-center justify-center text-teal-400">−</button>
        <span className="text-sm font-mono text-teal-300 w-7 text-center">{value >= 0 ? `+${value}` : value}</span>
        <button onClick={() => onChange(value + 1)}
          className="w-5 h-5 rounded text-xs border border-teal-600/40 hover:bg-teal-700/30 flex items-center justify-center text-teal-400">+</button>
      </div>
    </div>
  );
}
