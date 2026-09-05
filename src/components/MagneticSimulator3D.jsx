import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { electronegativity } from '@/lib/elements';
import PeriodicTableMini from '@/components/PeriodicTableMini';
import { Magnet, Hand, Trash2, Plus, X, Zap } from 'lucide-react';

// Simulador 3D magnético basado en electronegatividad.
// Modo manual: arrastra átomos (multitáctil = multiselección).
// Modo automático: el de mayor electronegatividad queda en el centro y atrae a los demás;
// el de menor atracción se sitúa en el punto máximo (más lejano).
const ATOM_COLORS = {
  H: '#f0f0f0', O: '#ff4d4d', C: '#444444', N: '#3b5bfd', Cl: '#22cc22', Na: '#ab5cf2',
  K: '#8f40d4', Ca: '#4a4a4a', Mg: '#7fff3d', Li: '#cc80ff', F: '#90e050', Br: '#a6401f', S: '#ffd900',
};

function colorFor(z) {
  const el = ALL_ELEMENTS.find((e) => e.z === z);
  return (el && ATOM_COLORS[el.symbol]) || '#6b7280';
}

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.0)';
  ctx.fillRect(0, 0, 128, 64);
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeText(text, 64, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.4, 0.7, 1);
  return spr;
}

let _id = 0;

