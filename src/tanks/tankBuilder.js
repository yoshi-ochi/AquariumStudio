import * as THREE from 'three';
import { MATERIALS, RENDER_ORDER } from './materials.js';
import { CATEGORY } from './tankData.js';
import { buildLiveRock, buildDriftwood } from './interiorBuilder.js';
import { buildFlora, normalizeFlora } from '../flora/floraBuilder.js';
import { buildSouvenirShop, buildCafe, buildResearchLab, buildBreedingTank, buildWaterPlant, buildCleanCenter, buildFreezer, buildLiveFeed, buildFoodPrep } from './facilityBuilder.js';
import { buildAirstone } from './aeration.js';
import { buildPolyTank } from './polyTank.js';
import { normalizeGrowth } from './growth.js';
import { waterSurfaceMesh } from '../water/waterSurface.js';
import { DECOR_BUILDERS, buildStandSkin } from '../decor/decorBuilders.js';

/** 水平な水面ジオメトリ（XZ 平面）を高さ y に置く */
function addSurface(parent, geometry, y, x = 0) {
  geometry.rotateX(-Math.PI / 2);
  const m = waterSurfaceMesh(geometry);
  m.position.set(x, y, 0);
  parent.add(m);
}

/**
 * 定義からオブジェクトを生成する。
 * 戻り値の root は底面が y=0、中心が x=z=0 のローカル座標系。
 * root.children: 'body'（見た目）と 'contents'（水槽内オブジェ用の子グループ）。
 */
export function buildObject(def, { seed = 1, growth, shape, skin } = {}) {
  const flora = def.flora ? normalizeFlora(def, growth) : null;
  const g = flora ? flora.growth : def.growth ? normalizeGrowth(growth) : undefined;
  const root = new THREE.Group();
  root.name = def.id;
  root.userData.defId = def.id;
  // 館内オブジェと水槽内オブジェはピッキング時に区別する
  if (def.category === CATEGORY.INTERIOR) {
    root.userData.interiorItem = true;
    root.userData.seed = seed;
    if (g) root.userData.growth = g;
    if (def.shape === 'liveRock') root.userData.shape = shape ?? 0; // 岩の形（ROCK_SHAPES の番号）
    if (flora?.legacy) root.userData.conform = true; // 以前の形式から読み替えた：置いたあと地形に沿わせ直す
  } else {
    root.userData.placeable = true;
  }

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const builder = BUILDERS[def.shape];
  if (!builder) throw new Error(`No builder for shape: ${def.shape}`);
  builder(body, def, { seed, growth: g, shape: shape ?? 0, skin });
  if (skin) root.userData.skin = skin;

  if (def.category === CATEGORY.TANK) {
    // 水槽内レイアウト用の情報（ローカル座標）と子要素グループ
    root.userData.interior = body.userData.interior;
    const contents = new THREE.Group();
    contents.name = 'contents';
    root.add(contents);
  }
  return root;
}

/** 共有マテリアル以外のリソースを解放する */
export function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry && !child.geometry.userData.shared) child.geometry.dispose(); // 生き物の形は種類ごとに共有
    if (child.isInstancedMesh) child.dispose(); // 個体ごとの行列・色のバッファ
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// helpers

