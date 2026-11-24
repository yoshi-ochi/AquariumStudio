import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL_SIZE, FLOOR_COUNT, GRID_X, GRID_Z, GRID_Z0, LAYOUT, STORY_H, ZONES, ZONE_TYPE, ATRIUM_TANK_POS, WING_GRID_CENTER, WING_RECT, getZone, zoneHas } from './blueprint.js';

/** 近代的な外観：ガラスのカーテンウォールと、間取りごとに形の違う白い大屋根 */
const TOP = STORY_H * FLOOR_COUNT;
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z0) * CELL_SIZE;

const MAT = {
  glass: new THREE.MeshStandardMaterial({ color: 0xa8dcea, metalness: 0.25, roughness: 0.08, transparent: true, opacity: 0.88 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x2e3f4b, metalness: 0.5, roughness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: 0.45, side: THREE.DoubleSide }),
  paving: new THREE.MeshStandardMaterial({ color: 0xd8d6cd, roughness: 0.95 }),
  water: new THREE.MeshStandardMaterial({ color: 0x39a7c9, metalness: 0.2, roughness: 0.12 }),
  green: new THREE.MeshStandardMaterial({ color: 0x5d9c58, roughness: 0.95 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x77604a, roughness: 0.9 }),
};
Object.values(MAT).forEach((m) => (m.userData.shared = true));

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** fn(u, v) → [x, y, z] の曲面 */
function surface(nu, nv, fn) {
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i;
    const c = a + nu + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 本館（地上の階）のエリア。地下・別館・左の売店や食堂・屋外のバックヤードは含めない */
const OUTDOOR_YARDS = ['yard0', 'poolyard'];
const buildingZones = () => ZONES.filter((z) => z.type !== ZONE_TYPE.OUTDOOR && z.floor < FLOOR_COUNT && !z.facility && !z.wing && !z.auto && !OUTDOOR_YARDS.includes(z.id));

/** 全エリアの外接矩形（ワールド座標） */
function footprint() {
  const rects = buildingZones().flatMap((z) => z.rects);
  return {
    x0: wx(Math.min(...rects.map((r) => r[0]))), z0: wz(Math.min(...rects.map((r) => r[1]))),
    x1: wx(Math.max(...rects.map((r) => r[2])) + 1), z1: wz(Math.max(...rects.map((r) => r[3])) + 1),
  };
}

/** 外周に沿ってガラス面と縦の方立てを並べる */
function curtainWall(group, TOP_ = TOP) {
  const TOP = TOP_;
  const solid = (i, j) => buildingZones().some((z) => zoneHas(z, i, j));
  const edges = [];
  for (let j = 0; j < GRID_Z; j++) for (let i = 0; i < GRID_X; i++) {
    if (!solid(i, j)) continue;
    if (!solid(i, j + 1)) edges.push([wx(i) + CELL_SIZE / 2, wz(j + 1), 0]);
    if (!solid(i, j - 1)) edges.push([wx(i) + CELL_SIZE / 2, wz(j), 0]);
    if (!solid(i + 1, j)) edges.push([wx(i + 1), wz(j) + CELL_SIZE / 2, Math.PI / 2]);
    if (!solid(i - 1, j)) edges.push([wx(i), wz(j) + CELL_SIZE / 2, Math.PI / 2]);
  }
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, TOP, 0.05), MAT.glass, edges.length);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, TOP, 0.14), MAT.white, edges.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  edges.forEach(([x, z, r], k) => {
    q.setFromAxisAngle(up, r);
    m.compose(new THREE.Vector3(x, TOP / 2, z), q, new THREE.Vector3(1, 1, 1));
    panels.setMatrixAt(k, m);
    fins.setMatrixAt(k, m);
  });
  group.add(panels, fins);
  // 各階の床の高さに白い帯（スパンドレル）、いちばん上に笠木（パラペット）、足元に黒い幅木
  const lines = [];
  for (let y = STORY_H; y < TOP - 0.01; y += STORY_H) lines.push([y, 0.5, 0.16, MAT.white]);
  lines.push([TOP + 0.35, 0.7, 0.22, MAT.white], [0.15, 0.3, 0.1, MAT.frame]);
  for (const [y, h, t, material] of lines) {
    const band = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE + 0.01, h, t), material, edges.length);
    edges.forEach(([x, z, r], k) => {
      q.setFromAxisAngle(up, r);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      band.setMatrixAt(k, m);
    });
    group.add(band);
  }
}

