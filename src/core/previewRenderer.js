import * as THREE from 'three';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * 全定義のサムネイルをオフスクリーンで撮影し、Map<defId, dataURL> を返す。
 * オブジェクトの BoundingBox 中心を注視し、外接球が視野に収まる距離にカメラを置く。
 * transparent: 背景を透明にする（生き物：カードの背景色でレア度を表すため）
 */
export async function generatePreviews(defs, build, { dispose, width = 256, height = 192, onProgress, type = 'image/png', quality, transparent = false } = {}) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: transparent });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = transparent ? null : new THREE.Color(0xdbe9f3);
  if (transparent) renderer.setClearColor(0x000000, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 100);
  const viewDir = new THREE.Vector3(0.9, 0.7, 1.3).normalize();
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const sphere = new THREE.Sphere();

  const results = new Map();
  try {
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const obj = build(def);
      scene.add(obj);
      obj.updateMatrixWorld(true);

      box.setFromObject(obj);
      if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
      box.getCenter(center);
      box.getBoundingSphere(sphere);

      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.92;

      camera.position.copy(center).addScaledVector(viewDir, dist);
      camera.near = Math.max(0.001, dist - sphere.radius * 2);
      camera.far = dist + sphere.radius * 2;
      camera.updateProjectionMatrix();
      camera.lookAt(center);
      camera.updateMatrixWorld();

      renderer.render(scene, camera);
      results.set(def.id, renderer.domElement.toDataURL(type, quality));

      scene.remove(obj);
      dispose?.(obj);

      onProgress?.(i + 1, defs.length, def);
      await nextFrame(); // スプラッシュのアニメーションを止めない
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return results;
}
