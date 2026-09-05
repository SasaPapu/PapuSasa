import { useState } from 'react';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { analyzeBond, electronegativity } from '@/lib/elements';
import PeriodicTableMini, { CategoryLegend } from '@/components/PeriodicTableMini';
import Bond3DViewer from '@/components/Bond3DViewer';
import { Search, X, Atom, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

// Vista "Transiciones": misma estructura que Combinar (visor 3D central +
// columna derecha con tabla periódica), pero el visor muestra los electrones
// en tránsito del enlace entre dos elementos, con fases antes/después y pausa.
export default function TransitionLab3D({ fullscreen = false }) {
  const [pair, setPair] = useState([null, null]);
  const [query, setQuery] = useState('');
  const [tableExpanded, setTableExpanded] = useState(false);

  const addElement = (symbol) => {
    if (symbol === 'e⁻') return; // celda informativa, no añade átomo
    const el = ALL_ELEMENTS.find((e) => e.symbol === symbol);
    if (!el) return;
    setPair((prev) => {
      if (!prev[0]) return [{ symbol: el.symbol, z: el.z }, prev[1]];
      if (!prev[1]) return [prev[0], { symbol: el.symbol, z: el.z }];
      return [prev[0], { symbol: el.symbol, z: el.z }]; // reemplaza el segundo
    });
  };
  const clearPair = () => setPair([null, null]);
  const removeSlot = (i) => setPair((prev) => prev.map((p, idx) => (idx === i ? null : p)));

  const has2 = pair[0] && pair[1];
  const bond = has2 ? analyzeBond(pair[0], pair[1]) : null;

  const results = query.trim()
    ? ALL_ELEMENTS.filter((el) => {
        const q = query.toLowerCase().trim();
        return el.symbol.toLowerCase().includes(q) || el.name.toLowerCase().includes(q) || String(el.z) === q;
      })
    : [];

  const slotView = (s, i) =>
    s ? (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/15">
        <span className="text-lg font-bold font-mono">{s.symbol}</span>
        <span className="text-[10px] text-fuchsia-300 font-mono">EN {electronegativity(s.z) ?? '—'}</span>
        <button onClick={() => removeSlot(i)} className="ml-1 text-white/40 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <div className="flex items-center justify-center px-3 py-2 rounded-lg border border-dashed border-white/15 text-white/30 text-xs">Vacío</div>
    );

  return (
    <div className={fullscreen ? 'flex flex-col h-full w-full bg-[#0a0c12]' : 'flex flex-col gap-2 h-[680px]'}>
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          {slotView(pair[0], 0)}
          <span className="text-white/40 text-xl">+</span>
          {slotView(pair[1], 1)}
        </div>
        <button onClick={clearPair} disabled={!pair[0] && !pair[1]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/25 disabled:opacity-40">
          <RotateCcw className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>

      <div className="px-1"><div className="rounded-lg border border-white/10 bg-white/[0.03] p-2"><CategoryLegend /></div></div>

      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
        <div className="relative flex-1 min-h-0 rounded-lg border border-white/10 overflow-hidden bg-black/30">
          {has2 ? (
            <Bond3DViewer
              elemA={pair[0]}
              elemB={pair[1]}
              bondType={bond.type}
              transferCount={bond.transferCount || 0}
              sharedCount={(bond.sharedPairs || 0) * 2}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Atom className="w-10 h-10 text-white/30" />
              <p className="text-white/50 text-sm text-center max-w-xs">
                Elige dos elementos en la tabla de la derecha para ver sus <span className="text-amber-300">electrones en tránsito</span> (antes y después).
              </p>
            </div>
          )}
        </div>

        <div className={`shrink-0 w-full ${tableExpanded ? 'lg:w-[640px]' : 'lg:w-96'} rounded-lg border border-white/10 bg-white/[0.03] p-2.5 flex flex-col min-h-0 transition-all`}>
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-indigo-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar elemento..."
              className="flex-1 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
            />
            <button onClick={() => setTableExpanded((v) => !v)} className="p-1.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 shrink-0" title={tableExpanded ? 'Contraer tabla' : 'Expandir tabla'}>
              {tableExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          {query.trim() && (
            <div className="mb-2 max-h-28 overflow-y-auto rounded-md bg-[#0d0f15] border border-white/10 p-1.5 flex flex-wrap gap-1">
              {results.length > 0 ? results.slice(0, 40).map((el) => (
                <button key={el.symbol} onClick={() => addElement(el.symbol)} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono hover:bg-white/10">
                  {el.symbol} <span className="text-white/40">{el.z}</span>
                </button>
              )) : <p className="text-xs text-white/40 px-1">Sin resultados</p>}
            </div>
          )}
          <PeriodicTableMini onSelectSymbol={addElement} compact showTransitCell />
        </div>
      </div>
    </div>
  );
}