function mesh(geometry, material, { shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (material === MATERIALS.glass) {
    m.renderOrder = RENDER_ORDER.GLASS;
  } else if (material === MATERIALS.water) {
    m.renderOrder = RENDER_ORDER.WATER;
  } else if (shadow) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  return m;
}

function box(parent, w, h, d, material, x, y, z) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** 矩形の枠（上辺・下辺のフチ）を作る */
function rim(parent, w, d, y, thick, height) {
  const parts = [
    box(parent, w, height, thick, MATERIALS.frame, 0, y, d / 2 - thick / 2),
    box(parent, w, height, thick, MATERIALS.frame, 0, y, -d / 2 + thick / 2),
    box(parent, thick, height, d - thick * 2, MATERIALS.frame, w / 2 - thick / 2, y, 0),
    box(parent, thick, height, d - thick * 2, MATERIALS.frame, -w / 2 + thick / 2, y, 0),
  ];
  for (const m of parts) m.userData.rim = true; // フレームなし（オールガラス）で非表示にする
}

/** 箱型ガラス（前・後・左右・底）。ガラス厚 t を返す */
function glassBox(parent, w, h, d) {
  const t = THREE.MathUtils.clamp(Math.min(w, d) * 0.02, 0.004, 0.02);
  const g = MATERIALS.glass;
  box(parent, w, h, t, g, 0, h / 2, d / 2 - t / 2);
  box(parent, w, h, t, g, 0, h / 2, -d / 2 + t / 2);
  box(parent, t, h, d - 2 * t, g, w / 2 - t / 2, h / 2, 0);
  box(parent, t, h, d - 2 * t, g, -w / 2 + t / 2, h / 2, 0);
  box(parent, w - 2 * t, t, d - 2 * t, g, 0, t / 2, 0);
  const rimT = Math.max(0.008, t * 1.5);
  const rimH = Math.max(0.012, h * 0.04);
  rim(parent, w, d, h - rimH / 2, rimT, rimH);
  rim(parent, w, d, rimH / 2, rimT, rimH);
  return t;
}

// ---------------------------------------------------------------------------
// builders

function buildBoxTank(g, def) {
  const { w, h, d } = def.size;
  const t = glassBox(g, w, h, d);
  const iw = w - 2 * t - 0.002;
  const id = d - 2 * t - 0.002;
  const sandH = h * 0.07;
  const sand = box(g, iw, sandH, id, MATERIALS.sand, 0, t + sandH / 2, 0);
  sand.name = 'sand';
  sand.userData.sandBase = { y0: t, h: sandH, centered: true };
  g.userData.bottom = { kind: 'box', w: iw, d: id };
  const waterH = h * 0.9 - t;
  box(g, iw, waterH, id, MATERIALS.water, 0, t + waterH / 2, 0);
  addSurface(g, new THREE.PlaneGeometry(iw, id), t + waterH + 0.001);
  g.userData.interior = { shape: 'box', floorY: t + sandH, halfW: w / 2 - t, halfD: d / 2 - t, waterTop: t + waterH };
}

function buildCylinderTank(g, def) {
  const { w, h } = def.size;
  const r = w / 2;
  const baseH = Math.min(0.08, h * 0.07);
  const seg = 64;

  const base = mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.06, baseH, seg), MATERIALS.frame);
  base.position.y = baseH / 2;
  g.add(base);

  const glassH = h - baseH;
  const glass = mesh(new THREE.CylinderGeometry(r, r, glassH, seg, 1, true), MATERIALS.glass);
  glass.position.y = baseH + glassH / 2;
  g.add(glass);

  const ring = mesh(new THREE.TorusGeometry(r, Math.max(0.01, r * 0.02), 8, seg), MATERIALS.frame);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h;
  ring.userData.rim = true;
  g.add(ring);

  const sandH = h * 0.06;
  const sand = mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, sandH, seg), MATERIALS.sand);
  sand.position.y = baseH + sandH / 2;
  sand.name = 'sand';
  sand.userData.sandBase = { y0: baseH, h: sandH, centered: true };
  g.userData.bottom = { kind: 'circle', r: r * 0.985 };
  g.add(sand);

  const waterH = glassH * 0.92;
  const water = mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, waterH, seg), MATERIALS.water);
  water.position.y = baseH + waterH / 2;
  g.add(water);
  addSurface(g, new THREE.CircleGeometry(r * 0.985, 64), baseH + waterH + 0.001);
  g.userData.interior = { shape: 'cylinder', floorY: baseH + sandH, halfW: r, halfD: r, radius: r * 0.99, waterTop: baseH + waterH };
}