export default function MagneticSimulator3D({ fullscreen = false }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshMapRef = useRef(new Map()); // id -> { mesh, label, atom }
  const atomsRef = useRef([]); // [{ id, symbol, z, pos: Vector3, vel: Vector3 }]
  const targetsRef = useRef(new Map()); // id -> Vector3 (modo automático)
  const lineGroupRef = useRef(null);
  const pointersRef = useRef(new Map()); // pointerId -> { mode:'atom'|'orbit', atomId, last }
  const selectedRef = useRef(new Set());

  const [atoms, setAtoms] = useState([]);
  const [mode, setMode] = useState('auto');
  const modeRef = useRef('auto');
  const [pickerSymbol, setPickerSymbol] = useState('H');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { modeRef.current = mode; recomputeTargets(); }, [mode]);

  const addAtom = useCallback((symbol) => {
    const el = ALL_ELEMENTS.find((e) => e.symbol === symbol);
    if (!el) return;
    const id = ++_id;
    const pos = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, 0);
    const atom = { id, symbol: el.symbol, z: el.z, pos, vel: new THREE.Vector3() };
    atomsRef.current.push(atom);
    setAtoms(atomsRef.current.map((a) => ({ id: a.id, symbol: a.symbol, z: a.z })));
    recomputeTargets();
  }, []);

  const removeAtom = useCallback((id) => {
    atomsRef.current = atomsRef.current.filter((a) => a.id !== id);
    const m = meshMapRef.current.get(id);
    if (m) {
      sceneRef.current.remove(m.mesh);
      sceneRef.current.remove(m.label);
      m.mesh.geometry.dispose(); m.mesh.material.dispose();
      meshMapRef.current.delete(id);
    }
    selectedRef.current.delete(id);
    setSelectedIds([...selectedRef.current]);
    setAtoms(atomsRef.current.map((a) => ({ id: a.id, symbol: a.symbol, z: a.z })));
    recomputeTargets();
  }, []);

  const clearAll = useCallback(() => {
    atomsRef.current.forEach((a) => {
      const m = meshMapRef.current.get(a.id);
      if (m) { sceneRef.current.remove(m.mesh); sceneRef.current.remove(m.label); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }
    });
    meshMapRef.current.clear();
    atomsRef.current = [];
    selectedRef.current.clear();
    setSelectedIds([]);
    setAtoms([]);
    if (lineGroupRef.current) { sceneRef.current.remove(lineGroupRef.current); lineGroupRef.current = null; }
  }, []);

  // Recalcula posiciones objetivo para el modo automático (mayor EN al centro)
  const recomputeTargets = useCallback(() => {
    const map = new Map();
    const sorted = [...atomsRef.current].sort((a, b) => (electronegativity(b.z) || 0) - (electronegativity(a.z) || 0));
    const n = sorted.length;
    sorted.forEach((at, i) => {
      const r = n <= 1 ? 0 : 5.5 * (i / (n - 1)); // 0 (centro) .. 5.5 (borde)
      const ang = n <= 1 ? 0 : (i / n) * Math.PI * 2;
      map.set(at.id, new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, 0));
    });
    targetsRef.current = map;
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(6, 8, 10);
    scene.add(light);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);
    sceneRef.current = scene;
    rendererRef.current = renderer;

    const raycaster = new THREE.Raycaster();
    const pointerVec = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const tmpPoint = new THREE.Vector3();

    const getWorldPoint = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVec, camera);
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      dragPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(), new THREE.Vector3(0, 0, 0));
      raycaster.ray.intersectPlane(dragPlane, tmpPoint);
      return tmpPoint.clone();
    };

    const pickAtom = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVec, camera);
      const meshes = [...meshMapRef.current.values()].map((m) => m.mesh);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const entry = [...meshMapRef.current.values()].find((m) => m.mesh === hitMesh);
        return entry ? entry.atom : null;
      }
      return null;
    };

    const onPointerDown = (e) => {
      renderer.domElement.setPointerCapture?.(e.pointerId);
      const hit = pickAtom(e.clientX, e.clientY);
      if (hit) {
        if (!e.shiftKey && pointersRef.current.size === 0) selectedRef.current.clear();
        selectedRef.current.add(hit.id);
        setSelectedIds([...selectedRef.current]);
        const world = getWorldPoint(e.clientX, e.clientY);
        pointersRef.current.set(e.pointerId, { mode: 'atom', atomId: hit.id, last: world });
      } else {
        pointersRef.current.set(e.pointerId, { mode: 'orbit', lastX: e.clientX, lastY: e.clientY });
      }
    };

    const onPointerMove = (e) => {
      const p = pointersRef.current.get(e.pointerId);
      if (!p) return;
      if (p.mode === 'atom') {
        const world = getWorldPoint(e.clientX, e.clientY);
        const delta = world.clone().sub(p.last);
        // Mover todos los seleccionados (multitáctil = multiselección)
        selectedRef.current.forEach((id) => {
          const atom = atomsRef.current.find((a) => a.id === id);
          if (atom) atom.pos.add(delta);
        });
        p.last = world;
        recomputeTargets();
      } else if (p.mode === 'orbit') {
        const dx = e.clientX - p.lastX;
        const dy = e.clientY - p.lastY;
        scene.rotation.y += dx * 0.01;
        scene.rotation.x += dy * 0.01;
        p.lastX = e.clientX;
        p.lastY = e.clientY;
      }
    };

    const onPointerUp = (e) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size === 0) {
        // mantener selección; se limpia al iniciar nuevo drag sin shift en fondo
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      // Sincronizar/crear meshes
      atomsRef.current.forEach((atom) => {
        let entry = meshMapRef.current.get(atom.id);
        if (!entry) {
          const geo = new THREE.SphereGeometry(0.55, 24, 24);
          const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(colorFor(atom.z)), shininess: 60 });
          const mesh = new THREE.Mesh(geo, mat);
          const label = makeLabelSprite(atom.symbol);
          scene.add(mesh); scene.add(label);
          entry = { mesh, label, atom };
          meshMapRef.current.set(atom.id, entry);
        }
        if (modeRef.current === 'auto') {
          const target = targetsRef.current.get(atom.id);
          if (target) {
            atom.pos.lerp(target, 0.06);
          }
        }
        entry.mesh.position.copy(atom.pos);
        entry.label.position.copy(atom.pos).add(new THREE.Vector3(0, 0.7, 0));
        const isSel = selectedRef.current.has(atom.id);
        entry.mesh.material.emissive.setHex(isSel ? 0x2244aa : 0x000000);
      });
      // Quitar meshes de átomos borrados
      for (const [id, entry] of meshMapRef.current) {
        if (!atomsRef.current.find((a) => a.id === id)) {
          scene.remove(entry.mesh); scene.remove(entry.label);
          entry.mesh.geometry.dispose(); entry.mesh.material.dispose();
          meshMapRef.current.delete(id);
        }
      }
      // Líneas de atracción (mayor EN -> menor EN)
      if (lineGroupRef.current) { scene.remove(lineGroupRef.current); lineGroupRef.current = null; }
      if (atomsRef.current.length > 1) {
        const lg = new THREE.Group();
        const sorted = [...atomsRef.current].sort((a, b) => (electronegativity(b.z) || 0) - (electronegativity(a.z) || 0));
        for (let i = 0; i < sorted.length - 1; i++) {
          const hi = sorted[i]; const lo = sorted[i + 1];
          const dEN = Math.abs((electronegativity(hi.z) || 0) - (electronegativity(lo.z) || 0));
          if (dEN <= 0) continue;
          const geo = new THREE.BufferGeometry().setFromPoints([hi.pos.clone(), lo.pos.clone()]);
          const mat = new THREE.LineBasicMaterial({ color: new THREE.Color().setHSL(0.6 - Math.min(dEN, 3) / 4, 0.8, 0.55), transparent: true, opacity: 0.5 + Math.min(dEN, 3) / 6 });
          lg.add(new THREE.Line(geo, mat));
        }
        scene.add(lg);
        lineGroupRef.current = lg;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth; const h = mount.clientHeight;
      if (w > 0 && h > 0) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      meshMapRef.current.forEach((entry) => { entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); });
      meshMapRef.current.clear();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedInfo = [...atoms].sort((a, b) => (electronegativity(b.z) || 0) - (electronegativity(a.z) || 0));
  const maxEnAtom = sortedInfo[0];
  const minEnAtom = sortedInfo[sortedInfo.length - 1];

  return (
    <div className={fullscreen ? 'flex flex-col h-full w-full bg-[#0a0c12]' : 'flex flex-col gap-3'}>
      {/* Controles superiores */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          <button onClick={() => setMode('auto')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'auto' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
            <Magnet className="w-3.5 h-3.5" /> Automático
          </button>
          <button onClick={() => setMode('manual')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'manual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
            <Hand className="w-3.5 h-3.5" /> Manual
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">{atoms.length} átomos · {selectedIds.length} sel.</span>
          <button onClick={clearAll} disabled={atoms.length === 0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/25 disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" /> Limpiar
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Visor 3D */}
        <div className={`relative rounded-lg border border-white/10 overflow-hidden bg-black/30 ${fullscreen ? 'flex-1 min-h-[300px]' : 'w-full h-80'}`}>
          <div ref={mountRef} className="w-full h-full" />
          <div className="absolute top-2 left-2 pointer-events-none">
            <p className="text-[11px] text-white/60 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
              {mode === 'auto'
                ? 'Mayor electronegatividad en el centro; atrae a los de menor EN.'
                : 'Arrastra los átomos · varios toques = multiselección'}
            </p>
          </div>
          {mode === 'auto' && maxEnAtom && (
            <div className="absolute bottom-2 left-2 pointer-events-none flex flex-col gap-0.5">
              <span className="text-[10px] bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-fuchsia-300">
                <Zap className="w-3 h-3 inline" /> Atractor: {maxEnAtom.symbol} (EN {electronegativity(maxEnAtom.z) ?? '—'})
              </span>
              {minEnAtom && minEnAtom.id !== maxEnAtom.id && (
                <span className="text-[10px] bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-sky-300">
                  Menor atracción: {minEnAtom.symbol} (EN {electronegativity(minEnAtom.z) ?? '—'}) → punto máximo
                </span>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral: tabla + añadir + lista */}
        <div className={`flex flex-col gap-3 ${fullscreen ? 'w-full lg:w-80' : 'w-full'}`}>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-white/50 mb-2 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Toca un elemento para añadirlo</p>
            <PeriodicTableMini selectedSymbol={pickerSymbol} onSelectSymbol={(s) => { setPickerSymbol(s); addAtom(s); }} compact />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex-1 overflow-y-auto">
            <p className="text-xs text-white/50 mb-2">Átomos en escena</p>
            {atoms.length === 0 ? (
              <p className="text-xs text-white/30">Añade elementos desde la tabla.</p>
            ) : (
              <div className="space-y-1.5">
                {atoms.map((a) => {
                  const en = electronegativity(a.z);
                  const sel = selectedIds.includes(a.id);
                  return (
                    <div key={a.id} className={`flex items-center justify-between px-2 py-1.5 rounded-md border ${sel ? 'border-indigo-400/50 bg-indigo-500/15' : 'border-white/10 bg-white/5'}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: colorFor(a.z) }} />
                        <span className="text-sm font-mono">{a.symbol}</span>
                        <span className="text-[10px] text-white/40">EN {en ?? '—'}</span>
                      </div>
                      <button onClick={() => removeAtom(a.id)} className="text-white/40 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}