/** 屋上：空調の室外機・換気塔・点検用の通路（2階のある区画の屋上に並べる） */
function rooftop(group) {
  const parts = [];
  const fans = [];
  for (const z of ZONES.filter((x) => x.floor === 1 && x.type === ZONE_TYPE.YARD)) {
    for (const [x0, z0, x1, z1] of z.rects) {
      const w = (x1 - x0 + 1) * CELL_SIZE;
      const d = (z1 - z0 + 1) * CELL_SIZE;
      const n = Math.max(1, Math.floor(w / 5));
      for (let i = 0; i < n; i++) {
        const x = wx(x0) + (i + 0.5) * (w / n);
        const cz = wz(z0) + d / 2;
        parts.push(box(2.2, 1.2, 1.4, x, TOP + 0.95, cz));
        fans.push(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14).translate(x - 0.5, TOP + 1.6, cz), new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14).translate(x + 0.5, TOP + 1.6, cz));
      }
      // 点検通路
      parts.push(box(w - 1, 0.08, 0.8, wx(x0) + w / 2, TOP + 0.38, wz(z0) + d / 2 + 1.3));
    }
  }
  if (parts.length) group.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.6 })));
  if (fans.length) group.add(new THREE.Mesh(mergeGeometries(fans), MAT.frame));
}

/** 各階の白いスラブと屋上 */
function slabs(group) {
  const parts = [];
  for (const zone of buildingZones()) for (const [x0, z0, x1, z1] of zone.rects) {
    const w = (x1 - x0 + 1) * CELL_SIZE;
    const d = (z1 - z0 + 1) * CELL_SIZE;
    const y = zone.floor === 0 ? STORY_H : TOP;
    parts.push(box(w + 0.7, 0.34, d + 0.7, wx(x0) + w / 2, y, wz(z0) + d / 2));
  }
  group.add(new THREE.Mesh(mergeGeometries(parts), MAT.white));
}

function entranceCanopy(group) {
  const [x0, , x1, z1] = getZone('entrance').rects[0];
  const cx = (wx(x0) + wx(x1 + 1)) / 2;
  const w = (x1 - x0 + 1) * CELL_SIZE + 3;
  const z = wz(z1 + 1);
  const canopy = surface(16, 4, (u, v) => [cx + (u - 0.5) * w, STORY_H + 0.2 + Math.sin(u * Math.PI) * 0.9 - v * 0.5, z + v * 6]);
  group.add(new THREE.Mesh(canopy, MAT.white));
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, STORY_H, 10), MAT.frame);
    col.position.set(cx + s * (w / 2 - 1), STORY_H / 2, z + 5.2);
    group.add(col);
  }
  // 館名の看板
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#10374f';
  c.fillRect(0, 0, 1024, 128);
  c.fillStyle = '#fff';
  c.font = '700 76px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('A Q U A R I U M', 512, 68);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.12), new THREE.MeshBasicMaterial({ map }));
  sign.position.set(cx, TOP - 1.1, z + 0.2);
  group.add(sign);
}

/** 広場・水盤・植栽 */
function grounds(group) {
  const b = footprint();
  const m = 7;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + m * 2, b.z1 - b.z0 + m * 2 + 6).rotateX(-Math.PI / 2), MAT.paving);
  plaza.position.set((b.x0 + b.x1) / 2, 0.01, (b.z0 + b.z1) / 2 + 3);
  group.add(plaza);
  for (const s of [-1, 1]) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 4).rotateX(-Math.PI / 2), MAT.water);
    pool.position.set((b.x0 + b.x1) / 2 + s * 11, 0.03, b.z1 + 6);
    group.add(pool);
  }
  const trees = [];
  for (let k = 0; k < 14; k++) trees.push([b.x0 - 4 + (k / 13) * (b.x1 - b.x0 + 8), b.z1 + 11]);
  for (let k = 0; k < 8; k++) for (const x of [b.x0 - 4.5, b.x1 + 4.5]) trees.push([x, b.z0 + (k / 7) * (b.z1 - b.z0)]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 6), MAT.trunk, trees.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 1), MAT.green, trees.length);
  const mx = new THREE.Matrix4();
  trees.forEach(([x, z], k) => {
    trunk.setMatrixAt(k, mx.makeTranslation(x, 1.1, z));
    crown.setMatrixAt(k, mx.makeTranslation(x, 3, z));
  });
  group.add(trunk, crown);
}

// ---- 間取りごとの大屋根 ------------------------------------------------------

/** 大水槽（高さ10m）より上に屋根を架ける高さ */
const TANK_TOP = 10.6;
/** 大水槽ホールの大きさ（ワールド座標の半幅） */
function atriumHalf() {
  const [x0, z0, x1, z1] = getZone('atrium').rects[0];
  return { hx: ((x1 - x0 + 1) * CELL_SIZE) / 2, hz: ((z1 - z0 + 1) * CELL_SIZE) / 2 };
}

