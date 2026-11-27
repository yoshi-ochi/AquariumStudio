import * as THREE from 'three';

/**
 * エアレーション（エアストーン＋泡）。
 * 泡は InstancedMesh。位置は時間から計算するだけなので軽い（シミュレーションしない）。
 * item.userData.bubbles = 泡の量 0..1
 */
const MAX_BUBBLES = 180;
export const DEFAULT_BUBBLES = 0.5;

export function buildAirstone(g, def, { seed = 1 } = {}) {
  const { w, h } = def.size;
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.4, w * 0.45, h * 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 1, flatShading: true }),
  );
  stone.position.y = h * 0.3;
  stone.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.15, w * 0.15, h * 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x2b3440 }));
  cap.position.y = h * 0.8;
  g.add(stone, cap);

  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
  const bubbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), bubbleMat, MAX_BUBBLES);
  bubbles.renderOrder = 1.9;
  bubbles.frustumCulled = false;
  bubbles.userData.noClip = true; // インスタンスはクリップ対象外（水槽の内側だけを上る）
  bubbles.name = 'bubbles';
  // 泡ごとの固定パラメータ（位相・大きさ・揺れ）
  const rnd = mulberry(seed);
  bubbles.userData.params = Array.from({ length: MAX_BUBBLES }, () => ({
    phase: rnd(),
    size: 0.0025 + rnd() * 0.004,
    wob: rnd() * Math.PI * 2,
    drift: (rnd() - 0.5) * 0.04,
    driftZ: (rnd() - 0.5) * 0.04,
  }));
  bubbles.count = 0;
  g.add(bubbles);
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** 泡を更新。height = エアストーンから水面までの高さ */
export function updateBubbles(item, time, height) {
  const mesh = item.getObjectByName('bubbles');
  if (!mesh) return;
  if (height <= 0.02) {
    mesh.count = 0; // 水が無い・エアストーンが水面より上：泡を出さない
    return;
  }
  const amount = item.userData.bubbles ?? DEFAULT_BUBBLES;
  const n = Math.round(MAX_BUBBLES * amount);
  mesh.count = n;
  const speed = 0.18 + amount * 0.12; // m/s
  const period = height / speed;
  for (let i = 0; i < n; i++) {
    const b = mesh.userData.params[i];
    const t = ((time / period + b.phase) % 1 + 1) % 1; // 0（底）→ 1（水面）
    const y = 0.03 + t * (height - 0.03);
    const spread = 0.004 + t * 0.03;
    _p.set(Math.sin(time * 5 + b.wob) * spread + b.drift * t, y, Math.cos(time * 4 + b.wob) * spread + b.driftZ * t);
    _s.setScalar(b.size * (0.7 + t * 0.6));
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  mesh.instanceMatrix.needsUpdate = true;
}
