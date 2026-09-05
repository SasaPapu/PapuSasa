import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { electronegativity, analyzeBond } from '@/lib/elements';
import PeriodicTableMini, { CategoryLegend } from '@/components/PeriodicTableMini';
import Bond3DViewer from '@/components/Bond3DViewer';
import { Magnet, Hand, Trash2, Search, X, Atom, Maximize2, Minimize2 } from 'lucide-react';
import PauseButton from '@/components/PauseButton';

// Laboratorio magnético 3D basado en electronegatividad.
// Cada átomo tiene una "fuerza magnética" igual a su electronegatividad de Pauling
// (el flúor, EN ≈ 3.98, es la mayor). El átomo más electronegativo atrae al menos
// electronegativo con una fuerza proporcional a la diferencia ΔEN = |EN_a - EN_b|
// (resta). Así, un enlace iónico (ΔEN ≈ 1.7) ejerce la mayor fuerza de atracción.
// - Modo automático: la física mueve los átomos según esa atracción direccional.
// - Modo manual: arrastra los átomos (multitáctil = multiselección).

const ATOM_COLORS = {
  H: '#f0f0f0', O: '#ff4d4d', C: '#444444', N: '#3b5bfd', Cl: '#22cc22', Na: '#ab5cf2',
  K: '#8f40d4', Ca: '#4a4a4a', Mg: '#7fff3d', Li: '#cc80ff', F: '#90e050', Br: '#a6401f', S: '#ffd900',
};
const colorFor = (z) => {
  const el = ALL_ELEMENTS.find((e) => e.z === z);
  return (el && ATOM_COLORS[el.symbol]) || '#6b7280';
};
// Intensidad de brillo (fuerza magnética visual) normalizada por el flúor (EN máx ≈ 3.98).
const MAX_EN = 3.98;
const glowFor = (en) => (en == null ? 0 : Math.min(1, en / MAX_EN));

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 6;
  ctx.strokeText(text, 64, 32);
  ctx.fillStyle = '#fff'; ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(0.9, 0.45, 1);
  return spr;
}

// Almacenamiento compartido a nivel de módulo: los átomos persisten aunque el
// componente se desmonte y se vuelva a montar (pantalla completa, cambiar entre
// Explorar/Combinar, abrir la tabla). Así no se pierden los elementos añadidos.
const labAtoms = [];
let labNextId = 0;
// El estado de pausa persiste aunque el componente se remonte al entrar/salir
// de pantalla completa, así el botón mantiene la misma función en ambos modos.
let labPaused = false;

