import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * イルカプールの観客席（スタジアム）。実際の水族館のショースタジアムにならい、
 *   コンクリートの段床・1席ずつの椅子（前列はずぶ濡れ席の色）・客席を区切る通路の階段と手すり、
 *   最上段の通路と転落防止の柵、客席の上半分を覆う膜屋根と柱、ステージ奥の大型ビジョンを作る。
 * 客席は南（建物側）へ半円に広がり、X 方向は楕円に合わせて xScale 倍に伸ばす。
 */
const mat = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const M = {
  concrete: mat(0xc9ccc8, 0.95, { side: THREE.DoubleSide }),
  seat: mat(0x2f7fb5, 0.6),
  splash: mat(0x46b6d6, 0.6),
  rail: mat(0xb8c2c8, 0.35, { metalness: 0.6 }),
  roof: mat(0xf4f6f6, 0.5, { side: THREE.DoubleSide }),
  steel: mat(0x8e9aa2, 0.4, { metalness: 0.5 }),
  dark: mat(0x1c252c, 0.5),
};

export function buildStadium({ tiers = 12, seatTop = 7.2, r0 = 5.7, step = 0.45, xScale = 1.55 }) {
  const g = new THREE.Group();
  const rise = seatTop / tiers;
  const at = (r, phi, y) => new THREE.Vector3(Math.sin(phi) * r * xScale, y, Math.cos(phi) * r);
  // 段床：各段の踏み面と蹴上げ（半円の回転体を楕円に伸ばす）
  const outline = [];
  for (let k = 0; k < tiers; k++) {
    const r = r0 + k * step;
    outline.push(new THREE.Vector2(r, k * rise), new THREE.Vector2(r, (k + 1) * rise));
  }
  const rMax = r0 + tiers * step;
  // 最上段の通路まで。背面は壁にせず、段床の下は回廊（1階分の高さがとれる所）として使う
  outline.push(new THREE.Vector2(rMax + 1.2, seatTop));
  const steps = new THREE.Mesh(new THREE.LatheGeometry(outline, 64, -Math.PI / 2, Math.PI), M.concrete);
  steps.scale.x = xScale;
  steps.receiveShadow = true;
  g.add(steps);

  // 通路（半円の客席を5ブロックに分ける階段）の角度。客席は -π/2〜π/2 の範囲
  const AISLES = [-0.3, -0.1, 0.1, 0.3].map((k) => k * Math.PI);
  const nearAisle = (phi, r) => AISLES.some((a) => Math.abs(phi - a) * r * 1.2 < 0.45);
  // 椅子：座面と背もたれを1つの形にして、まとめて並べる
  const seatGeo = mergeGeometries([new THREE.BoxGeometry(0.42, 0.06, 0.38).translate(0, 0.42, 0), new THREE.BoxGeometry(0.42, 0.4, 0.06).translate(0, 0.62, 0.18), new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, 0)]);
  const spots = [];
  for (let k = 0; k < tiers - 1; k++) {
    const r = r0 + k * step + step * 0.45;
    const n = Math.floor((Math.PI * r * 1.25) / 0.52);
    for (let i = 0; i <= n; i++) {
      const phi = -Math.PI / 2 + 0.06 + (i / n) * (Math.PI - 0.12);
      if (nearAisle(phi, r)) continue;
      spots.push({ p: at(r, phi, (k + 1) * rise), phi, splash: k < 3 });
    }
  }
  for (const splash of [true, false]) {
    const list = spots.filter((s) => s.splash === splash);
    const seats = new THREE.InstancedMesh(seatGeo, splash ? M.splash : M.seat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((s, i) => {
      q.setFromAxisAngle(up, s.phi); // 背もたれを外側へ（プールの方を向く）
      m.compose(s.p, q, new THREE.Vector3(1, 1, 1));
      seats.setMatrixAt(i, m);
    });
    seats.castShadow = true;
    g.add(seats);
  }
  // 通路の手すり（階段の両脇の支柱と、段に沿った手すり）
  const rails = [];
  for (const a of AISLES) {
    for (const off of [-0.035, 0.035]) {
      const pts = [];
      for (let k = 0; k <= tiers; k++) pts.push(at(r0 + k * step, a + off, k * rise + 0.9));
      rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), tiers * 2, 0.025, 5));
      for (let k = 0; k <= tiers; k += 3) {
        const p = at(r0 + k * step, a + off, k * rise);
        rails.push(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5).translate(p.x, p.y + 0.45, p.z));
      }
    }
  }
  // 最上段の通路の柵と、最前列（プール側）の柵
  for (const [r, y] of [[rMax + 1.1, seatTop], [r0 - 0.05, 0]]) {
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(at(r, -Math.PI / 2 + (i / 48) * Math.PI, y + 1.05));
    rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.03, 5));
    for (let i = 0; i <= 24; i++) {
      const p = at(r, -Math.PI / 2 + (i / 24) * Math.PI, y);
      rails.push(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 5).translate(p.x, y + 0.52, p.z));
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(rails.map((x) => x.toNonIndexed ? x.toNonIndexed() : x)), M.rail));

  // 膜屋根：客席の上半分を覆い、背面の柱で支える（ステージ側へ少し下がる）
  const roofR0 = r0 + tiers * step * 0.45;
  const roofPts = [new THREE.Vector2(roofR0, seatTop + 3.2), new THREE.Vector2(rMax + 1.2, seatTop + 4.2)];
  const roof = new THREE.Mesh(new THREE.LatheGeometry(roofPts, 48, -Math.PI / 2, Math.PI), M.roof);
  roof.scale.x = xScale;
  g.add(roof);
  const cols = [];
  for (let i = 0; i <= 8; i++) {
    const p = at(rMax + 1.0, -Math.PI / 2 + (i / 8) * Math.PI, 0);
    cols.push(new THREE.CylinderGeometry(0.16, 0.2, seatTop + 4.2, 8).translate(p.x, (seatTop + 4.2) / 2, p.z));
  }
  g.add(new THREE.Mesh(mergeGeometries(cols), M.steel));
  return g;
}

/** ステージ奥の大型ビジョンと背景の壁（プールの北側） */
export function buildBackdrop({ width = 16, z = -6.4 }) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 6, 0.4), mat(0x2b5f86, 0.8));
  wall.position.set(0, 3, z);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 2.6, 0.1), M.dark);
  screen.position.set(0, 3.9, z + 0.25);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.43, 2.4), new THREE.MeshBasicMaterial({ color: 0x3fa9d8 }));
  glow.position.set(0, 3.9, z + 0.31);
  // 飛び込み台と、跳躍の高さを見せるボール
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), mat(0xe8eef0, 0.7));
  tower.position.set(-width * 0.38, 1.1, z + 1);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 10), mat(0xf2c230, 0.5));
  ball.position.set(width * 0.2, 5.2, z + 3.5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), M.steel);
  pole.position.set(width * 0.2, 6.6, z + 3.5);
  g.add(wall, screen, glow, tower, ball, pole);
  return g;
}