/** 断面（幅 w・高さ topH）にアーチ状の穴をあけた Shape */
function tunnelShape(w, topH, r, straightH) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, topH);
  s.lineTo(-w / 2, topH);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-r, 0);
  hole.lineTo(-r, straightH);
  hole.absarc(0, straightH, r, Math.PI, 0, true);
  hole.lineTo(r, 0);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

function buildTunnelTank(g, def) {
  const { w, h, d } = def.size;
  const r = Math.min(w * 0.28, h * 0.38);
  const straightH = Math.min(0.9, h - r - 0.5);

  // 水（アーチ穴付きの押し出し）
  const waterGeo = new THREE.ExtrudeGeometry(tunnelShape(w - 0.04, h * 0.93, r + 0.01, straightH), {
    depth: d - 0.04,
    bevelEnabled: false,
    curveSegments: 24,
  });
  waterGeo.translate(0, 0, -(d - 0.04) / 2);
  g.add(mesh(waterGeo, MATERIALS.water));
  addSurface(g, new THREE.PlaneGeometry(w - 0.04, d - 0.04), h * 0.93 + 0.001);

  // 前後ガラス（穴付き）
  const faceGeo = new THREE.ShapeGeometry(tunnelShape(w, h, r, straightH), 24);
  const front = mesh(faceGeo, MATERIALS.glass);
  front.position.z = d / 2;
  g.add(front);
  const back = mesh(faceGeo.clone(), MATERIALS.glass);
  back.position.z = -d / 2;
  g.add(back);

  // 左右ガラス
  const sideGeo = new THREE.PlaneGeometry(d, h);
  for (const sx of [-1, 1]) {
    const side = mesh(sideGeo.clone(), MATERIALS.glass);
    side.rotation.y = Math.PI / 2;
    side.position.set((sx * w) / 2, h / 2, 0);
    g.add(side);
  }
  sideGeo.dispose();

  // トンネル部分のガラス（半円筒 + 直線部）
  const arch = new THREE.CylinderGeometry(r, r, d, 48, 1, true, Math.PI / 2, Math.PI);
  arch.rotateX(Math.PI / 2);
  arch.translate(0, straightH, 0);
  const archMesh = mesh(arch, MATERIALS.glass);
  archMesh.userData.tunnelGlass = true;
  g.add(archMesh);
  for (const sx of [-1, 1]) {
    const wall = mesh(new THREE.PlaneGeometry(d, straightH), MATERIALS.glass);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(sx * r, straightH / 2, 0);
    wall.userData.tunnelGlass = true;
    g.add(wall);
  }

  // 通路と砂地
  box(g, r * 2, 0.04, d, MATERIALS.walkway, 0, 0.02, 0);
  const sandW = w / 2 - r - 0.02;
  for (const sx of [-1, 1]) {
    box(g, sandW, 0.18, d - 0.04, MATERIALS.sand, sx * (r + 0.01 + sandW / 2), 0.09, 0);
  }

  // フレーム（四隅の柱と上辺）
  const p = 0.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, p, h, p, MATERIALS.frame, sx * (w / 2 - p / 2), h / 2, sz * (d / 2 - p / 2)).userData.rim = true;
    }
  }
  rim(g, w, d, h - 0.04, p, 0.08);
  // tunnel: 通路の上のアーチにもオブジェを置ける（アーチ内側はクリップ）
  g.userData.interior = { shape: 'box', floorY: 0.18, halfW: w / 2 - 0.02, halfD: d / 2 - 0.02, waterTop: h * 0.93, tunnel: { r: r + 0.005, straightH } };
}

