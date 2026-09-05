import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { ELEMENT_COLORS, inferBondOrders, electronegativity, getElementMeta } from '@/lib/elements';
import { ALL_ELEMENTS } from '@/lib/allElements';
import { createLabelSprite } from '@/lib/threeUtils';

const Z_BY_SYMBOL = {};
ALL_ELEMENTS.forEach((el) => { Z_BY_SYMBOL[el.symbol] = el.z; });

const BG_COLOR = 0x0a0c12;
const POSITION_SCALE = 8;
const BALL_RADIUS = 3.5;
const TUBE_RADIUS = 1.6;
// Longitud de enlace de referencia tomada del cloruro de potasio (KCl):
// posiciones [0,0,1.33] y [0,0,-1.33] → 2.66 Å × POSITION_SCALE.
const REFERENCE_BOND_LENGTH = 2.66 * POSITION_SCALE;

// Visor 3D limpio y desde cero: átomos como esferas coloreadas + enlaces como
// cilindros. Zoom con rueda/pellizco, rotación con arrastre (mouse y táctil).
// No genera geometría para impresión — solo visualización educativa.
export default function Molecule3DViewer({ compound, showLonePairs = true }) {
  const mountRef = useRef(null);
  const rootRef = useRef(null);
  const orientRef = useRef(null);
  const zoomRef = useRef(50);
  const dirtyRef = useRef(true);
  // Orientación canónica: se reinicia al cargar cada compuesto para que todos
  // aparezcan con la misma orientación, sin recargar la escena entera.
  const rotationRef = useRef({ x: 0.2, y: 0.3 });
  const velocityRef = useRef({ x: 0, y: 0 });

  // Configuración de la escena (se ejecuta una vez)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (width === 0 || height === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.85);
    d1.position.set(30, 50, 40);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
    d2.position.set(-30, -20, -30);
    scene.add(d2);

    const root = new THREE.Group();
    scene.add(root);
    const orientGroup = new THREE.Group();
    root.add(orientGroup);
    rootRef.current = root;
    orientRef.current = orientGroup;

    // Controles: arrastrar para rotar, rueda/pellizco para zoom
    let isDown = false;
    let prev = { x: 0, y: 0 };
    let pinchDist = 0;
    const rotation = rotationRef.current;
    const velocity = velocityRef.current;

    const onPointerDown = (e) => {
      isDown = true;
      velocity.x = 0;
      velocity.y = 0;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e) => {
      if (!isDown) return;
      rotation.y += (e.clientX - prev.x) * 0.01;
      rotation.x += (e.clientY - prev.y) * 0.01;
      velocity.x = (e.clientY - prev.y) * 0.01;
      velocity.y = (e.clientX - prev.x) * 0.01;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { isDown = false; };
    const onWheel = (e) => {
      e.preventDefault();
      zoomRef.current *= 1 + e.deltaY * 0.001;
      zoomRef.current = Math.max(8, Math.min(400, zoomRef.current));
    };

    // Zoom táctil con dos dedos (pellizco)
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        isDown = false;
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        zoomRef.current *= 1 + (pinchDist - d) * 0.005;
        zoomRef.current = Math.max(8, Math.min(400, zoomRef.current));
        pinchDist = d;
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });

    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    let raf;
    let prevCamZ = camera.position.z;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!visible) return;
      let changed = false;
      if (!isDown) {
        rotation.x += velocity.x;
        rotation.y += velocity.y;
        velocity.x *= 0.95;
        velocity.y *= 0.95;
        if (Math.abs(velocity.x) < 0.0002) velocity.x = 0;
        if (Math.abs(velocity.y) < 0.0002) velocity.y = 0;
        if (velocity.x !== 0 || velocity.y !== 0) changed = true;
      } else {
        changed = true;
      }
      root.rotation.x = rotation.x;
      root.rotation.y = rotation.y;
      const camZ = zoomRef.current;
      if (camZ !== prevCamZ) { camera.position.set(0, 0, camZ); prevCamZ = camZ; changed = true; }
      // Renderizado bajo demanda: si nada se mueve, no se dibuja (alivia GPU/CPU).
      if (changed || dirtyRef.current) {
        renderer.render(scene, camera);
        dirtyRef.current = false;
      }
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map && typeof obj.material.map.dispose === 'function') obj.material.map.dispose();
          if (typeof obj.material.dispose === 'function') obj.material.dispose();
        }
      });
      rootRef.current = null;
    };
  }, []);

  // Construye la molécula cuando cambia el compuesto
  useEffect(() => {
    const root = rootRef.current;
    const orient = orientRef.current;
    if (!root || !orient) return;

    while (orient.children.length > 0) {
      const child = orient.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material && typeof child.material.dispose === 'function') child.material.dispose();
      orient.remove(child);
    }
    orient.quaternion.identity();

    if (!compound || !compound.atoms) return;

    // Posiciones originales centradas respecto al centroide
    const center = new THREE.Vector3();
    compound.atoms.forEach((a) =>
      center.add(new THREE.Vector3(...a.position).multiplyScalar(POSITION_SCALE))
    );
    center.divideScalar(compound.atoms.length);
    const centered = compound.atoms.map((a) =>
      new THREE.Vector3(...a.position).multiplyScalar(POSITION_SCALE).sub(center)
    );

    // Normalizar todos los enlaces a la longitud de referencia (KCl) mediante BFS:
    // se conservan las direcciones (ángulos de enlace) pero cada enlace mide lo mismo.
    if (compound.bonds && compound.bonds.length) {
      const adj = compound.atoms.map(() => []);
      compound.bonds.forEach((b) => { adj[b.from].push(b.to); adj[b.to].push(b.from); });
      const placed = new Array(compound.atoms.length).fill(null);
      placed[0] = new THREE.Vector3();
      const queue = [0];
      while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj[cur]) {
          if (placed[nb]) continue;
          const dir = centered[nb].clone().sub(centered[cur]);
          if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0);
          dir.normalize().multiplyScalar(REFERENCE_BOND_LENGTH);
          placed[nb] = placed[cur].clone().add(dir);
          queue.push(nb);
        }
      }
      for (let i = 0; i < placed.length; i++) if (!placed[i]) placed[i] = centered[i].clone();
      // Re-centrar respecto al nuevo centroide
      const newCenter = new THREE.Vector3();
      placed.forEach((p) => newCenter.add(p));
      newCenter.divideScalar(placed.length);
      for (let i = 0; i < centered.length; i++) centered[i] = placed[i].sub(newCenter);
    }

    const matCache = {};
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.3, roughness: 0.5 });

    // Átomos como esferas coloreadas por elemento
    compound.atoms.forEach((atom, i) => {
      const color = ELEMENT_COLORS[atom.element] || '#888888';
      if (!matCache[color]) {
        matCache[color] = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          metalness: 0.15,
          roughness: 0.45,
        });
      }
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 18, 14), matCache[color]);
      mesh.position.copy(centered[i]);
      orient.add(mesh);

      const label = createLabelSprite(atom.element);
      label.position.copy(centered[i]);
      label.scale.set(6, 3, 1);
      orient.add(label);
    });

    // Enlaces como cilindros paralelos según el orden (simple/doble/triple)
    const orders = inferBondOrders(compound.atoms, compound.bonds);
    compound.bonds.forEach((bond, idx) => {
      const a = centered[bond.from];
      const b = centered[bond.to];
      if (!a || !b) return;
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len < 0.01) return;
      const n = Math.max(1, Math.min(3, orders[idx] || 1));
      const up = new THREE.Vector3(0, 0, 1);
      let perp = new THREE.Vector3().crossVectors(dir, up);
      if (perp.lengthSq() < 0.001) perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      perp.normalize();
      const r = n === 3 ? TUBE_RADIUS * 0.45 : n === 2 ? TUBE_RADIUS * 0.55 : TUBE_RADIUS;
      const off = n === 3 ? TUBE_RADIUS * 1.0 : n === 2 ? TUBE_RADIUS * 1.15 : 0;
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0 : k - (n - 1) / 2;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), tubeMat);
        mesh.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(perp.clone().multiplyScalar(t * off));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        orient.add(mesh);
      }
    });

    // --- Capa de valencia y pares no enlazantes ---
    const bondOrderSumByAtom = new Array(compound.atoms.length).fill(0);
    compound.bonds.forEach((bond, idx) => {
      const o = orders[idx] || 1;
      bondOrderSumByAtom[bond.from] += o;
      bondOrderSumByAtom[bond.to] += o;
    });

    // Octeto/dueto completo: 8 esferas en vértices de cubo (2 para H/He).
    // Visible siempre: representa la capa de valencia completa del átomo estable.
    const octetMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x113355, emissiveIntensity: 0.7, metalness: 0.1, roughness: 0.5 });
    const octetGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.2, 10, 10);
    const cubeVertices = (center, radius) => {
      const d = radius / Math.sqrt(3);
      const pts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(center.x + sx * d, center.y + sy * d, center.z + sz * d));
      }
      return pts;
    };
    // Pares no enlazantes (átomo sin octeto completo): dos esferas ordenadas por par.
    const loneMat = new THREE.MeshStandardMaterial({ color: 0xd8ccff, emissive: 0x4a3a7a, emissiveIntensity: 0.4, metalness: 0.1, roughness: 0.6 });
    const loneGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.18, 8, 8);
    let lonePairLabelPos = null;
    compound.atoms.forEach((atom, i) => {
      const z = Z_BY_SYMBOL[atom.element];
      if (!z) return;
      const valence = getElementMeta(z)?.valence ?? 0;
      const lp = Math.round((valence - bondOrderSumByAtom[i]) / 2);
      const octetElectrons = 2 * (lp + bondOrderSumByAtom[i]);
      const isLight = atom.element === 'H' || atom.element === 'He';
      const isOctet = isLight ? octetElectrons === 2 : octetElectrons === 8;
      const pos = centered[i];
      if (isOctet) {
        const shellR = BALL_RADIUS * 1.35;
        if (isLight) {
          const dir = new THREE.Vector3();
          compound.bonds.forEach((bond) => {
            if (bond.from === i || bond.to === i) {
              const other = bond.from === i ? centered[bond.to] : centered[bond.from];
              if (other) dir.add(other.clone().sub(pos));
            }
          });
          if (dir.lengthSq() > 0.001) dir.normalize();
          else dir.set(1, 0, 0);
          [-1, 1].forEach((s) => {
            const e = new THREE.Mesh(octetGeo, octetMat);
            e.position.copy(pos).add(dir.clone().multiplyScalar(s * shellR));
            orient.add(e);
          });
        } else {
          cubeVertices(pos, shellR).forEach((v) => {
            const e = new THREE.Mesh(octetGeo, octetMat);
            e.position.copy(v);
            orient.add(e);
          });
        }
        return;
      }
      if (!showLonePairs) return;
      if (lp <= 0) return;
      if (!lonePairLabelPos) lonePairLabelPos = pos.clone();
      // dirección opuesta al conjunto de enlaces
      const dir = new THREE.Vector3();
      compound.bonds.forEach((bond) => {
        if (bond.from === i || bond.to === i) {
          const other = bond.from === i ? centered[bond.to] : centered[bond.from];
          if (other) dir.add(other.clone().sub(pos));
        }
      });
      if (dir.lengthSq() > 0.001) dir.normalize().negate();
      else dir.copy(pos).normalize().negate();
      // base perpendicular para repartir varios pares
      let perp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(perp)) > 0.95) perp.set(1, 0, 0);
      perp.crossVectors(dir, perp).normalize();
      const third = new THREE.Vector3().crossVectors(dir, perp).normalize();
      const baseOffset = BALL_RADIUS * 1.3;
      const pairGap = BALL_RADIUS * 0.36;
      for (let k = 0; k < lp; k++) {
        const angle = (k / lp) * Math.PI * 2;
        const radial = perp.clone().multiplyScalar(Math.cos(angle) * BALL_RADIUS * 0.55)
          .add(third.clone().multiplyScalar(Math.sin(angle) * BALL_RADIUS * 0.55));
        // tangente al radial para orientar las dos esferas del par
        const tang = perp.clone().multiplyScalar(-Math.sin(angle))
          .add(third.clone().multiplyScalar(Math.cos(angle))).normalize();
        const center = pos.clone().add(dir.clone().multiplyScalar(baseOffset)).add(radial);
        const off = tang.clone().multiplyScalar(pairGap / 2);
        const d1 = new THREE.Mesh(loneGeo, loneMat);
        d1.position.copy(center).add(off);
        orient.add(d1);
        const d2 = new THREE.Mesh(loneGeo, loneMat);
        d2.position.copy(center).sub(off);
        orient.add(d2);
      }
    });

    if (showLonePairs && lonePairLabelPos) {
      const lpLabel = createLabelSprite('pares de electrones');
      lpLabel.position.copy(lonePairLabelPos).add(new THREE.Vector3(0, BALL_RADIUS * 2.4, 0));
      lpLabel.scale.set(11, 5.5, 1);
      root.add(lpLabel);
    }

    // --- Flechas de polaridad: indican hacia dónde se desplazan los electrones
    // del enlace (hacia el átomo más electronegativo). Apolar (ΔEN < 0.4): sin flecha.
    const mkArrowMat = (color) => new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.3,
    });
    const arrowMatIonic = mkArrowMat(0xfacc15);
    compound.bonds.forEach((bond, idx) => {
      const a = centered[bond.from];
      const b = centered[bond.to];
      if (!a || !b) return;
      const zA = Z_BY_SYMBOL[compound.atoms[bond.from].element];
      const zB = Z_BY_SYMBOL[compound.atoms[bond.to].element];
      const enA = electronegativity(zA);
      const enB = electronegativity(zB);
      if (enA == null || enB == null) return;
      // Iónico solo si hay metal + no metal (consistente con classifyCompound);
      // si ambos son no metales, aunque ΔEN sea alto (ej. HF), es covalente polar.
      const catA = getElementMeta(zA)?.category;
      const catB = getElementMeta(zB)?.category;
      const isMetal = (cat) => cat && ['Metal alcalino', 'Alcalinotérreo', 'Metal de transición', 'Metal del bloque p', 'Lantánido', 'Actínido'].includes(cat);
      const ionic = (isMetal(catA) && !isMetal(catB)) || (isMetal(catB) && !isMetal(catA));
      if (!ionic) return; // covalente: sin flechas (solo iónico muestra transferencia)
      const src = enB > enA ? a : b;   // menos electronegativo
      const dst = enB > enA ? b : a;   // más electronegativo (destino de los e-)
      const dir = dst.clone().sub(src).normalize();
      const len = src.distanceTo(dst);
      // Flecha pegada al cilindro del enlace: varilla fina + cabeza compacta.
      const total = Math.min(len * 0.85, BALL_RADIUS * 3.2);
      const headH = BALL_RADIUS * 1.5;
      const headR = BALL_RADIUS * 0.42;
      const shaftLen = Math.max(BALL_RADIUS * 0.3, total - headH);
      const shaftR = BALL_RADIUS * 0.12;
      const mat = arrowMatIonic;
      const grp = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR * 0.35, shaftR * 1.8, shaftLen, 8), mat);
      shaft.position.y = shaftLen / 2;
      grp.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(BALL_RADIUS * 0.18, headH * 1.4, 10), mat);
      head.position.y = shaftLen + headH / 2;
      grp.add(head);
      // Eje perpendicular al enlace para colocar la flecha en la parte exterior del cilindro
      let perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      if (perp.lengthSq() < 0.001) perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
      perp.normalize();
      const offset = TUBE_RADIUS;
      // Situar la flecha junto al enlace (en la parte de afuera del cilindro)
      const arrowLen = shaftLen + headH;
      // 4 flechas alrededor del cilindro (a 90°) para que se vean desde cualquier ángulo
      const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();
      [perp.clone(), perp.clone().negate()].forEach((side) => {
        const base = src.clone()
          .add(dir.clone().multiplyScalar((len - arrowLen) / 2))
          .add(side.multiplyScalar(offset));
        const arrow = grp.clone();
        arrow.position.copy(base);
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        orient.add(arrow);
      });
    });

    // Orientar la cadena principal hacia la derecha (+X): alinear el par de
    // átomos más alejados (eje de mayor extensión de la molécula) con el eje X
    // positivo, respetando la geometría original de PubChem.
    let maxDist = -1;
    let mainDir = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < centered.length; i++) {
      for (let j = i + 1; j < centered.length; j++) {
        const d = centered[i].distanceTo(centered[j]);
        if (d > maxDist) { maxDist = d; mainDir = centered[j].clone().sub(centered[i]); }
      }
    }
    if (mainDir.lengthSq() > 0.0001) {
      mainDir.normalize();
      orient.quaternion.setFromUnitVectors(mainDir, new THREE.Vector3(1, 0, 0));
    }

    // Ajustar zoom al tamaño de la molécula
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    zoomRef.current = maxDim * 1.8 + 10;
    // Reiniciar a la orientación canónica sin recargar la escena (solo geometría).
    rotationRef.current.x = 0.2;
    rotationRef.current.y = 0.3;
    velocityRef.current.x = 0;
    velocityRef.current.y = 0;
    dirtyRef.current = true;
  }, [compound]);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} />
    </div>
  );
}