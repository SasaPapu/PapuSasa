import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import Molecule3DViewer from '@/components/Molecule3DViewer';
import StlMoleculeBuilder from '@/components/StlMoleculeBuilder';
import ElementBohrExplorer from '@/components/ElementBohrExplorer';
import BohrAtom3D from '@/components/BohrAtom3D';
import BondLab3D from '@/components/BondLab3D';
import TransitionLab3D from '@/components/TransitionLab3D';
import IcorLogoBohr from '@/components/IcorLogoBohr';
import { ELEMENT_COLORS, ELEMENT_NAMES, getElementMeta, electronegativity, metallicCharacter, inferBondOrders, classifyCompound } from '@/lib/elements';
import { ALL_ELEMENTS } from '@/lib/allElements';
import {
  FlaskConical,
  Zap,
  Atom,
  Printer,
  Plus,
  Loader2,
  Sparkles,
  AlertCircle,
  X,
  Boxes,
  Maximize2,
  Minimize2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Library,
} from 'lucide-react';

const EXAMPLES = [
  'H2O', 'CO2', 'NH3', 'CH4', 'C2H2', 'C2H4', 'C3H4', 'C6H6', 'C2H6O', 'C3H8',
];
const COMMON_ELEMENTS = ['H', 'C', 'N', 'O', 'Cl', 'Na', 'Al', 'S', 'Fe', 'Au'];