/** 回遊らせん型：大水槽を包むガラスの塔と、巻き上がる白いリボン */
function spiralRoof(group) {
  const { x, z } = ATRIUM_TANK_POS;
  const { hx, hz } = atriumHalf();
  const R = Math.hypot(hx, hz) * 0.78;
  const H = TANK_TOP + 4;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true), MAT.glass);
  drum.position.set(x, H / 2, z);
  const pts = [];
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 7;
    pts.push(new THREE.Vector3(x + Math.cos(a) * (R + 0.6), 0.8 + (k / 96) * (H - 0.8), z + Math.sin(a) * (R + 0.6)));
  }
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.5, 6), MAT.white);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R + 0.5, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1), MAT.white);
  cap.position.set(x, H, z);
  group.add(drum, ribbon, cap);
}

/** 海の旅路型：建物全体を覆う波の大屋根 */
function waveRoof(group) {
  const b = footprint();
  const roof = surface(44, 18, (u, v) => {
    const x = b.x0 - 3 + u * (b.x1 - b.x0 + 6);
    const z = b.z0 - 2 + v * (b.z1 - b.z0 + 4);
    return [x, TANK_TOP + 1.6 + Math.sin(u * Math.PI * 3 + v * 1.4) * 1.5 + (1 - u) * 2.4, z];
  });
  group.add(new THREE.Mesh(roof, MAT.white));
}

/** 放射ギャラリー型：ガラスのドームと、展示棟に架かる白い帆 */
function domeRoof(group) {
  const { x, z } = ATRIUM_TANK_POS;
  const { hx, hz } = atriumHalf();
  // 大ホールを覆う楕円のドーム（大水槽より上まで）
  const dome = new THREE.Group();
  dome.add(new THREE.Mesh(new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass));
  for (let k = 0; k < 12; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.004, 0.004, 6, 36, Math.PI), MAT.white);
    rib.rotation.y = (k / 12) * Math.PI;
    dome.add(rib);
  }
  dome.position.set(x, TOP, z);
  dome.scale.set(hx + 0.5, TANK_TOP - TOP + 4, hz + 0.5);
  group.add(dome);
  for (const id of ['coast', 'subtropical', 'entrance']) {
    const [x0, z0, x1, z1] = getZone(id).rects[0];
    const alongX = x1 - x0 >= z1 - z0;
    const sail = surface(20, 8, (u, v) => {
      const lift = Math.sin((alongX ? v : u) * Math.PI) * 2.4;
      return [wx(x0) - 0.6 + u * (wx(x1 + 1) - wx(x0) + 1.2), TOP + 0.5 + lift, wz(z0) - 0.6 + v * (wz(z1 + 1) - wz(z0) + 1.2)];
    });
    group.add(new THREE.Mesh(sail, MAT.white));
  }
}

/** 分棟パビリオン型：棟ごとの薄いシェル屋根と、中庭の水盤 */
function shellRoofs(group) {
  for (const id of ['coast', 'subtropical', 'atrium', 'yard1']) {
    const [x0, z0, x1, z1] = getZone(id).rects[0];
    const w = wx(x1 + 1) - wx(x0) + 2;
    const d = wz(z1 + 1) - wz(z0) + 2;
    const base = id === 'atrium' ? TANK_TOP + 2.4 : TOP + 2.2; // 大水槽の上は高く
    const shell = surface(24, 24, (u, v) => {
      const a = u * 2 - 1;
      const b = v * 2 - 1;
      return [wx(x0) - 1 + u * w, base + (a * a - b * b) * 2.2, wz(z0) - 1 + v * d];
    });
    group.add(new THREE.Mesh(shell, MAT.white));
  }
  const lagoon = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), MAT.water);
  lagoon.scale.set(6, 1, 5);
  // 入口へ向かう渡り廊下の両脇（大水槽ホールと入口の間の中庭）に水盤
  const [ex0, ez0, ex1] = getZone('entrance').rects[0];
  const [, , , az1] = getZone('atrium').rects[0];
  const mid = (wx(ex0) + wx(ex1 + 1)) / 2;
  for (const s of [-1, 1]) {
    const pond = lagoon.clone();
    pond.position.set(mid + s * 12, 0.04, (wz(az1 + 1) + wz(ez0)) / 2);
    group.add(pond);
  }
}

const ROOFS = { spiral: spiralRoof, descent: waveRoof, radial: domeRoof, pavilion: shellRoofs };

