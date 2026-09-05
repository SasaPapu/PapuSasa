import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { getElectronShells, ELEMENT_COLORS } from '@/lib/elements';
import { ArrowRightLeft, Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import PauseButton from '@/components/PauseButton';

// Representación 3D de dos átomos enlazando, en dos fases:
// - "antes": electrones en tránsito (iónico: viajan A→B; covalente: par compartido).
// - "después": configuración final. Iónico: el donante muestra la valencia reducida
//   y el receptor la aumentada (electrones ganados en verde), con etiquetas
//   "−N e⁻" / "+N e⁻". Covalente: el par compartido sigue entre ambos.
function makeTextSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5;
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color; ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(2.4, 0.6, 1);
  return spr;
}

// El estado de pausa persiste aunque el componente se remonte al entrar/salir
// de pantalla completa, así el botón mantiene la misma función en ambos modos.
let bondViewerPaused = false;

export default function Bond3DViewer({ elemA, elemB, bondType, transferCount = 0, sharedCount = 0 }) {
  const mountRef = useRef(null);
  const [phase, setPhase] = useState('antes');
  const [fullscreen, setFullscreen] = useState(false);
  const [paused, setPaused] = useState(bondViewerPaused);
  const pausedRef = useRef(false);
  const rafRef = useRef(null);
  const animateRef = useRef(null);
  useEffect(() => {
    pausedRef.current = paused;
    bondViewerPaused = paused;
    if (!paused && rafRef.current == null && animateRef.current) animateRef.current();
  }, [paused]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !elemA || !elemB) return;

    const width = mount.clientWidth || 400;
    const height = mount.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.3));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(8, 10, 12);
    scene.add(light);

    const root = new THREE.Group();
    scene.add(root);

    const nucleusR = 0.9;
    const shellGap = 1.4;
    const colorA = new THREE.Color(ELEMENT_COLORS[elemA.symbol] || '#7aa2ff');
    const colorB = new THREE.Color(ELEMENT_COLORS[elemB.symbol] || '#ff8fa3');

    // Capas según la fase (en "después" iónico: donante pierde, receptor gana).
    let shellsA = getElectronShells(elemA.z);
    let shellsB = getElectronShells(elemB.z);
    let gainedB = 0;
    if (phase === 'después' && bondType === 'ionic' && transferCount > 0) {
      shellsA = shellsA.slice();
      shellsB = shellsB.slice();
      shellsA[shellsA.length - 1] = Math.max(0, shellsA[shellsA.length - 1] - transferCount);
      shellsB[shellsB.length - 1] = shellsB[shellsB.length - 1] + transferCount;
      gainedB = transferCount;
    }

    function buildAtom(color, xOff, shells, gainedCount = 0, symbol = '') {
      const ag = new THREE.Group();
      ag.position.x = xOff;
      const nuc = new THREE.Mesh(
        new THREE.SphereGeometry(nucleusR, 16, 12),
        new THREE.MeshPhongMaterial({ color, emissive: color.clone().multiplyScalar(0.25), shininess: 40 })
      );
      ag.add(nuc);
      if (symbol) {
        const symLabel = makeTextSprite(symbol, '#ffffff');
        symLabel.scale.set(nucleusR * 1.5, nucleusR * 0.4, 1);
        ag.add(symLabel);
      }
      const shellGroups = [];
      shells.forEach((count, idx) => {
        const r = nucleusR + (idx + 1) * shellGap;
        const sg = new THREE.Group();
        sg.rotation.x = idx * 0.4;
        sg.rotation.y = idx * 0.25;
        const isValence = idx === shells.length - 1;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.045, 6, 32),
          new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: isValence ? 0.65 : 0.28 })
        );
        sg.add(ring);
        for (let i = 0; i < count; i++) {
          const ang = (i / Math.max(count, 1)) * Math.PI * 2;
          const gained = isValence && i >= count - gainedCount;
          const e = new THREE.Mesh(
            new THREE.SphereGeometry(isValence ? 0.2 : 0.14, 10, 10),
            new THREE.MeshPhongMaterial({ color: gained ? 0x39d353 : (isValence ? 0x66ccff : 0x4477bb), emissive: gained ? 0x0a4d18 : 0x113355 })
          );
          e.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0);
          sg.add(e);
        }
        ag.add(sg);
        shellGroups.push(sg);
      });
      root.add(ag);
      return { group: ag, shellGroups, outerR: nucleusR + shells.length * shellGap };
    }

    const atomA = buildAtom(colorA, -100, shellsA, 0, elemA.symbol);
    const atomB = buildAtom(colorB, 100, shellsB, gainedB, elemB.symbol);

    const sep = (atomA.outerR + atomB.outerR) * 0.55 + 0.4;
    atomA.group.position.x = -sep;
    atomB.group.position.x = sep;

    // Etiquetas de electrones perdidos/ganados (fase después, iónico)
    if (phase === 'después' && bondType === 'ionic' && transferCount > 0) {
      const lA = makeTextSprite(`−${transferCount} e⁻`, '#ff6b6b');
      lA.position.set(-sep, atomA.outerR + 0.9, 0);
      root.add(lA);
      const lB = makeTextSprite(`+${transferCount} e⁻`, '#39d353');
      lB.position.set(sep, atomB.outerR + 0.9, 0);
      root.add(lB);
    }

    // Electrones de transferencia (iónico, fase antes): viajan de A a B
    const transferElectrons = [];
    const transferArrows = [];
    const startX = -sep + atomA.outerR * 0.6;
    const endX = sep - atomB.outerR * 0.6;
    if (phase === 'antes' && bondType === 'ionic' && transferCount > 0) {
      // Ruta visible (arco discontinuo) de A a B
      const pathPoints = [];
      for (let k = 0; k <= 48; k++) {
        const p = k / 48;
        pathPoints.push(new THREE.Vector3(startX + (endX - startX) * p, Math.sin(p * Math.PI) * 1.8, 0));
      }
      const pathLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pathPoints),
        new THREE.LineDashedMaterial({ color: 0xffd23f, transparent: true, opacity: 0.4, dashSize: 0.18, gapSize: 0.12 })
      );
      pathLine.computeLineDistances();
      root.add(pathLine);
      // Flechas que recorren la ruta mostrando la dirección A→B (sin texto)
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.42, 10),
          new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 })
        );
        cone.userData.phase = i / 3;
        root.add(cone);
        transferArrows.push(cone);
      }
      // Electrones que recorren la ruta (escalonados)
      for (let i = 0; i < transferCount; i++) {
        const e = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 12, 12),
          new THREE.MeshPhongMaterial({ color: 0xffd23f, emissive: 0x997700, emissiveIntensity: 0.6 })
        );
        e.userData.phase = i / Math.max(transferCount, 1);
        root.add(e);
        transferElectrons.push(e);
      }
    }

    // Electrones compartidos (covalente): orbitan el punto medio
    const sharedElectrons = [];
    if (bondType === 'covalent' && sharedCount > 0) {
      const orbitR = 1.1;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(orbitR, 0.03, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.4 })
      );
      ring.rotation.y = Math.PI / 2;
      root.add(ring);
      for (let i = 0; i < sharedCount; i++) {
        const e = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 10, 10),
          new THREE.MeshPhongMaterial({ color: 0xffe066, emissive: 0x997700, emissiveIntensity: 0.6 })
        );
        e.userData.phase = (i / Math.max(sharedCount, 1)) * Math.PI;
        root.add(e);
        sharedElectrons.push(e);
      }
    }

    // Cámara autoajuste
    const span = 2 * sep + atomA.outerR + atomB.outerR;
    const fovRad = (50 * Math.PI) / 180;
    const cameraDist = span / Math.tan(fovRad / 2) + 3;
    let zoomZ = cameraDist;
    camera.position.set(0, 0, zoomZ);

    // Interacción: arrastrar para rotar + rueda/pellizco para zoom
    let isDragging = false;
    let prevX = 0, prevY = 0, rotVelX = 0, rotVelY = 0;
    let pinchDist = 0;
    const clampZoom = (z) => Math.max(cameraDist * 0.4, Math.min(cameraDist * 2.4, z));
    const onDown = (e) => { isDragging = true; const p = e.touches ? e.touches[0] : e; prevX = p.clientX; prevY = p.clientY; };
    const onMove = (e) => {
      if (e.touches && e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinchDist) zoomZ = clampZoom(zoomZ * (1 + (pinchDist - d) * 0.005));
        pinchDist = d; isDragging = false;
        return;
      }
      if (!isDragging) return;
      const p = e.touches ? e.touches[0] : e;
      rotVelY = (p.clientX - prevX) * 0.01;
      rotVelX = (p.clientY - prevY) * 0.01;
      root.rotation.y += rotVelY;
      root.rotation.x += rotVelX;
      prevX = p.clientX; prevY = p.clientY;
    };
    const onUp = () => { isDragging = false; pinchDist = 0; };
    const onWheel = (e) => { e.preventDefault(); zoomZ = clampZoom(zoomZ * (1 + e.deltaY * 0.001)); };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', onDown, { passive: true });
    renderer.domElement.addEventListener('touchmove', onMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    const clock = new THREE.Clock();
    let elapsed = 0;
    const tangentHelper = new THREE.Vector3();
    const upY = new THREE.Vector3(0, 1, 0);
    const animate = () => {
      if (!visible) { clock.getDelta(); rafRef.current = requestAnimationFrame(animate); return; }
      const dt = clock.getDelta();
      if (pausedRef.current) {
        // Pausa: aplanado 2D instantáneo, render estático y detiene el loop.
        root.rotation.x = 0; root.rotation.y = 0;
        atomA.shellGroups.forEach((sg) => { sg.rotation.x = 0; sg.rotation.y = 0; });
        atomB.shellGroups.forEach((sg) => { sg.rotation.x = 0; sg.rotation.y = 0; });
        camera.position.z = zoomZ;
        renderer.render(scene, camera);
        rafRef.current = null;
        return;
      }
      elapsed += dt;
      const t = elapsed;
      if (!isDragging) {
        root.rotation.y += rotVelY * 0.95;
        root.rotation.x += rotVelX * 0.95;
        rotVelY *= 0.95; rotVelX *= 0.95;
      }
      atomA.shellGroups.forEach((sg, i) => { sg.rotation.z += 0.012 / (i + 1); });
      atomB.shellGroups.forEach((sg, i) => { sg.rotation.z -= 0.012 / (i + 1); });
      transferElectrons.forEach((e) => {
        const ph = (t * 0.4 + e.userData.phase) % 1;
        e.position.set(startX + (endX - startX) * ph, Math.sin(ph * Math.PI) * 1.8, 0);
      });
      transferArrows.forEach((cone) => {
        const ph = (t * 0.4 + cone.userData.phase) % 1;
        cone.position.set(startX + (endX - startX) * ph, Math.sin(ph * Math.PI) * 1.8, 0);
        tangentHelper.set(endX - startX, Math.cos(ph * Math.PI) * Math.PI * 1.8, 0).normalize();
        cone.quaternion.setFromUnitVectors(upY, tangentHelper);
      });
      sharedElectrons.forEach((e) => {
        const ang = t * 2 + e.userData.phase;
        e.position.set(0, Math.cos(ang) * 1.1, Math.sin(ang) * 1.1);
      });
      camera.position.z = zoomZ;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animateRef.current = animate;
    animate();

    const handleResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w > 0 && h > 0) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('touchstart', onDown);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('touchend', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.material) {
          if (obj.material.map && obj.material.map.dispose) obj.material.map.dispose();
          Array.isArray(obj.material) ? obj.material.forEach((m) => m.dispose()) : obj.material.dispose();
        }
        if (obj.geometry) obj.geometry.dispose();
      });
      renderer.dispose();
    };
  }, [elemA, elemB, bondType, transferCount, sharedCount, phase]);

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-[#0a0c12]' : 'relative w-full h-full'}>
      <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />
      <button
        onClick={() => setPhase((p) => (p === 'antes' ? 'después' : 'antes'))}
        className="absolute top-2 left-2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur-sm border border-white/15 text-white/85 hover:text-white hover:bg-black/75 text-[11px] font-medium"
        title="Cambiar fase"
      >
        <ArrowRightLeft className="w-3.5 h-3.5" />
        {phase === 'antes' ? 'Ver después' : 'Ver antes'}
      </button>
      <button
        onClick={() => setFullscreen((f) => !f)}
        className="absolute top-2 right-2 z-30 p-2 rounded-lg bg-black/55 backdrop-blur-sm border border-white/15 text-white/85 hover:text-white hover:bg-black/75"
        title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
      <span className="absolute bottom-2 left-2 z-30 text-[10px] text-white/65 bg-black/45 backdrop-blur-sm px-2 py-1 rounded-md pointer-events-none">
        {phase === 'antes' ? 'Antes · electrones en tránsito' : 'Después · configuración final'}{paused ? ' · pausa (capas aplanadas)' : ''}
      </span>
    </div>
  );
}