export default function Home() {
  const [compounds, setCompounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('inicio');

  const [showAdd, setShowAdd] = useState(false);
  const [formula, setFormula] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [generated, setGenerated] = useState(null);

  const stageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elementSearch, setElementSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState('C');
  const [recentElements, setRecentElements] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [elemMode, setElemMode] = useState('explorar');
  const [libTab, setLibTab] = useState('compounds');
  const [dbElements, setDbElements] = useState([]);
  const [elemQuery, setElemQuery] = useState('');
  const [selectedElem, setSelectedElem] = useState(null);


  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const selectElement = (symbol) => {
    setSelectedElement(symbol);
    setRecentElements((prev) => [symbol, ...prev.filter((s) => s !== symbol)].slice(0, 8));
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    base44.entities.Compound.list('-created_date', 100)
      .then((data) => {
        setCompounds(data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Carga los elementos de la base de datos (oculta al usuario) al abrir la pestaña Elementos del panel Biblioteca.
  useEffect(() => {
    if (showSearch && view === 'inicio' && libTab === 'elements' && dbElements.length === 0) {
      base44.entities.Element.list('-z', 120)
        .then(setDbElements)
        .catch(() => {});
    }
  }, [showSearch, view, libTab, dbElements.length]);

  const handleGenerate = async (f) => {
    setGenerating(true);
    setGenError('');
    try {
      const res = await base44.functions.invoke('GenerateMolecule', { formula: f });
      setGenerated({ ...res.data.molecule, id: 'generated' });
      setShowAdd(false);
      setFormula('');
    } catch (e) {
      setGenError(e.response?.data?.error || e.message || 'Error al generar');
    } finally {
      setGenerating(false);
    }
  };

  const activeCompound = generated || selected;

  const filtered = compounds
    .filter((c) => {
      const cls = classifyCompound(c).key;
      const matchType = filter === 'all' || cls === filter;
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.formula.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    })
    .sort((a, b) => a.atoms.length + a.bonds.length - (b.atoms.length + b.bonds.length));

  const elementResults = elementSearch.trim()
    ? ALL_ELEMENTS.filter((el) => {
        const q = elementSearch.toLowerCase().trim();
        return (
          el.symbol.toLowerCase().includes(q) ||
          el.name.toLowerCase().includes(q) ||
          String(el.z) === q
        );
      })
    : [];

  const dbElemResults = elemQuery.trim()
    ? dbElements.filter((el) => {
        const q = elemQuery.toLowerCase().trim();
        return (
          el.symbol.toLowerCase().includes(q) ||
          el.name.toLowerCase().includes(q) ||
          String(el.z) === q
        );
      })
    : [];

  const renderCompoundCard = (c) => (
    <button
      key={c.id}
      onClick={() => { setSelected(c); setGenerated(null); setShowSearch(false); }}
      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
        selected?.id === c.id && !generated
          ? 'bg-indigo-500/15 border-indigo-400/40'
          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{c.name}</span>
        {classifyCompound(c).key === 'ionic' ? (
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Atom className={`w-3.5 h-3.5 shrink-0 ${classifyCompound(c).key === 'covalent_polar' ? 'text-sky-400' : 'text-violet-400'}`} />
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-xs font-mono text-white/70">{c.formula}</span>
        <span className={`text-[10px] uppercase tracking-wide ${
          classifyCompound(c).key === 'ionic'
            ? 'text-amber-400/70'
            : classifyCompound(c).key === 'covalent_polar'
            ? 'text-sky-400/70'
            : 'text-violet-400/70'
        }`}>
          {classifyCompound(c).label}
        </span>
      </div>
    </button>
  );

  const selectedElementObj = ALL_ELEMENTS.find((e) => e.symbol === selectedElement) || ALL_ELEMENTS[0];
  const elementNeutrons = selectedElementObj.mass - selectedElementObj.z;
  const elMeta = getElementMeta(selectedElementObj.z);

  const atomBreakdown = activeCompound
    ? activeCompound.atoms.reduce((acc, a) => {
        acc[a.element] = (acc[a.element] || 0) + 1;
        return acc;
      }, {})
    : {};

  const bondOrderCounts = activeCompound && activeCompound.bonds
    ? inferBondOrders(activeCompound.atoms, activeCompound.bonds).reduce((acc, o) => {
        acc[o] = (acc[o] || 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <div className="h-screen overflow-hidden bg-[#0a0c12] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-1 uppercase">
            <span>IC</span>
            <IcorLogoBohr size={36} />
            <span>R3D</span>
          </h1>
          <span className="hidden sm:block text-xs text-white/50 border-l border-white/10 pl-3">Enlaces iónicos y covalentes · Impresión modular</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setView('inicio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'inicio' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Inicio
            </button>
            <button
              onClick={() => setView('elementos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'elementos' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              Elementos
            </button>
            <button
              onClick={() => setView('imprimir')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'imprimir' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>
          <span className="text-xs text-white/40 hidden sm:block">{compounds.length} compuestos</span>
        </div>
      </header>

      <div ref={stageRef} className="flex-1 flex min-h-0 relative bg-[#0a0c12]">
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {view === 'elementos' ? (
          isFullscreen ? (
            elemMode === 'combinar' ? (
              <BondLab3D fullscreen />
            ) : elemMode === 'transiciones' ? (
              <TransitionLab3D fullscreen />
            ) : (
            <div className="flex-1 min-h-0 relative">
              <BohrAtom3D data={selectedElementObj} />
              <div className="absolute top-3 left-3 z-30 pointer-events-none">
                <h2 className="text-xl font-semibold flex items-center gap-2 drop-shadow-lg">
                  {selectedElementObj.name}
                  <span className="text-base font-mono text-indigo-300">{selectedElementObj.symbol}</span>
                </h2>
                <p className="text-xs text-white/60 drop-shadow">Modelo de Bohr · nº atómico {selectedElementObj.z}</p>
              </div>
              <div className="absolute bottom-3 left-3 z-30 flex flex-wrap gap-2 pointer-events-none">
                {[
                  { label: 'Protones', value: selectedElementObj.z, cls: 'text-red-300' },
                  { label: 'Neutrones', value: elementNeutrons, cls: 'text-white/80' },
                  { label: 'Electrones', value: selectedElementObj.z, cls: 'text-blue-300' },
                  { label: 'Masa', value: selectedElementObj.mass, cls: 'text-white/80' },
                  { label: 'Grupo', value: elMeta.group ?? '—', cls: 'text-indigo-300' },
                  { label: 'Período', value: elMeta.period ?? '—', cls: 'text-indigo-300' },
                  { label: 'Valencia', value: `${elMeta.valence} e⁻`, cls: 'text-emerald-300' },
                ].map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-sm">
                    <span className="text-white/50">{b.label}</span>
                    <span className={`font-mono ${b.cls}`}>{b.value}</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-sm">
                  <span className="text-white/50">Categoría</span>
                  <span className="text-white/80">{elMeta.category}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-sm">
                  <span className="text-white/50">Electroneg.</span>
                  <span className="font-mono text-fuchsia-300">{electronegativity(selectedElementObj.z) ?? '—'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-sm">
                  <span className="text-white/50">C. metálico</span>
                  <span className="text-white/80">{metallicCharacter(elMeta.category)}</span>
                </span>
              </div>
            </div>
            )
          ) : (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h2 className="text-xl font-semibold">Estructura atómica de los elementos</h2>
                <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                  <button
                    onClick={() => setElemMode('explorar')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${elemMode === 'explorar' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                  >
                    Explorar
                  </button>
                  <button
                    onClick={() => setElemMode('combinar')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${elemMode === 'combinar' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                  >
                    Combinar
                  </button>
                  <button
                    onClick={() => setElemMode('transiciones')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${elemMode === 'transiciones' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                  >
                    Transiciones
                  </button>
                </div>
              </div>
              <p className="text-sm text-white/50 mb-4">
                {elemMode === 'explorar'
                  ? 'Explora el modelo de Bohr de los 118 elementos.'
                  : elemMode === 'combinar'
                  ? 'Combina elementos y observa el enlace y la atracción magnética por electronegatividad en 3D.'
                  : 'Elige dos elementos y observa sus electrones en tránsito (antes y después del enlace).'}
              </p>
              {elemMode === 'explorar' ? (
                <div className="max-w-3xl">
                  <ElementBohrExplorer selectedSymbol={selectedElement} onSelectSymbol={selectElement} />
                </div>
              ) : elemMode === 'combinar' ? (
                <BondLab3D />
              ) : (
                <TransitionLab3D />
              )}
            </div>
          )
        ) : view === 'imprimir' ? (
        <div className="flex-1 min-h-[400px] relative">
          {activeCompound ? (
            <StlMoleculeBuilder compound={activeCompound} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Printer className="w-10 h-10 text-white/40" />
              <p className="text-white/50 text-sm">Selecciona un compuesto en Inicio para imprimir.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          {activeCompound ? (
            <div className="absolute inset-0">
              <Molecule3DViewer compound={activeCompound} showLonePairs={false} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
              <FlaskConical className="w-10 h-10 text-white/40" />
              <p className="text-white/50 text-sm max-w-xs">
                Abre la <span className="text-indigo-300">Biblioteca</span> y selecciona un compuesto para verlo en 3D.
              </p>
            </div>
          )}

          {/* Resumen flotante compacto del compuesto activo */}
          {activeCompound && (() => {
            const cls = classifyCompound(activeCompound);
            const styles = cls.key === 'ionic'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : cls.key === 'covalent_polar'
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              : 'bg-violet-500/15 text-violet-300 border-violet-500/30';
            const Icon = cls.key === 'ionic' ? Zap : Atom;
            return (
              <div className="absolute top-3 left-3 z-20 pointer-events-none max-w-[70%]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold leading-tight drop-shadow-lg">{activeCompound.name}</h2>
                  <span className="text-sm font-mono text-indigo-300">{activeCompound.formula}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles}`}>
                    <Icon className="w-3 h-3" /> {cls.label}
                  </span>
                </div>
                {generated && <span className="block text-[10px] text-fuchsia-300/70 mt-0.5">Generado · no guardado</span>}
              </div>
            );
          })()}

          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-30 p-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Pestaña Biblioteca: sale desplegándose de arriba a la derecha */}
          {!showSearch && (
            <button
              onClick={() => setShowSearch(true)}
              className="absolute top-3 right-14 z-40 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/70 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Abrir biblioteca"
            >
              <Library className="w-4 h-4" />
              <span>Biblioteca</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="absolute bottom-3 left-3 pointer-events-none flex flex-col gap-1">
            <span className="text-[10px] text-white/30 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm">
              Arrastra para rotar · Pellizca o rueda para zoom
            </span>
          </div>
        </div>
      )}
        </div>

        {view === 'elementos' && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-40 p-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        {view === 'imprimir' && (
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-3 right-3 z-40 p-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}

        {view === 'elementos' && isFullscreen && (
          <button
            onClick={() => setShowSearch((s) => !s)}
            className={`absolute top-1/2 -translate-y-1/2 z-40 px-1.5 py-4 rounded-l-lg bg-black/50 backdrop-blur-sm border border-white/10 border-r-0 text-white/70 hover:text-white transition-all ${showSearch ? 'right-80' : 'right-0'}`}
            title={showSearch ? 'Cerrar panel' : 'Abrir panel'}
          >
            {showSearch ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {showSearch && (view === 'inicio' || (view === 'elementos' && isFullscreen)) && (
          <>
            {view === 'elementos' && <div className="absolute inset-0 z-20" onClick={() => setShowSearch(false)} />}
            <div className="absolute top-0 right-0 w-80 max-h-[85%] z-30 bg-[#0d0f15]/95 backdrop-blur-md border-l border-white/10 flex flex-col animate-slide-down">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  {view === 'inicio' ? 'Biblioteca' : 'Buscar elemento'}
                </span>
                <button onClick={() => setShowSearch(false)} className="text-white/40 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {view === 'inicio' ? (
                  <>
                    <button
                      onClick={() => {
                        setShowAdd(true);
                        setShowSearch(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20 border border-indigo-400/30 text-sm font-medium text-indigo-200 hover:from-indigo-500/30 hover:to-fuchsia-500/30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Añadir compuesto
                    </button>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nombre o fórmula..."
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
                    />
                    <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'ionic', label: 'Iónicos' },
                        { id: 'covalent_polar', label: 'Polares' },
                        { id: 'covalent_apolar', label: 'Apolares' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            filter === f.id ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {filtered.map(renderCompoundCard)}
                      {filtered.length === 0 && (
                        <p className="text-center text-sm text-white/40 py-6">Sin resultados</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-white/40">Más comunes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_ELEMENTS.map((sym) => {
                        const el = ALL_ELEMENTS.find((e) => e.symbol === sym);
                        return (
                          <button
                            key={sym}
                            onClick={() => selectElement(sym)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                              selectedElement === sym
                                ? 'bg-indigo-500/25 text-white'
                                : 'bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                            title={el?.name}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={elementSearch}
                      onChange={(e) => setElementSearch(e.target.value)}
                      placeholder="Símbolo, nombre o nº"
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
                    />
                    <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                      {elementResults.map((el) => (
                        <button
                          key={el.symbol}
                          onClick={() => {
                            selectElement(el.symbol);
                            setShowSearch(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex justify-between items-center transition-colors ${
                            selectedElement === el.symbol
                              ? 'bg-indigo-500/20 border border-indigo-400/40'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <span>{el.symbol} · {el.name}</span>
                          <span className="text-white/40 text-xs font-mono">{el.z}</span>
                        </button>
                      ))}
                      {elementSearch && elementResults.length === 0 && (
                        <p className="text-xs text-white/40 text-center py-2">Sin resultados</p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/40 mb-2">Usados recientemente</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentElements.length === 0 ? (
                          <p className="text-xs text-white/30">Aún no hay</p>
                        ) : (
                          recentElements.map((sym) => (
                            <button
                              key={sym}
                              onClick={() => selectElement(sym)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                                selectedElement === sym
                                  ? 'bg-indigo-500/25 text-white'
                                  : 'bg-white/5 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              {sym}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      {/* Modal: añadir compuesto desde PubChem */}
      {showAdd && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !generating && setShowAdd(false)}
        >
          <div
            className="bg-[#0d0f15] border border-white/10 rounded-xl p-5 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-fuchsia-400" />
                Añadir compuesto
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                disabled={generating}
                className="text-white/40 hover:text-white disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-white/50 mb-3">
              Escribe una fórmula química y se formará su estructura 3D.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (formula.trim()) handleGenerate(formula.trim());
              }}
              className="flex gap-2 mb-3"
            >
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="Ej: CH4, H2O, NaCl..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 font-mono text-sm placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/50 disabled:opacity-50"
                disabled={generating}
                autoFocus
              />
              <Button
                type="submit"
                disabled={generating || !formula.trim()}
                className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:opacity-90 text-white border-0"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                Generar
              </Button>
            </form>
            {genError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{genError}</span>
              </div>
            )}
            <div>
              <p className="text-xs text-white/40 mb-2">Prueba con:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setFormula(ex)}
                    disabled={generating}
                    className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}