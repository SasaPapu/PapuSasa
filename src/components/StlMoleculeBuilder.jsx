import * as THREE from 'three';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2, Box, Cylinder, AlertCircle, Layers } from 'lucide-react';
import { ELEMENT_COLORS } from '@/lib/elements';
import {
  loadStlGeometry,
  getGeometryInfo,
  detectCylinderAxis,
  buildMoleculePieces,
  mergeAndExportStl,
} from '@/lib/stlBuilder';

const BG_COLOR = 0x0f1117;

export default function StlMoleculeBuilder({ compound }) {
  const mountRef = useRef(null);
  const rootRef = useRef(null);
  const zoomRef = useRef(50);
  const sphereGeoRef = useRef(null);
  const cylinderGeoRef = useRef(null);

  const [sphereDims, setSphereDims] = useState('');
  const [cylinderDims, setCylinderDims] = useState('');
  const [cylinderAxisLabel, setCylinderAxisLabel] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const ready = !!sphereDims && !!cylinderDims && !!compound;

  const handleSphereUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const geo = await loadStlGeometry(file);
      sphereGeoRef.current = geo;
      const info = getGeometryInfo(geo);
      setSphereDims(
        `${info.size.x.toFixed(2)} × ${info.size.y.toFixed(2)} × ${info.size.z.toFixed(2)} mm`
      );
    } catch (err) {
      setError('Error al cargar esfera: ' + err.message);
    }
  };

  const handleCylinderUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const geo = await loadStlGeometry(file);
      cylinderGeoRef.current = geo;
      const info = getGeometryInfo(geo);
      setCylinderDims(
        `${info.size.x.toFixed(2)} × ${info.size.y.toFixed(2)} × ${info.size.z.toFixed(2)} mm`
      );
      const { name, length } = detectCylinderAxis(info.size);
      setCylinderAxisLabel(`${name} (${length.toFixed(2)} mm)`);
    } catch (err) {
      setError('Error al cargar cilindro: ' + err.message);
    }
  };

  // Configuración de la escena 3D (se ejecuta una vez al montar)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (width === 0 || height === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.9);
    d1.position.set(30, 50, 40);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
    d2.position.set(-30, -20, -30);
    scene.add(d2);

    const root = new THREE.Group();
    scene.add(root);
    rootRef.current = root;

    let isDown = false;
    let prev = { x: 0, y: 0 };
    const rotation = { x: 0.2, y: 0.3 };
    const velocity = { x: 0, y: 0 };

    const onDown = (e) => {
      isDown = true;
      velocity.x = 0;
      velocity.y = 0;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (!isDown) return;
      rotation.y += (e.clientX - prev.x) * 0.01;
      rotation.x += (e.clientY - prev.y) * 0.01;
      velocity.x = (e.clientY - prev.y) * 0.01;
      velocity.y = (e.clientX - prev.x) * 0.01;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { isDown = false; };
    const onWheel = (e) => {
      e.preventDefault();
      zoomRef.current += e.deltaY * 0.08;
      zoomRef.current = Math.max(10, Math.min(500, zoomRef.current));
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let raf;
    const animate = () => {
      if (!isDown) {
        rotation.x += velocity.x;
        rotation.y += velocity.y;
        velocity.x *= 0.97;
        velocity.y *= 0.97;
        if (Math.abs(velocity.x) < 0.0002) velocity.x = 0;
        if (Math.abs(velocity.y) < 0.0002) velocity.y = 0;
      }
      root.rotation.x = rotation.x;
      root.rotation.y = rotation.y;
      camera.position.set(0, 0, zoomRef.current);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
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
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material && typeof obj.material.dispose === 'function') obj.material.dispose();
      });
      rootRef.current = null;
    };
  }, []);

  // Reconstruye la vista previa cuando cambian la molécula o los STL cargados
  const rebuildPreview = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    while (root.children.length > 0) {
      const child = root.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material && typeof child.material.dispose === 'function') child.material.dispose();
      root.remove(child);
    }

    const sphereGeo = sphereGeoRef.current;
    const cylinderGeo = cylinderGeoRef.current;
    if (!sphereGeo || !cylinderGeo || !compound) return;

    const pieces = buildMoleculePieces(sphereGeo, cylinderGeo, compound);
    const matCache = {};
    const cylMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.3, roughness: 0.5 });

    pieces.forEach(({ geo, type, element }) => {
      let mat;
      if (type === 'sphere') {
        const color = ELEMENT_COLORS[element] || '#888888';
        if (!matCache[color]) {
          matCache[color] = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            metalness: 0.15,
            roughness: 0.45,
          });
        }
        mat = matCache[color];
      } else {
        mat = cylMat;
      }
      root.add(new THREE.Mesh(geo, mat));
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    zoomRef.current = maxDim * 1.8 + 10;
  }, [compound]);

  useEffect(() => {
    rebuildPreview();
  }, [rebuildPreview, sphereDims, cylinderDims]);

  const handleExport = async () => {
    if (!ready) return;
    setExporting(true);
    setError('');
    try {
      const pieces = buildMoleculePieces(sphereGeoRef.current, cylinderGeoRef.current, compound);
      await mergeAndExportStl(pieces, `${compound.formula}-ensamblado.stl`);
    } catch (err) {
      setError('Error al exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <aside className="lg:w-80 lg:border-r border-white/10 p-5 space-y-5 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Impresión 3D
          </h2>
          <p className="text-sm text-white/50 mt-0.5">
            Sube tus STL base (esfera con orificio + cilindro). La app los duplica y posiciona
            según la estructura molecular real del compuesto seleccionado.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Box className="w-4 h-4 text-sky-400" />
            Esfera (átomo)
          </label>
          <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg bg-white/5 border border-dashed border-white/20 cursor-pointer hover:bg-white/[0.07] transition-colors">
            <Upload className="w-5 h-5 text-white/40" />
            <span className="text-xs text-white/50 text-center">
              {sphereDims ? `✓ ${sphereDims}` : 'Clic para subir .stl'}
            </span>
            <input type="file" accept=".stl" className="hidden" onChange={handleSphereUpload} />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Cylinder className="w-4 h-4 text-amber-400" />
            Cilindro (enlace)
          </label>
          <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg bg-white/5 border border-dashed border-white/20 cursor-pointer hover:bg-white/[0.07] transition-colors">
            <Upload className="w-5 h-5 text-white/40" />
            <span className="text-xs text-white/50 text-center">
              {cylinderDims ? `✓ ${cylinderDims}` : 'Clic para subir .stl'}
            </span>
            <input type="file" accept=".stl" className="hidden" onChange={handleCylinderUpload} />
          </label>
          {cylinderAxisLabel && (
            <p className="text-[10px] text-white/40">Eje largo detectado: {cylinderAxisLabel}</p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-4 border-t border-white/10 space-y-2">
          <Button
            onClick={handleExport}
            disabled={!ready || exporting}
            className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:opacity-90 text-white border-0"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            {exporting ? 'Exportando...' : 'Exportar STL combinado'}
          </Button>
          {ready && compound ? (
            <p className="text-[11px] text-white/50 text-center">
              {compound.atoms.length} esferas + {compound.bonds.length} cilindros → 1 STL
            </p>
          ) : (
            <p className="text-[11px] text-white/35 text-center">
              Sube ambos STL y selecciona/genera una molécula
            </p>
          )}
        </div>
      </aside>

      <main className="flex-1 min-h-[400px] relative">
        <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <Layers className="w-10 h-10 text-white/20" />
            <p className="text-white/40 text-sm text-center max-w-xs px-4">
              Sube los archivos STL base y la molécula se ensamblará aquí con las coordenadas reales
            </p>
          </div>
        )}
      </main>
    </div>
  );
}