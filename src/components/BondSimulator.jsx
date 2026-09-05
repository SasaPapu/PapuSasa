import { useMemo, useState } from 'react';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { ELEMENT_COLORS, analyzeBond, getElementMeta, electronegativity, metallicCharacter } from '@/lib/elements';
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from '@/components/ui/select';
import { Zap, Atom, Layers, Orbit, Sparkles } from 'lucide-react';
import Bond3DViewer from '@/components/Bond3DViewer';

// Combinaciones de ejemplo que ilustran la electronegatividad y el tipo de enlace
const PRESETS = [
  { a: 'Na', b: 'Cl', label: 'Na + Cl (1 y 7 · iónico)' },
  { a: 'Mg', b: 'O', label: 'Mg + O (2 y 6 · iónico)' },
  { a: 'Mg', b: 'Cl', label: 'Mg + Cl (2 y 7 · iónico)' },
  { a: 'Al', b: 'N', label: 'Al + N (3 y 5 · iónico)' },
  { a: 'H', b: 'Cl', label: 'H + Cl (polar simple)' },
  { a: 'C', b: 'O', label: 'C + O (polar doble)' },
  { a: 'O', b: 'O', label: 'O₂ (apolar doble)' },
  { a: 'N', b: 'N', label: 'N₂ (apolar triple)' },
  { a: 'H', b: 'H', label: 'H₂ (apolar simple)' },
];

function chipsFor(el) {
  const meta = getElementMeta(el.z);
  const en = electronegativity(el.z);
  return (
    <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">Masa</span>
        <span className="font-mono text-white/80">{el.mass}</span>
      </div>
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">Categoría</span>
        <span className="text-white/80 text-[10px]">{meta.category}</span>
      </div>
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">Electroneg.</span>
        <span className="font-mono text-fuchsia-300">{en ?? '—'}</span>
      </div>
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">C. metálico</span>
        <span className="text-white/80">{metallicCharacter(meta.category)}</span>
      </div>
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">Valencia</span>
        <span className="font-mono text-emerald-300">{meta.valence} e⁻</span>
      </div>
      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex justify-between">
        <span className="text-white/50">Grupo</span>
        <span className="font-mono text-indigo-300">{meta.group ?? '—'}</span>
      </div>
    </div>
  );
}

