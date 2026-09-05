import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { getElectronShells, getElectronicConfig } from '@/lib/elements';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PauseButton from '@/components/PauseButton';

// Representación 3D simplificada de un átomo según el modelo de Bohr:
// núcleo central + capas de electrones orbitando en anillos inclinados.
// Botón de pausa: al pausar, las capas se aplanan frente a la cámara (como
// pegadas a una pared) para poder observar todos los electrones de todos
// los niveles. Render optimizado (segmentos bajos, pixel ratio limitado).
// El estado de pausa persiste aunque el componente se remonte al entrar/salir
// de pantalla completa, así el botón mantiene la misma función en ambos modos.
let bohrPaused = false;

export default function BohrAtom3D({ data }) {
  const mountRef = useRef(null);
  const [paused, setPaused] = useState(bohrPaused);
  const [showConfig, setShowConfig] = useState(true);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; bohrPaused = paused; }, [paused]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const shells = getElectronShells(data.z);

    const width = mount.clientWidth || 256;
    const height = mount.clientHeight || 192;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(10, 10, 10);
    scene.add(light);

    const root = new THREE.Group();
    scene.add(root);

    // Núcleo
    const nucleusRadius = 1.5;
    const nucleusGeo = new THREE.SphereGeometry(nucleusRadius, 20, 16);
    const nucleusMat = new THREE.MeshPhongMaterial({
      color: 0xff5544,
      emissive: 0x441100,
      shininess: 40,
    });
    root.add(new THREE.Mesh(nucleusGeo, nucleusMat));

    // Etiqueta con el símbolo del elemento sobre el núcleo
    const lbl = document.createElement('canvas');
    lbl.width = 128; lbl.height = 64;
    const lctx = lbl.getContext('2d');
    lctx.font = 'bold 44px sans-serif';
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    lctx.strokeStyle = 'rgba(0,0,0,0.9)'; lctx.lineWidth = 6;
    lctx.strokeText(data.symbol, 64, 32);
    lctx.fillStyle = '#ffffff'; lctx.fillText(data.symbol, 64, 32);
    const lblTex = new THREE.CanvasTexture(lbl);
    const lblSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: lblTex, transparent: true, depthTest: false }));
    lblSprite.scale.set(nucleusRadius * 1.2, nucleusRadius * 0.6, 1);
    root.add(lblSprite);

    // Capas de electrones (geometrías compartidas para reducir carga)
    const shellGap = 2.8;
    const electronGeo = new THREE.SphereGeometry(0.26, 8, 8);
    const electronMat = new THREE.MeshPhongMaterial({
      color: 0x55aaff,
      emissive: 0x113366,
    });
    const ringGeoBase = (radius) => new THREE.TorusGeometry(radius, 0.05, 6, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6699ff,
      transparent: true,
      opacity: 0.45,
    });

    const shellGroups = [];
    shells.forEach((electronCount, idx) => {
      const radius = nucleusRadius + (idx + 1) * shellGap;
      const shellGroup = new THREE.Group();
      shellGroup.rotation.x = idx * 0.5;
      shellGroup.rotation.y = idx * 0.3;

      shellGroup.add(new THREE.Mesh(ringGeoBase(radius), ringMat));

      for (let i = 0; i < electronCount; i++) {
        const angle = (i / electronCount) * Math.PI * 2;
        const electron = new THREE.Mesh(electronGeo, electronMat);
        electron.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0
        );
        shellGroup.add(electron);
      }

      root.add(shellGroup);
      shellGroups.push(shellGroup);
    });

    // Auto-ajustar cámara según el tamaño del átomo
    const outerRadius = nucleusRadius + shells.length * shellGap;
    const fovRad = (50 * Math.PI) / 180;
    const cameraDist = outerRadius / Math.tan(fovRad / 2) + 4;
    camera.position.set(0, 0, cameraDist);

    // Interacción: arrastrar para rotar
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotVelX = 0;
    let rotVelY = 0;

    const onDown = (e) => {
      isDragging = true;
      const p = e.touches ? e.touches[0] : e;
      prevX = p.clientX;
      prevY = p.clientY;
    };
    const onMove = (e) => {
      if (!isDragging) return;
      const p = e.touches ? e.touches[0] : e;
      rotVelY = (p.clientX - prevX) * 0.01;
      rotVelX = (p.clientY - prevY) * 0.01;
      root.rotation.y += rotVelY;
      root.rotation.x += rotVelX;
      prevX = p.clientX;
      prevY = p.clientY;
    };
    const onUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', onDown, { passive: true });
    renderer.domElement.addEventListener('touchmove', onMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onUp);

    // Animación
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (pausedRef.current) {
        // Aplanar: las capas se orientan frente a la cámara (vista de "pared")
        root.rotation.x += (0 - root.rotation.x) * 0.12;
        root.rotation.y += (0 - root.rotation.y) * 0.12;
        shellGroups.forEach((sg) => {
          sg.rotation.x += (0 - sg.rotation.x) * 0.12;
          sg.rotation.y += (0 - sg.rotation.y) * 0.12;
        });
      } else {
        if (!isDragging) {
          root.rotation.y += rotVelY * 0.95 + 0.003;
          root.rotation.x += rotVelX * 0.95;
          rotVelY *= 0.95;
          rotVelX *= 0.95;
        }
        shellGroups.forEach((sg, i) => {
          sg.rotation.z += 0.012 / (i + 1);
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('touchstart', onDown);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('touchend', onUp);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map && obj.material.map.dispose) obj.material.map.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [data]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
      {showConfig && (
        <div className="absolute bottom-2 left-2 z-30 max-w-[85%] rounded-lg bg-black/55 backdrop-blur-md border border-white/15 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Configuración</span>
            <button onClick={() => setShowConfig(false)} className="text-white/40 hover:text-white" title="Ocultar">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono text-[11px] text-sky-200 mt-0.5 leading-snug">{getElectronicConfig(data.z)}</p>
        </div>
      )}
      {!showConfig && (
        <button onClick={() => setShowConfig(true)} className="absolute bottom-2 left-2 z-30 px-2 py-1.5 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 text-white/60 hover:text-white text-[10px] uppercase tracking-wide" title="Mostrar configuración">
          <ChevronUp className="w-3.5 h-3.5 inline -mt-0.5" /> Config.
        </button>
      )}
    </div>
  );
}