import * as THREE from 'three';
import { MATERIALS } from './materials.js';
import { applySand } from './sandLook.js';

/**
 * 水槽ごとの見た目：背面・左右側面のバックスクリーン（色＋透明度）、フレーム（あり＋色／フレームレス）、水槽用ライト。
 * look = {
 *   back|left|right: { color: '#rrggbb', alpha: 0..1 },   // alpha 0 = 透明（貼っていないのと同じ）
 *   frame: boolean, frameColor: '#rrggbb',
 *   light: { on, color, intensity },
 *   sand: { on, type, depth }（depth: 砂の厚さ m。null なら水槽の大きさに合わせた標準）, floorColor: 砂なしの底面の色,
 *   caustics: 水面のゆらぎが底に映す光の模様,
 * }
 */

/** 100色のカラーマップ：無彩色10段 + 色相10 × 明るさ・鮮やかさ9段 */
export const PALETTE = (() => {
  const out = [];
  const c = new THREE.Color();
  for (let i = 0; i < 10; i++) out.push(`#${c.setHSL(0, 0, i / 9).getHexString()}`);
  const tones = [
    [0.9, 0.15], [0.85, 0.25], [0.8, 0.35], [0.75, 0.45], [0.8, 0.55], [0.7, 0.65], [0.55, 0.75], [0.4, 0.82], [0.3, 0.9],
  ];
  for (const [s, l] of tones) {
    for (let h = 0; h < 10; h++) out.push(`#${c.setHSL(h / 10, s, l).getHexString()}`);
  }
  return out;
})();

export const FRAME_COLORS = ['#1d2329', '#f2f2f2', '#9aa3ab', '#6b4a32', '#1f4f8a', '#c9a227'];

export function defaultTankLook() {
  const side = { color: '#1b3a5c', alpha: 0 };
  return {
    back: { ...side },
    left: { ...side },
    right: { ...side },
    frame: true,
    frameColor: FRAME_COLORS[0],
    light: { on: false, color: '#e8f4ff', intensity: 1.5 },
    sand: { on: true, type: 'fine', depth: null },
    floorColor: '#2b2f33',
    caustics: true,
  };
}

/** 旧形式（色の文字列 / null）も受け付けて正規化 */
function normSide(v, d) {
  if (v === null || v === undefined) return { ...d };
  if (typeof v === 'string') return { color: v, alpha: 1 };
  return { color: v.color ?? d.color, alpha: v.alpha ?? d.alpha };
}

export function normalizeLook(look = {}) {
  const d = defaultTankLook();
  return {
    back: normSide(look.back, d.back),
    left: normSide(look.left, d.left),
    right: normSide(look.right, d.right),
    frame: look.frame ?? d.frame,
    frameColor: look.frameColor ?? d.frameColor,
    light: { ...d.light, ...(look.light ?? {}) },
    sand: { ...d.sand, ...(look.sand ?? {}) },
    floorColor: look.floorColor ?? d.floorColor,
    caustics: look.caustics ?? d.caustics,
  };
}

const OFFSET = 0.002; // ガラスの外側に貼る

function disposeTree(o) {
  o.traverse((c) => {
    c.geometry?.dispose();
    c.material?.dispose();
    c.dispose?.();
  });
}

/** 水槽にバックスクリーン・フレーム・ライトを反映（何度呼んでもよい） */
export function applyTankLook(tank, def, lookIn) {
  const look = normalizeLook(lookIn);
  tank.userData.look = look;
  const body = tank.getObjectByName('body');
  applySand(tank, look);

  for (const o of [...body.children]) {
    if (!o.name.startsWith('look-')) continue;
    body.remove(o);
    disposeTree(o);
  }

  // フレーム：水槽ごとのマテリアルで色を変える / フレームレスなら非表示
  if (!tank.userData.frameMat) {
    tank.userData.frameMat = MATERIALS.frame.clone();
    tank.userData.frameMat.userData.shared = false;
  }
  const frameMat = tank.userData.frameMat;
  frameMat.color.set(look.frameColor);
  body.traverse((m) => {
    if (!m.userData.rim) return;
    m.visible = look.frame;
    m.material = frameMat;
  });

  // バックスクリーン
  const { w, h, d } = def.size;
  const screen = (side, geo, pos, rotY) => {
    if (side.alpha <= 0.001) return geo.dispose();
    // 水（renderOrder 1）の後・ガラス（2）の前に描いて、水の層で色が薄まらないようにする
    const mat = new THREE.MeshStandardMaterial({
      color: side.color,
      roughness: 0.8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: side.alpha,
      depthWrite: side.alpha > 0.99,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1.8;
    m.position.copy(pos);
    m.rotation.y = rotY;
    m.name = 'look-screen';
    m.receiveShadow = true;
    body.add(m);
  };
  if (def.shape === 'cylinder') {
    const r = w / 2 + OFFSET;
    screen(look.back, new THREE.CylinderGeometry(r, r, h * 0.94, 48, 1, true, Math.PI / 2, Math.PI), new THREE.Vector3(0, h * 0.53, 0), 0);
  } else {
    screen(look.back, new THREE.PlaneGeometry(w, h), new THREE.Vector3(0, h / 2, -d / 2 - OFFSET), 0);
    if (def.shape !== 'tunnel') {
      screen(look.left, new THREE.PlaneGeometry(d, h), new THREE.Vector3(-w / 2 - OFFSET, h / 2, 0), Math.PI / 2);
      screen(look.right, new THREE.PlaneGeometry(d, h), new THREE.Vector3(w / 2 + OFFSET, h / 2, 0), -Math.PI / 2);
    }
  }

  // 水槽用ライト（上部の照明器具 + 下向きスポット）
  if (look.light.on) {
    const g = new THREE.Group();
    g.name = 'look-light';
    const lw = Math.min(w * 0.9, 1.6);
    const ld = Math.min(d * 0.35, 0.14);
    const y = h + 0.07;
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4, metalness: 0.5 });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.025, ld), housingMat);
    housing.position.y = y;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(lw * 0.95, ld * 0.8), new THREE.MeshBasicMaterial({ color: look.light.color }));
    panel.rotation.x = Math.PI / 2;
    panel.position.y = y - 0.0135;
    g.add(housing, panel);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.01), housingMat);
      leg.position.set(sx * lw * 0.45, h + 0.035, 0);
      g.add(leg);
    }
    const spot = new THREE.SpotLight(look.light.color, look.light.intensity * 2, h + 1, 1, 0.5, 0);
    spot.angle = Math.min(1.3, Math.atan(Math.max(w, d) / 2 / 0.3) * 1.1);
    spot.position.set(0, y - 0.02, 0);
    spot.target.position.set(0, 0, 0);
    g.add(spot, spot.target);
    body.add(g);
  }
}