export default function BondSimulator({ fullscreen = false }) {
  const [symA, setSymA] = useState('Na');
  const [symB, setSymB] = useState('Cl');

  const elemA = useMemo(() => ALL_ELEMENTS.find((e) => e.symbol === symA) || ALL_ELEMENTS[0], [symA]);
  const elemB = useMemo(() => ALL_ELEMENTS.find((e) => e.symbol === symB) || ALL_ELEMENTS[1], [symB]);
  const bond = useMemo(() => analyzeBond(elemA, elemB), [elemA, elemB]);

  const typeBadge = {
    ionic: { label: 'Iónico', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: Zap },
    covalent: { label: 'Covalente', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30', Icon: Atom },
    metallic: { label: 'Metálico', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30', Icon: Layers },
    none: { label: 'Sin enlace', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30', Icon: Orbit },
  }[bond.type];

  if (fullscreen) {
    return (
      <div className="flex-1 min-h-0 relative">
        <Bond3DViewer
          elemA={elemA}
          elemB={elemB}
          bondType={bond.type}
          transferCount={bond.transferCount || 0}
          sharedCount={(bond.sharedPairs || 0) * 2}
        />
        <div className="absolute top-3 left-3 z-30 pointer-events-none max-w-xl">
          <h2 className="text-xl font-semibold flex items-center gap-2 drop-shadow-lg">
            {bond.type !== 'none' && bond.type !== 'metallic' ? bond.formula : `${elemA.symbol} + ${elemB.symbol}`}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${typeBadge.cls}`}>
              <typeBadge.Icon className="w-3 h-3" />
              {typeBadge.label}
            </span>
            {bond.bondOrderLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-violet-500/15 text-violet-300 border-violet-500/30">
                Enlace {bond.bondOrderLabel.toLowerCase()}
              </span>
            )}
          </h2>
          <p className="text-xs text-white/60 drop-shadow">{bond.reason}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-xs">
              <span className="text-white/50">ΔEN</span>
              <span className="font-mono text-fuchsia-300">{bond.deltaEN ?? '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-xs">
              <span className="text-white/50">Polaridad</span>
              <span className="text-white/80">{bond.polarity}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Combinar elementos</h2>
        <p className="text-sm text-white/50">Elige dos elementos y observa cómo se enlazan.</p>
      </div>

      {/* Selectores de elementos */}
      <div className="grid grid-cols-2 gap-3">
        {[{ sym: symA, set: setSymA, label: 'Elemento 1' }, { sym: symB, set: setSymB, label: 'Elemento 2' }].map((slot) => {
          const el = ALL_ELEMENTS.find((e) => e.symbol === slot.sym);
          return (
            <div key={slot.label} className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-xs text-white/50 mb-2">{slot.label}</p>
              <Select value={slot.sym} onValueChange={slot.set}>
                <SelectTrigger className="w-full bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72 bg-[#0d0f15] border-white/10">
                  {ALL_ELEMENTS.map((e) => (
                    <SelectItem key={e.symbol} value={e.symbol}>
                      <span className="font-mono">{e.symbol}</span> · {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: ELEMENT_COLORS[el.symbol] || '#888' }} />
                <span className="text-sm font-medium">{el.name}</span>
                <span className="text-xs font-mono text-white/40">Z={el.z}</span>
              </div>
              {chipsFor(el)}
            </div>
          );
        })}
      </div>

      {/* Combinaciones de ejemplo */}
      <div>
        <p className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Combinaciones de ejemplo</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setSymA(p.a); setSymB(p.b); }}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                symA === p.a && symB === p.b
                  ? 'bg-indigo-500/25 border-indigo-400/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resultado del enlace */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${typeBadge.cls}`}>
            <typeBadge.Icon className="w-3.5 h-3.5" />
            {typeBadge.label}
          </span>
          {bond.type !== 'none' && bond.type !== 'metallic' && (
            <span className="text-2xl font-mono font-semibold text-white">{bond.formula}</span>
          )}
          {bond.bondOrderLabel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-violet-500/15 text-violet-300 border-violet-500/30">
              Enlace {bond.bondOrderLabel.toLowerCase()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30">
            ΔEN {bond.deltaEN ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-white/5 border-white/10 text-white/80">
            {bond.polarity}
          </span>
        </div>
        <p className="text-sm text-white/60 mt-2">{bond.reason}</p>

        {bond.type === 'ionic' && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200">
                {bond.metal.symbol} → {bond.metal.symbol}⁺{bond.metalCharge > 1 ? bond.metalCharge : ''} (cede {bond.transferCount} e⁻)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-200">
                {bond.nonmetal.symbol} → {bond.nonmetal.symbol}⁻{Math.abs(bond.nonmetalCharge) > 1 ? Math.abs(bond.nonmetalCharge) : ''} (gana {bond.transferCount} e⁻)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                Estequiometría: {bond.nMetal}:{bond.nNonmetal}
              </span>
            </div>
            {/* Antes / después de la transferencia */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-black/20 border border-white/10 p-2.5">
                <p className="text-[11px] text-white/40 mb-1">Antes (valencia)</p>
                <p className="text-sm font-mono">
                  <span className="text-amber-300">{bond.metal.symbol}:</span> {bond.metalShellsBefore.join(' · ')} e⁻
                </p>
                <p className="text-sm font-mono">
                  <span className="text-sky-300">{bond.nonmetal.symbol}:</span> {bond.nonmetalShellsBefore.join(' · ')} e⁻
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                <p className="text-[11px] text-white/40 mb-1">Después (octeto)</p>
                <p className="text-sm font-mono">
                  <span className="text-amber-300">{bond.metal.symbol}⁺:</span> {bond.metalShellsAfter.join(' · ') || '0'} e⁻
                </p>
                <p className="text-sm font-mono">
                  <span className="text-sky-300">{bond.nonmetal.symbol}⁻:</span> {bond.nonmetalShellsAfter.join(' · ')} e⁻ ✓
                </p>
              </div>
            </div>
          </div>
        )}

        {bond.type === 'covalent' && (
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
              Pares compartidos: <span className="font-mono text-sky-300">{bond.sharedPairs}</span> ({bond.bondOrderLabel.toLowerCase()})
            </span>
            {bond.homo !== undefined && (
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                {bond.homo ? 'Mismo elemento → apolar' : 'Elementos distintos → puede ser polar'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Visor 3D del enlace */}
      <div className="h-72 rounded-xl bg-black/30 border border-white/10 overflow-hidden">
        <Bond3DViewer
          elemA={elemA}
          elemB={elemB}
          bondType={bond.type}
          transferCount={bond.transferCount || 0}
          sharedCount={(bond.sharedPairs || 0) * 2}
        />
      </div>
      <p className="text-[10px] text-white/30 text-center">
        Las esferas amarillas muestran los electrones de valencia que se transfieren (iónico) o comparten (covalente).
      </p>
    </div>
  );
}