import * as THREE from 'three';
import { BALL_RADIUS_MM, POSITION_SCALE } from '@/lib/elements';

// Carga un archivo STL y devuelve una BufferGeometry con normales calculadas
export async function loadStlGeometry(file) {
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
  const loader = new STLLoader();
  const buffer = await file.arrayBuffer();
  const geo = loader.parse(buffer);
  geo.computeVertexNormals();
  return geo;
}

// Devuelve el bounding box, tamaño y centro de una geometría
export function getGeometryInfo(geo) {
  const box = new THREE.Box3().setFromGeometry(geo);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}

// Detecta automáticamente el eje largo de un cilindro según su bounding box
export function detectCylinderAxis(size) {
  if (size.x > size.y && size.x > size.z) {
    return { axis: new THREE.Vector3(1, 0, 0), length: size.x, name: 'X' };
  }
  if (size.z > size.y && size.z > size.x) {
    return { axis: new THREE.Vector3(0, 0, 1), length: size.z, name: 'Z' };
  }
  return { axis: new THREE.Vector3(0, 1, 0), length: size.y, name: 'Y' };
}

// Construye todas las piezas de la molécula clonando los STL base y aplicando
// transforms (posición, rotación, escala) según las coordenadas reales.
// NUNCA modifica las geometrías base — solo clona y transforma las copias.
export function buildMoleculePieces(sphereGeo, cylinderGeo, compound) {
  if (!sphereGeo || !cylinderGeo || !compound || !compound.atoms) return [];

  // Centrar la molécula en el origen (respecto al centroide real)
  const center = new THREE.Vector3();
  compound.atoms.forEach((a) =>
    center.add(new THREE.Vector3(...a.position).multiplyScalar(POSITION_SCALE))
  );
  center.divideScalar(compound.atoms.length);
  const centered = compound.atoms.map((a) =>
    new THREE.Vector3(...a.position).multiplyScalar(POSITION_SCALE).sub(center)
  );

  // Esfera: centrar en su centroide y escalar uniformemente al diámetro estándar
  const sphereInfo = getGeometryInfo(sphereGeo);
  const sphereMaxDim = Math.max(sphereInfo.size.x, sphereInfo.size.y, sphereInfo.size.z);
  const sphereScale = (BALL_RADIUS_MM * 2) / sphereMaxDim;

  // Cilindro: centrar en su centroide y detectar eje largo
  const cylInfo = getGeometryInfo(cylinderGeo);
  const { axis: cylAxis, length: cylLength } = detectCylinderAxis(cylInfo.size);

  const pieces = [];

  // Esferas: una copia por átomo, posicionada en sus coordenadas reales
  compound.atoms.forEach((atom, i) => {
    const geo = sphereGeo.clone();
    geo.translate(-sphereInfo.center.x, -sphereInfo.center.y, -sphereInfo.center.z);
    geo.scale(sphereScale, sphereScale, sphereScale);
    geo.translate(centered[i].x, centered[i].y, centered[i].z);
    geo.computeVertexNormals();
    pieces.push({ geo, type: 'sphere', element: atom.element });
  });

  // Cilindros: una copia por enlace, escalada en su eje largo a la longitud real
  // del enlace y rotada para alinearse con la dirección del enlace
  compound.bonds.forEach((bond) => {
    const a = centered[bond.from];
    const b = centered[bond.to];
    if (!a || !b) return;
    const dir = b.clone().sub(a);
    const bondLength = dir.length();
    if (bondLength < 0.001) return;

    const geo = cylinderGeo.clone();
    geo.translate(-cylInfo.center.x, -cylInfo.center.y, -cylInfo.center.z);
    // Escalar solo el eje largo del cilindro a la longitud real del enlace
    const sv = new THREE.Vector3(1, 1, 1);
    if (cylAxis.x > 0.5) sv.x = bondLength / cylLength;
    else if (cylAxis.y > 0.5) sv.y = bondLength / cylLength;
    else sv.z = bondLength / cylLength;
    geo.scale(sv.x, sv.y, sv.z);
    // Rotar el eje largo del cilindro a la dirección real del enlace
    const quat = new THREE.Quaternion().setFromUnitVectors(cylAxis, dir.clone().normalize());
    geo.applyQuaternion(quat);
    // Trasladar al punto medio del enlace
    const bondCenter = a.clone().add(b).multiplyScalar(0.5);
    geo.translate(bondCenter.x, bondCenter.y, bondCenter.z);
    geo.computeVertexNormals();
    pieces.push({ geo, type: 'cylinder' });
  });

  return pieces;
}

// Combina todas las piezas en una sola geometría y exporta un STL binario
export async function mergeAndExportStl(pieces, filename) {
  if (!pieces || pieces.length === 0) {
    throw new Error('No hay piezas para exportar');
  }
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

  const geometries = pieces.map((p) => p.geo);
  const merged = mergeGeometries(geometries, false);

  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(merged);
  const stl = exporter.parse(mesh, { binary: true });

  const blob = new Blob([stl], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  merged.dispose();
  geometries.forEach((g) => g.dispose());
}