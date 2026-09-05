import { useState } from 'react';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { getElementMeta, electronegativity, metallicCharacter, getElectronicConfig, groupNotation } from '@/lib/elements';
import { getElementProps } from '@/lib/elementProps';
import BohrAtom3D from '@/components/BohrAtom3D';
import PeriodicTableMini from '@/components/PeriodicTableMini';

// Explorador de estructura atómica con minitabla periódica, modelo de Bohr 3D
// y propiedades completas de cada elemento.
export default function ElementBohrExplorer({ selectedSymbol: controlledSymbol, onSelectSymbol }) {
  const [internalSymbol, setInternalSymbol] = useState('C');
  const [showTable, setShowTable] = useState(true);
  const [query, setQuery] = useState('');
  const selectedSymbol = controlledSymbol ?? internalSymbol;
  const handleSelect = (sym) => {
    if (onSelectSymbol) onSelectSymbol(sym);
    else setInternalSymbol(sym);
  };
  const selected = ALL_ELEMENTS.find((e) => e.symbol === selectedSymbol) || ALL_ELEMENTS[0];
  const neutrons = selected.mass - selected.z;
  const meta = getElementMeta(selected.z);
  const config = getElectronicConfig(selected.z);
  const en = electronegativity(selected.z);
  const metallic = metallicCharacter(meta.category);
  const groupLabel = groupNotation(meta.group, selected.z);
  const props = getElementProps(selected.z);
  const q = query.toLowerCase().trim();
  const results = q ? ALL_ELEMENTS.filter((el) =>
    el.symbol.toLowerCase().includes(q) || el.name.toLowerCase().includes(q) || String(el.z) === q
  ) : [];

  const fmt = (v, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);

  return (
    <div className="space-y-3">
      {/* Minitabla periódica para acceso rápido */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/50">Buscar o tabla periódica</p>
          <button onClick={() => setShowTable((s) => !s)} className="text-xs text-indigo-300 hover:text-indigo-200">
            {showTable ? 'Ocultar tabla' : 'Mostrar tabla'}
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Símbolo, nombre o nº atómico..."
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
          />
          {results.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg bg-[#0d0f15] border border-white/10 shadow-xl">
              {results.slice(0, 30).map((el) => (
                <button
                  key={el.symbol}
                  onClick={() => { handleSelect(el.symbol); setQuery(''); }}
                  className="w-full text-left px-3 py-1.5 text-sm flex justify-between items-center hover:bg-white/5"
                >
                  <span><span className="font-mono">{el.symbol}</span> · {el.name}</span>
                  <span className="text-white/40 text-xs font-mono">{el.z}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {showTable && <PeriodicTableMini selectedSymbol={selectedSymbol} onSelectSymbol={handleSelect} />}
      </div>

      {/* Modelo 3D + información completa */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="w-full sm:w-72 h-64 rounded-lg bg-black/20 border border-white/10 overflow-hidden">
          <BohrAtom3D data={selected} />
        </div>
        <div className="flex-1 space-y-2 w-full">
          <h4 className="text-base font-semibold flex items-center gap-2">
            {selected.name}
            <span className="text-sm font-mono text-white/50">{selected.symbol}</span>
          </h4>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Nº atómico</span>
              <span className="font-mono text-white/80">{selected.z}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Masa</span>
              <span className="font-mono text-white/80">{selected.mass}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Protones</span>
              <span className="font-mono text-red-300">{selected.z}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Neutrones</span>
              <span className="font-mono text-white/70">{neutrons}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Electrones</span>
              <span className="font-mono text-blue-300">{selected.z}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Valencia</span>
              <span className="font-mono text-emerald-300">{meta.valence} e⁻</span>
            </div>
            <div className="col-span-2 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Grupo</span>
              <span className="text-indigo-300">{groupLabel}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Período</span>
              <span className="font-mono text-indigo-300">{meta.period ?? '—'}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Categoría</span>
              <span className="text-white/80 text-[10px]">{meta.category}</span>
            </div>
            <div className="col-span-2 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Config. electrónica</span>
              <span className="font-mono font-bold text-sky-200 text-[11px] text-right">{config}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">Electroneg.</span>
              <span className="font-mono text-fuchsia-300">{en ?? '—'}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 flex justify-between">
              <span className="text-white/50">C. metálico</span>
              <span className="text-white/80">{metallic}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Propiedades fisicoquímicas de la tabla */}
      {props && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/50 mb-2">Propiedades fisicoquímicas</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
            <Prop label="Estado" value={props.state} />
            <Prop label="Densidad" value={fmt(props.density, ' g/cm³')} />
            <Prop label="P. fusión" value={fmt(props.melt, ' °C')} />
            <Prop label="P. ebullición" value={fmt(props.boil, ' °C')} />
            <Prop label="Radio atómico" value={fmt(props.radius, ' pm')} />
            <Prop label="E. ionización" value={fmt(props.ionization, ' kJ/mol')} />
            <Prop label="Est. oxidación" value={props.oxidation} />
            <Prop label="Descubrimiento" value={props.discovered} />
          </div>
        </div>
      )}
    </div>
  );
}

function Prop({ label, value }) {
  return (
    <div className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10">
      <div className="text-white/50 text-[10px]">{label}</div>
      <div className="text-white/85 mt-0.5">{value}</div>
    </div>
  );
}