import * as THREE from 'three';

// 共有マテリアル。userData.shared を立てて個別オブジェクト削除時に dispose しない。
function shared(material) {
  material.userData.shared = true;
  return material;
}

// 描画順：不透明 → 水(1) → ガラス(2)。半透明同士は depthWrite:false で互いを隠さない。
export const RENDER_ORDER = Object.freeze({ WATER: 1, GLASS: 2 });

export const MATERIALS = {
  glass: shared(new THREE.MeshStandardMaterial({
    color: 0xd4f1ff,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  })),
  water: shared(new THREE.MeshStandardMaterial({
    color: 0x2a92cf,
    roughness: 0.15,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    // 砂・底面と面が重なっても奥側に回り、ちらつかない
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
  })),
  frame: shared(new THREE.MeshStandardMaterial({ color: 0x1d2329, roughness: 0.5, metalness: 0.3 })),
  sand: shared(new THREE.MeshStandardMaterial({ color: 0xe6d6b0, roughness: 0.95 })),
  wood: shared(new THREE.MeshStandardMaterial({ color: 0x5b3d28, roughness: 0.7 })),
  woodLight: shared(new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.6 })),
  wall: shared(new THREE.MeshStandardMaterial({ color: 0xdfe7ec, roughness: 0.9 })),
  trim: shared(new THREE.MeshStandardMaterial({ color: 0x5f6f7c, roughness: 0.6 })),
  rock: shared(new THREE.MeshStandardMaterial({ color: 0x8c7f70, roughness: 1, flatShading: true })),
  walkway: shared(new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.8 })),
};
