import * as THREE from 'three';

/** ブラシ範囲を示すリング（ワールド座標で表示） */
export function createBrushCursor() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }),
  );
  ring.renderOrder = 1000;
  ring.visible = false;
  return ring;
}
