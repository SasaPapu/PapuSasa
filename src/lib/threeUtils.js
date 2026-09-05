import * as THREE from 'three';

// Crea una etiqueta de texto flotante (sprite) que siempre mira a la cámara
export function createLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.font = 'bold 44px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, 64, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1, 0.5, 1);
  return sprite;
}

// Ajusta la distancia de la cámara para encuadrar todo el objeto
export function fitCameraToObject(camera, root, fov) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, 1);
  const fovRad = (fov * Math.PI) / 180;
  const dist = maxDim / (2 * Math.tan(fovRad / 2)) + maxDim * 0.35;
  return Math.max(dist, 10);
}