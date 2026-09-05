import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Logo ICOR3D: átomo de Bohr miniatura (Three.js) que sustituye a la "o" de Icor.
// Reutiliza la lógica visual de BohrAtom3D pero en versión compacta y estática-animada.
export default function IcorLogoBohr({ size = 28 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = size;
    const height = size;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(6, 6, 8);
    scene.add(light);

    const root = new THREE.Group();
    scene.add(root);

    // Núcleo
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 14, 12),
      new THREE.MeshPhongMaterial({ color: 0xff5544, emissive: 0x441100 })
    );
    root.add(nucleus);

    // 2 capas de electrones (representación ligera del modelo de Bohr)
    const shells = [2, 4]; // simple, decorativo
    const electronGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const electronMat = new THREE.MeshPhongMaterial({ color: 0x55aaff, emissive: 0x113366 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.4 });
    const shellGroups = [];
    shells.forEach((count, idx) => {
      const radius = 2.6 + idx * 2.2;
      const sg = new THREE.Group();
      sg.rotation.x = idx * 0.6;
      sg.rotation.y = idx * 0.4;
      sg.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, 36), ringMat));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const e = new THREE.Mesh(electronGeo, electronMat);
        e.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
        sg.add(e);
      }
      root.add(sg);
      shellGroups.push(sg);
    });

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      root.rotation.y += 0.004;
      shellGroups.forEach((sg, i) => { sg.rotation.z += 0.01 / (i + 1); });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [size]);

  return <div ref={mountRef} style={{ width: size, height: size }} className="inline-block shrink-0" />;
}