/** 別館：イルカプールの奥に建つ、周りをバックヤードが囲む約34m四方のガラスの棟（階数ぶんの高さ） */
/** 別館の中心（ワールド座標。間取りの格子上の区画の中心） */
export const wingCenter = () => ({ x: WING_GRID_CENTER.x, z: WING_GRID_CENTER.z });

function wing(group, floors) {
  const { x, z } = wingCenter();
  const S = (WING_RECT[2] - WING_RECT[0] + 1) * CELL_SIZE;
  const H = floors * STORY_H;
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(S + 8, S + 8).rotateX(-Math.PI / 2), MAT.paving);
  paving.position.set(x, 0.012, z);
  // ガラスの外壁（四面）と、角と各面の方立て
  const glass = new THREE.Mesh(new THREE.BoxGeometry(S, H, S).translate(x, H / 2, z), MAT.glass);
  const parts = [];
  for (let k = 0; k <= floors; k++) parts.push(box(S + 0.8, 0.36, S + 0.8, x, k * STORY_H, z));
  const n = 10;
  for (let k = 0; k <= n; k++) {
    const t = -S / 2 + (S * k) / n;
    parts.push(box(0.08, H, 0.16, x + t, H / 2, z - S / 2), box(0.08, H, 0.16, x + t, H / 2, z + S / 2));
    parts.push(box(0.16, H, 0.08, x - S / 2, H / 2, z + t), box(0.16, H, 0.08, x + S / 2, H / 2, z + t));
  }
  // 屋上の機械室と、南（プール側）の入口のひさし
  parts.push(box(S * 0.3, 2.4, S * 0.2, x + S * 0.2, H + 1.2, z - S * 0.15));
  parts.push(box(6, 0.25, 3, x, 3, z + S / 2 + 1.5));
  group.add(paving, glass, new THREE.Mesh(mergeGeometries(parts), MAT.white));
  // 棟名の看板（正面＝本館側）
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#10374f';
  c.fillRect(0, 0, 512, 128);
  c.fillStyle = '#fff';
  c.font = '700 64px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`別館 ${floors}F`, 256, 68);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const s of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map }));
    sign.position.set(x + s * 9, H - 1.2, z + S / 2 + 0.12);
    group.add(sign);
  }
}

/** 左の売店・食堂：平屋のガラスの棟と白い屋根（屋外バックヤードは屋根なし） */
function sidePavilions(group) {
  const parts = [];
  for (const id of ['store', 'diner']) {
    const [x0, z0, x1, z1] = getZone(id)?.rects[0] ?? [];
    if (x0 == null) continue;
    const w = (x1 - x0 + 1) * CELL_SIZE;
    const d = (z1 - z0 + 1) * CELL_SIZE;
    const cx = wx(x0) + w / 2;
    const cz = wz(z0) + d / 2;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(w, STORY_H, d).translate(cx, STORY_H / 2, cz), MAT.glass));
    parts.push(box(w + 0.6, 0.34, d + 0.6, cx, STORY_H, cz));
  }
  if (parts.length) group.add(new THREE.Mesh(mergeGeometries(parts), MAT.white));
}

/** 上の階を見ているときに、その下の階の外壁（ガラスと方立て）を1階分の高さで出す。高さは scale.y で階数分に伸ばす */
export function buildLowerShell() {
  const g = new THREE.Group();
  g.name = 'lower-shell';
  curtainWall(g, STORY_H);
  sidePavilions(g); // 左の売店・食堂（平屋）
  return g;
}

/** 各階の表示で、本館の裏に建つ別館の外観だけを出す */
export function buildWingShell(floors) {
  const g = new THREE.Group();
  g.name = 'wing-shell';
  if (floors) wing(g, floors);
  return g;
}

export class Exterior {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'exterior';
    this.group.visible = false;
    scene.add(this.group);
  }

  /** 選択中の間取りの外観を作り直す */
  build() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && !o.material.userData.shared) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.group.clear();
    grounds(this.group);
    curtainWall(this.group);
    slabs(this.group);
    entranceCanopy(this.group);
    sidePavilions(this.group);
    rooftop(this.group);
    ROOFS[LAYOUT.style](this.group);
    if (this.wings) wing(this.group, this.wings);
    this.key = `${LAYOUT.id}:${this.wings}`;
  }

  /** wings: 建設済みの別館の階数 */
  show(v, wings = 0) {
    this.wings = wings;
    if (v && this.key !== `${LAYOUT.id}:${wings}`) this.build();
    this.group.visible = v;
  }
}