export default function BondLab3D({ fullscreen = false }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshMapRef = useRef(new Map());
  const atomsRef = useRef(labAtoms);
  const bondGroupRef = useRef(null);
  const pointersRef = useRef(new Map());
  const selectedRef = useRef(new Set());

  const [atoms, setAtoms] = useState(() => labAtoms.map((a) => ({ id: a.id, symbol: a.symbol, z: a.z, en: a.en })));
  const [mode, setMode] = useState('auto');
  const modeRef = useRef('auto');
  const [tableQuery, setTableQuery] = useState('');
  const [tableExpanded, setTableExpanded] = useState(false);
  const [paused, setPaused] = useState(labPaused);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; labPaused = paused; }, [paused]);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const syncList = () => setAtoms(atomsRef.current.map((a) => ({ id: a.id, symbol: a.symbol, z: a.z, en: a.en })));

  const addAtom = useCallback((symbol) => {
    const el = ALL_ELEMENTS.find((e) => e.symbol === symbol);
    if (!el) return;
    const id = ++labNextId;
    const ang = Math.random() * Math.PI * 2;
    const rr = 1 + Math.random() * 2;
    const pos = new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr, (Math.random() - 0.5) * 3);
    const en = electronegativity(el.z);
    atomsRef.current.push({ id, symbol: el.symbol, z: el.z, en, pos, vel: new THREE.Vector3(), force: new THREE.Vector3() });
    syncList();
  }, []);

  const removeAtom = useCallback((id) => {
    const m = meshMapRef.current.get(id);
    if (m) { sceneRef.current.remove(m.mesh); sceneRef.current.remove(m.label); m.mesh.geometry.dispose(); m.mesh.material.dispose(); meshMapRef.current.delete(id); }
    const i = atomsRef.current.findIndex((a) => a.id === id);
    if (i >= 0) atomsRef.current.splice(i, 1);
    selectedRef.current.delete(id);
    syncList();
  }, []);

  const clearAll = useCallback(() => {
    atomsRef.current.forEach((a) => {
      const m = meshMapRef.current.get(a.id);
      if (m) { sceneRef.current.remove(m.mesh); sceneRef.current.remove(m.label); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }
    });
    meshMapRef.current.clear(); atomsRef.current.length = 0; selectedRef.current.clear(); syncList();
  }, []);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const width = mount.clientWidth || 600; const height = mount.clientHeight || 400;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.6); light.position.set(6, 8, 10); scene.add(light);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000); camera.position.set(0, 0, 17);
    const FIELD_R = 6.5;  // campo esférico invisible que contiene a los átomos (dentro del encuadre)
    let zoomZ = 17;      // zoom de la cámara (rueda / pellizco)
    let prevPinch = null;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.3)); renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);
    sceneRef.current = scene; cameraRef.current = camera; rendererRef.current = renderer;

    const raycaster = new THREE.Raycaster();
    const pv = new THREE.Vector2();
    const plane = new THREE.Plane();
    const tmp = new THREE.Vector3();

    const worldPoint = (cx, cy) => {
      const r = renderer.domElement.getBoundingClientRect();
      pv.x = ((cx - r.left) / r.width) * 2 - 1; pv.y = -((cy - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pv, camera);
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      plane.setFromNormalAndCoplanarPoint(d.clone().negate(), new THREE.Vector3());
      raycaster.ray.intersectPlane(plane, tmp); return tmp.clone();
    };
    const pick = (cx, cy) => {
      const r = renderer.domElement.getBoundingClientRect();
      pv.x = ((cx - r.left) / r.width) * 2 - 1;
      pv.y = -((cy - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pv, camera);
      // 1) Raycast preciso: agarra la esfera que realmente tocas en pantalla
      //    (la frontal). Así, cuando están unidos, agarras el átomo que tocas
      //    y puedes jalar el satélite aunque quede cerca del ancla.
      const meshes = [];
      meshMapRef.current.forEach((m) => meshes.push(m.mesh));
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const obj = hits[0].object;
        for (const m of meshMapRef.current.values()) {
          if (m.mesh === obj) return m.atom;
        }
      }
      // 2) Fallback: átomo cuyo centro proyectado esté más cerca del puntero.
      let best = null, bestD = 0.15;
      meshMapRef.current.forEach((m) => {
        const v = m.mesh.position.clone().project(camera);
        const d = Math.hypot(v.x - pv.x, v.y - pv.y);
        if (d < bestD) { bestD = d; best = m.atom; }
      });
      return best;
    };

    let panX = 0, panY = 0;   // desplazamiento de la cámara (pan)
    const onDown = (e) => {
      renderer.domElement.setPointerCapture?.(e.pointerId);
      // En automático la física mueve los átomos: solo se permite desplazar la vista.
      if (modeRef.current === 'auto') {
        pointersRef.current.set(e.pointerId, { mode: 'orbit', lastX: e.clientX, lastY: e.clientY, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      const hit = pick(e.clientX, e.clientY);
      if (hit) {
        if (!e.shiftKey && pointersRef.current.size === 0) selectedRef.current.clear();
        selectedRef.current.add(hit.id);
        const w = worldPoint(e.clientX, e.clientY);
        pointersRef.current.set(e.pointerId, { mode: 'atom', atomId: hit.id, last: w, clientX: e.clientX, clientY: e.clientY });
      } else {
        pointersRef.current.set(e.pointerId, { mode: 'orbit', lastX: e.clientX, lastY: e.clientY, clientX: e.clientX, clientY: e.clientY });
      }
    };
    const onMove = (e) => {
      const p = pointersRef.current.get(e.pointerId); if (!p) return;
      p.clientX = e.clientX; p.clientY = e.clientY;
      if (p.mode === 'atom') {
        const w = worldPoint(e.clientX, e.clientY);
        const delta = w.clone().sub(p.last);
        // Cada dedo mueve SOLO el átomo que agarró, de forma independiente.
        const a = atomsRef.current.find((x) => x.id === p.atomId);
        if (a) { a.pos.add(delta); a.vel.set(0, 0, 0); }
        p.last = w;
      } else {
        // Desplazar la vista (pan): mueve la cámara en el plano XY.
        const dx = e.clientX - p.lastX;
        const dy = e.clientY - p.lastY;
        const k = zoomZ * 0.0016;
        panX -= dx * k;
        panY += dy * k;
        p.lastX = e.clientX; p.lastY = e.clientY;
      }
      // Zoom por pellizco solo con dos dedos en espacio vacío (modo orbit).
      if (pointersRef.current.size === 2) {
        const vals = [...pointersRef.current.values()];
        if (vals.every((v) => v.mode === 'orbit')) {
          const dist = Math.hypot(vals[0].clientX - vals[1].clientX, vals[0].clientY - vals[1].clientY);
          if (prevPinch != null) {
            zoomZ *= 1 + (prevPinch - dist) * 0.006;
            zoomZ = Math.max(7, Math.min(36, zoomZ));
          }
          prevPinch = dist;
        }
      } else {
        prevPinch = null;
      }
    };
    const onUp = (e) => { pointersRef.current.delete(e.pointerId); if (pointersRef.current.size < 2) prevPinch = null; };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    const onWheel = (e) => { e.preventDefault(); zoomZ *= 1 + e.deltaY * 0.001; zoomZ = Math.max(7, Math.min(36, zoomZ)); };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!visible) return;
      const arr = atomsRef.current;
      // --- Atracción coulomb ∝ ΔEN/r en campo 3D esférico (ambos modos) ---
      // El más electronegativo atrae al menos electronegativo. Al chocar se tocan
      // completos. La física corre siempre; la diferencia entre modos es solo si
      // el usuario puede arrastrar (manual sí, automático no). El átomo agarrado
      // no recibe física → sigue el dedo; al soltarlo recupera sus propiedades.
      if (pausedRef.current) {
        // Pausa: congelar átomos y aplanar a 2D (z → 0) para vista frontal.
        arr.forEach((a) => { a.pos.z += (0 - a.pos.z) * 0.2; a.vel.set(0, 0, 0); });
      } else if (arr.length >= 2) {
        const kAttr = 0.4;     // fuerza de atracción (un poco menor)
        const MIN_DIST = 1.1;  // suma de radios → choque completo (se tocan)
        const sun = arr.reduce((s, a) => ((a.en ?? 0) > (s.en ?? 0) ? a : s), arr[0]);
        const dragged = new Set();
        pointersRef.current.forEach((p) => { if (p.mode === 'atom') dragged.add(p.atomId); });
        arr.forEach((a) => a.force.set(0, 0, 0));
        arr.forEach((a) => {
          if (a === sun) return;
          const d = sun.pos.clone().sub(a.pos);
          let r = d.length(); if (r < 0.5) r = 0.5;   // evita singularidad
          const dir = d.divideScalar(r);
          const dEN = (sun.en ?? 0) - (a.en ?? 0);
          // Atracción ∝ ΔEN / r^1.5 (entre 1/r y 1/r²): jala pero sin exceso.
          a.force.add(dir.clone().multiplyScalar((kAttr * dEN) / Math.pow(r, 1.5)));
        });
        arr.forEach((a) => {
          const held = dragged.has(a.id);
          if (held) {
            // Mientras se arrastra pierde sus propiedades: sin física ni choque.
            a.vel.set(0, 0, 0);
          } else {
            a.vel.add(a.force);
            a.vel.multiplyScalar(0.85);
            a.pos.add(a.vel);
          }
          // Choque completo con el más electronegativo (solo si no se arrastra):
          // al soltarlo recupera sus propiedades y se asienta tocando al ancla.
          if (a !== sun && !held) {
            const sd = a.pos.distanceTo(sun.pos);
            if (sd < MIN_DIST && sd > 0.001) {
              const n = a.pos.clone().sub(sun.pos).multiplyScalar(1 / sd);
              a.pos.copy(sun.pos).add(n.multiplyScalar(MIN_DIST));
              // Choque pegajoso: al unirse se asientan (no orbita ni rebota).
              a.vel.set(0, 0, 0);
            }
          }
          // Campo esférico invisible: no salir del radio
          const pr = a.pos.length();
          if (pr > FIELD_R) {
            a.pos.multiplyScalar(FIELD_R / pr);
            const n = a.pos.clone().normalize();
            const vOut = a.vel.dot(n);
            if (vOut > 0) a.vel.sub(n.clone().multiplyScalar(vOut * 1.3));
          }
        });
      }
      // Sincronizar meshes (brillo ∝ electronegatividad = fuerza magnética)
      arr.forEach((atom) => {
        let entry = meshMapRef.current.get(atom.id);
        if (!entry) {
          const g = glowFor(atom.en);
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 16, 16),
            new THREE.MeshPhongMaterial({ color: new THREE.Color(colorFor(atom.z)), shininess: 70, emissive: new THREE.Color(colorFor(atom.z)), emissiveIntensity: g * 0.55 })
          );
          const label = makeLabel(atom.symbol);
          scene.add(mesh); scene.add(label);
          entry = { mesh, label, atom }; meshMapRef.current.set(atom.id, entry);
        }
        entry.mesh.position.copy(atom.pos);
        entry.label.position.copy(atom.pos);
        const sel = selectedRef.current.has(atom.id);
        const held = [...pointersRef.current.values()].some((p) => p.mode === 'atom' && p.atomId === atom.id);
        // Solo actualiza el brillo cuando el estado cambia (evita uploads GPU cada frame).
        const stateKey = held ? 'held' : sel ? 'sel' : 'glow' + atom.en;
        if (entry.mesh.userData._emState !== stateKey) {
          entry.mesh.userData._emState = stateKey;
          if (held) {
            entry.mesh.material.emissive.setHex(0x000000);
            entry.mesh.material.emissiveIntensity = 0;
          } else if (sel) {
            entry.mesh.material.emissive.setHex(0x3366ff);
            entry.mesh.material.emissiveIntensity = 0.6;
          } else {
            entry.mesh.material.emissive.setHex(new THREE.Color(colorFor(atom.z)).getHex());
            entry.mesh.material.emissiveIntensity = glowFor(atom.en) * 0.55;
          }
        }
      });
      for (const [id, entry] of meshMapRef.current) {
        if (!arr.find((a) => a.id === id)) { scene.remove(entry.mesh); scene.remove(entry.label); entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); meshMapRef.current.delete(id); }
      }
      // Sin cilindro de unión: la unión se muestra solo como atracción magnética.
      if (bondGroupRef.current) {
        scene.remove(bondGroupRef.current);
        bondGroupRef.current.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        bondGroupRef.current = null;
      }
      camera.position.set(panX, panY, zoomZ);
      camera.lookAt(panX, panY, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => { const w = mount.clientWidth, h = mount.clientHeight; if (w > 0 && h > 0) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); } };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      meshMapRef.current.forEach((e) => { e.mesh.geometry.dispose(); e.mesh.material.dispose(); }); meshMapRef.current.clear();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement); renderer.dispose();
    };
  }, []);

  const pair = atoms.length === 2 ? analyzeBond({ symbol: atoms[0].symbol, z: atoms[0].z }, { symbol: atoms[1].symbol, z: atoms[1].z }) : null;

  // Resultados de la barra de búsqueda de la tabla periódica inferior.
  const tableResults = tableQuery.trim()
    ? ALL_ELEMENTS.filter((el) => {
        const q = tableQuery.toLowerCase().trim();
        return el.symbol.toLowerCase().includes(q) || el.name.toLowerCase().includes(q) || String(el.z) === q;
      })
    : [];

  // Barra de fuerza magnética relativa al flúor (EN máxima).
  const maxBarEn = MAX_EN;

  return (
    <div className={fullscreen ? 'flex flex-col h-full w-full bg-[#0a0c12]' : 'flex flex-col gap-2 h-[680px]'}>
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
        <button onClick={clearAll} disabled={atoms.length === 0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/25 disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>

      <div className="px-1"><div className="rounded-lg border border-white/10 bg-white/[0.03] p-2"><CategoryLegend /></div></div>

      {/* Fila: visor 3D (centro) + tabla periódica (derecha) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
        {/* Visor 3D central: los átomos se generan en el centro y quedan contenidos */}
        <div className="relative flex-1 min-h-0 rounded-lg border border-white/10 overflow-hidden bg-black/30">
          <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />
          <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
          <div className="absolute top-2 left-2 pointer-events-none max-w-[70%]">
            <p className="text-[11px] text-white/60 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
              {mode === 'auto' ? 'El más electronegativo atrae al menos electronegativo. (La física los mueve; en este modo no se pueden arrastrar).' : 'Arrastra los átomos: cada dedo mueve uno de forma independiente.'}
            </p>
          </div>

          {/* Lista de átomos flotante arriba a la derecha */}
          {atoms.length > 0 && (
            <div className="absolute top-2 right-2 w-44 max-h-[85%] overflow-y-auto rounded-lg border border-white/10 bg-black/55 backdrop-blur-md p-2 z-10">
              <p className="text-[10px] text-white/50 mb-1.5 flex items-center gap-1">
                <Magnet className="w-3 h-3 text-fuchsia-300" /> Átomos ({atoms.length}) · EN
              </p>
              <div className="space-y-1">
                {[...atoms].sort((a, b) => (b.en ?? 0) - (a.en ?? 0)).map((a) => {
                  const en = a.en;
                  const g = glowFor(en);
                  const sel = selectedRef.current.has(a.id);
                  return (
                    <div key={a.id} className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md border ${sel ? 'border-indigo-400/50 bg-indigo-500/15' : 'border-white/10 bg-white/5'}`}>
                      <span className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: colorFor(a.z), boxShadow: en != null ? `0 0 ${4 + g * 8}px ${colorFor(a.z)}` : 'none' }} />
                      <span className="text-xs font-mono shrink-0">{a.symbol}</span>
                      <span className="text-[9px] font-mono text-fuchsia-300 shrink-0">{en != null ? en.toFixed(2) : '—'}</span>
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${(en != null ? en / maxBarEn : 0) * 100}%` }} />
                      </div>
                      <button onClick={() => removeAtom(a.id)} className="text-white/40 hover:text-red-300 shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visor de unión de electrones abajo a la izquierda */}
          {pair && (
            <div className="absolute bottom-2 left-2 w-52 rounded-lg border border-white/10 bg-black/55 backdrop-blur-md p-2 z-10 space-y-1">
              <p className="text-[10px] text-white/50 flex items-center gap-1"><Atom className="w-3 h-3" /> Unión de electrones</p>
              <div className="h-36 rounded bg-black/30 border border-white/10 overflow-hidden">
                <Bond3DViewer
                  elemA={{ z: atoms[0].z, symbol: atoms[0].symbol }}
                  elemB={{ z: atoms[1].z, symbol: atoms[1].symbol }}
                  bondType={pair.type}
                  transferCount={pair.transferCount || 0}
                  sharedCount={(pair.sharedPairs || 0) * 2}
                />
              </div>
            </div>
          )}

          {atoms.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-white/40 text-sm text-center">Toca un elemento en la tabla de la derecha para añadirlo.</p>
            </div>
          )}
        </div>

        {/* Tabla periódica a la derecha con barra de búsqueda */}
        <div className={`shrink-0 w-full ${tableExpanded ? 'lg:w-[640px]' : 'lg:w-96'} rounded-lg border border-white/10 bg-white/[0.03] p-2.5 flex flex-col min-h-0 transition-all`}>
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-indigo-400 shrink-0" />
            <input
              type="text"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Buscar elemento..."
              className="flex-1 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50"
            />
            <button onClick={() => setTableExpanded((v) => !v)} className="p-1.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 shrink-0" title={tableExpanded ? 'Contraer tabla' : 'Expandir tabla'}>
              {tableExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          {tableQuery.trim() && (
            <div className="mb-2 max-h-28 overflow-y-auto rounded-md bg-[#0d0f15] border border-white/10 p-1.5 flex flex-wrap gap-1">
              {tableResults.length > 0 ? tableResults.slice(0, 40).map((el) => (
                <button key={el.symbol} onClick={() => addAtom(el.symbol)} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono hover:bg-white/10">
                  {el.symbol} <span className="text-white/40">{el.z}</span>
                </button>
              )) : <p className="text-xs text-white/40 px-1">Sin resultados</p>}
            </div>
          )}
          <PeriodicTableMini onSelectSymbol={addAtom} compact />
        </div>
      </div>
    </div>
  );
}