import { ALL_ELEMENTS } from '@/lib/allElements';
import { getElementMeta } from '@/lib/elements';

// Minitabla periódica de los 118 elementos con layout estándar (18 columnas).
// Lantánidos y actínidos se colocan en dos filas inferiores.
export const CATEGORY_COLORS = {
  'Gas noble': 'bg-cyan-500/30 border-cyan-400/40 text-cyan-100',
  'Halógeno': 'bg-lime-500/30 border-lime-400/40 text-lime-100',
  'Metal alcalino': 'bg-fuchsia-500/30 border-fuchsia-400/40 text-fuchsia-100',
  'Alcalinotérreo': 'bg-orange-500/30 border-orange-400/40 text-orange-100',
  'Metal de transición': 'bg-rose-500/30 border-rose-400/40 text-rose-100',
  'Metaloide': 'bg-teal-500/30 border-teal-400/40 text-teal-100',
  'No metal': 'bg-sky-500/30 border-sky-400/40 text-sky-100',
  'Metal del bloque p': 'bg-slate-500/30 border-slate-400/40 text-slate-100',
  'Lantánido': 'bg-amber-500/30 border-amber-400/40 text-amber-100',
  'Actínido': 'bg-pink-500/30 border-pink-400/40 text-pink-100',
};

function tablePosition(z) {
  if (z === 1) return { row: 1, col: 1 };
  if (z === 2) return { row: 1, col: 18 };
  if (z >= 3 && z <= 4) return { row: 2, col: z - 2 };
  if (z >= 5 && z <= 10) return { row: 2, col: z + 8 };
  if (z >= 11 && z <= 12) return { row: 3, col: z - 10 };
  if (z >= 13 && z <= 18) return { row: 3, col: z };
  if (z >= 19 && z <= 36) return { row: 4, col: z - 18 };
  if (z >= 37 && z <= 54) return { row: 5, col: z - 36 };
  if (z >= 55 && z <= 56) return { row: 6, col: z - 54 };
  if (z >= 72 && z <= 86) return { row: 6, col: z - 68 };
  if (z >= 87 && z <= 88) return { row: 7, col: z - 86 };
  if (z >= 104 && z <= 118) return { row: 7, col: z - 100 };
  if (z >= 57 && z <= 71) return { row: 9, col: z - 57 + 3 };
  if (z >= 89 && z <= 103) return { row: 10, col: z - 89 + 3 };
  return { row: 0, col: 0 };
}

export default function PeriodicTableMini({ selectedSymbol, onSelectSymbol, compact = false, showTransitCell = false }) {
  const cellSize = compact ? 'w-4 h-4 text-[7px]' : 'w-7 h-7 text-[9px]';
  return (
    <div className={compact ? 'overflow-x-hidden pb-1' : 'overflow-x-auto pb-1'}>
      <div
        className={`grid ${compact ? 'gap-[1px] w-full' : 'gap-[2px] min-w-[520px]'}`}
        style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gridTemplateRows: `repeat(10, auto)` }}
      >
        {showTransitCell && (
          <button
            onClick={() => onSelectSymbol?.('e⁻')}
            title="Electrones en tránsito (se muestran en el visor)"
            style={{ gridColumnStart: 3, gridRowStart: 8 }}
            className={`${cellSize} rounded-[3px] border flex items-center justify-center leading-none bg-amber-500/30 border-amber-400/40 text-amber-100 hover:scale-110 hover:z-10`}
          >
            <span className="font-mono font-bold">e⁻</span>
          </button>
        )}
        {ALL_ELEMENTS.map((el) => {
          const pos = tablePosition(el.z);
          if (!pos.col) return null;
          const meta = getElementMeta(el.z);
          const catClass = CATEGORY_COLORS[meta.category] || CATEGORY_COLORS['Metal del bloque p'];
          const isSelected = selectedSymbol === el.symbol;
          return (
            <button
              key={el.symbol}
              onClick={() => onSelectSymbol?.(el.symbol)}
              title={`${el.name} · ${meta.category}`}
              style={{ gridColumnStart: pos.col, gridRowStart: pos.row }}
              className={`${cellSize} rounded-[3px] border flex flex-col items-center justify-center leading-none transition-all ${catClass} ${
                isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:scale-110 hover:z-10'
              }`}
            >
              <span className="font-mono font-bold">{el.symbol}</span>
              {!compact && <span className="text-white/50 text-[6px]">{el.z}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/60">
      {Object.entries(CATEGORY_COLORS).map(([cat, cls]) => (
        <span key={cat} className="inline-flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm border ${cls.split(' ').filter((c) => c.startsWith('bg-')).join(' ')}`} />
          {cat}
        </span>
      ))}
    </div>
  );
}