function buildMammalTank(g, def) {
  const { w, h, d } = def.size;
  const t = glassBox(g, w, h, d);
  const landW = w * def.landRatio;
  const poolW = w - 2 * t - landW;
  const id = d - 2 * t - 0.002;

  // 水域
  const waterH = h * 0.8;
  box(g, poolW, waterH, id, MATERIALS.water, -w / 2 + t + poolW / 2, t + waterH / 2, 0);
  addSurface(g, new THREE.PlaneGeometry(poolW, id), t + waterH + 0.001, -w / 2 + t + poolW / 2);
  box(g, poolW, 0.06, id, MATERIALS.sand, -w / 2 + t + poolW / 2, t + 0.03, 0);

  // 陸地（岩場）
  const landX = w / 2 - t - landW / 2;
  const landH = h * 0.92;
  box(g, landW, landH, id, MATERIALS.rock, landX, t + landH / 2, 0);
  // 決定的な配置の岩
  const rocks = [
    [-0.35, 0.3, 0.32], [0.1, -0.25, 0.28], [0.3, 0.2, 0.22], [-0.2, -0.3, 0.2],
  ];
  for (const [fx, fz, s] of rocks) {
    const rock = mesh(new THREE.DodecahedronGeometry(s, 0), MATERIALS.rock);
    rock.position.set(landX + fx * landW, t + landH + s * 0.3, fz * id);
    rock.rotation.set(fx * 3, fz * 5, 0.4);
    g.add(rock);
  }
  // 水へのスロープ
  const slope = mesh(new THREE.BoxGeometry(0.9, 0.08, id * 0.6), MATERIALS.rock);
  slope.position.set(landX - landW / 2 - 0.25, t + landH * 0.6, 0);
  slope.rotation.z = 0.5;
  g.add(slope);
  g.userData.interior = { shape: 'box', floorY: t + 0.06, halfW: w / 2 - t, halfD: d / 2 - t, waterTop: t + waterH, swim: { cx: -w / 2 + t + poolW / 2, halfW: poolW / 2 } };
}

function buildStand(g, def, { skin } = {}) {
  if (skin && skin !== 'wood') return buildStandSkin(g, def, skin); // 内装ガチャのデザイン
  const { w, h, d } = def.size;
  const topT = 0.04;
  box(g, w - 0.02, h - topT, d - 0.02, MATERIALS.wood, 0, (h - topT) / 2, 0);
  box(g, w, topT, d, MATERIALS.woodLight, 0, h - topT / 2, 0);
  // 扉の分割線
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) {
    const x = -w / 2 + (w / doors) * i;
    box(g, 0.006, h - topT - 0.06, 0.004, MATERIALS.frame, x, (h - topT) / 2, d / 2 - 0.008);
  }
}

function buildWall(g, def) {
  const { w, h, d } = def.size;
  box(g, w, h, d, MATERIALS.wall, 0, h / 2, 0);
  box(g, w + 0.01, 0.1, d + 0.02, MATERIALS.trim, 0, 0.05, 0);
  box(g, w + 0.01, 0.04, d + 0.02, MATERIALS.trim, 0, h - 0.02, 0);
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f3d5e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#e8f6ff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildEntrance(g, def) {
  const { w, h, d } = def.size;
  const pw = 0.4;
  box(g, pw, h, d, MATERIALS.trim, -w / 2 + pw / 2, h / 2, 0);
  box(g, pw, h, d, MATERIALS.trim, w / 2 - pw / 2, h / 2, 0);
  const lintelH = 0.5;
  box(g, w, lintelH, d, MATERIALS.trim, 0, h - lintelH / 2, 0);

  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('AQUARIUM'), roughness: 0.6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - pw * 2 - 0.1, lintelH * 0.75), signMat);
  sign.position.set(0, h - lintelH / 2, d / 2 + 0.002);
  g.add(sign);

  const mat = mesh(new THREE.BoxGeometry(w - pw * 2, 0.01, d + 0.8), MATERIALS.walkway);
  mat.position.y = 0.005;
  g.add(mat);
}

/** 階段（階の移動用）。手前(+z)から奥へ12段で上る。段鼻の滑り止めと、両側の支柱・斜めの手すり */
function buildStairs(g, def) {
  const { w, h, d } = def.size;
  const n = 12;
  const rise = h / n;
  const run = d / n;
  for (let k = 0; k < n; k++) {
    const top = rise * (k + 1);
    box(g, w, top, run, MATERIALS.wall, 0, top / 2, d / 2 - run * (k + 0.5));
    box(g, w, 0.02, 0.05, MATERIALS.trim, 0, top + 0.01, d / 2 - run * k - 0.03);
  }
  const len = Math.hypot(d, h);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.04);
    for (const t of [0.06, 0.5, 0.94]) box(g, 0.04, 0.9, 0.04, MATERIALS.trim, x, h * t + 0.45, d / 2 - d * t);
    box(g, 0.05, 0.05, len, MATERIALS.trim, x, h / 2 + 0.9, 0).rotation.x = Math.atan2(h, d);
  }
}

/** 飼育員用ドア（壁に埋め込んで使う。両面に枠とドア） */
function buildStaffDoor(g, def) {
  const { w, h, d } = def.size;
  const frameW = 0.06;
  box(g, frameW, h, d, MATERIALS.trim, -w / 2 + frameW / 2, h / 2, 0);
  box(g, frameW, h, d, MATERIALS.trim, w / 2 - frameW / 2, h / 2, 0);
  box(g, w, frameW, d, MATERIALS.trim, 0, h - frameW / 2, 0);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d6, roughness: 0.6, metalness: 0.2 });
  const door = mesh(new THREE.BoxGeometry(w - frameW * 2, h - frameW, 0.04), doorMat);
  door.position.set(0, (h - frameW) / 2, 0);
  g.add(door);
  // 小窓・取っ手・表示（両面）
  const winMat = new THREE.MeshStandardMaterial({ color: 0x9fc3d8, roughness: 0.1, metalness: 0.3 });
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('STAFF ONLY'), roughness: 0.6 });
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), winMat);
    win.position.set(0, h * 0.7, side * 0.021);
    if (side < 0) win.rotation.y = Math.PI;
    const knob = mesh(new THREE.SphereGeometry(0.025, 10, 8), MATERIALS.frame);
    knob.position.set(w / 2 - 0.16, h * 0.47, side * 0.04);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), signMat);
    sign.position.set(0, h * 0.86, side * 0.022);
    if (side < 0) sign.rotation.y = Math.PI;
    g.add(win, knob, sign);
  }
}

const BUILDERS = {
  staffDoor: buildStaffDoor,
  box: buildBoxTank,
  cylinder: buildCylinderTank,
  poly: buildPolyTank,
  tunnel: buildTunnelTank,
  mammal: buildMammalTank,
  stand: buildStand,
  souvenirShop: buildSouvenirShop,
  cafe: buildCafe,
  researchLab: buildResearchLab,
  breedingTank: buildBreedingTank,
  waterPlant: buildWaterPlant,
  cleanCenter: buildCleanCenter,
  freezer: buildFreezer,
  liveFeed: buildLiveFeed,
  foodPrep: buildFoodPrep,
  wall: buildWall,
  entrance: buildEntrance,
  stairs: buildStairs,
  liveRock: buildLiveRock,
  driftwood: buildDriftwood,
  flora: buildFlora,
  airstone: buildAirstone,
  ...DECOR_BUILDERS,
};

/** 見た目（デザイン）を変えて体を作り直す。水槽台・説明プレートのデザインの差し替え用 */
export function rebuildBody(obj, def, opts = {}) {
  const old = obj.getObjectByName('body');
  const body = new THREE.Group();
  body.name = 'body';
  if (old) {
    body.position.copy(old.position);
    obj.remove(old);
    disposeObject(old);
  }
  obj.add(body);
  BUILDERS[def.shape](body, def, opts);
  if (opts.skin) obj.userData.skin = opts.skin;
  else delete obj.userData.skin;
}
