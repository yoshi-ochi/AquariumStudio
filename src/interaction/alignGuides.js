import * as THREE from 'three';
import { TankManager } from '../tanks/tankManager.js';
import { ZONES, ZONE_TYPE, CELL_SIZE, GRID_X, GRID_Z, GRID_Z0 } from '../building/blueprint.js';

/**
 * 館内レイアウトの整列ガイド。
 * - 近くの水槽・オブジェの縁と中心に、動かしている物の縁と中心を吸着させ、ガイド線を伸ばす
 * - 吸着して 1.5 秒たつと解除し、微調整できるようにする（離れると再び吸着）
 * - 解放済みエリアの縦横の中央に、壁まで届く十字線を出す
 */
const SNAP_DIST = 0.12; // m
const RELEASE_MS = 1500;
const LINE_Y = 0.02;
const GUIDE_COLOR = 0xff8a1f;
const CENTER_COLOR = 0x2b8fd6;

/**
 * 床に沿った帯で線を描く（WebGL の線は1pxで見えにくいため）。常に手前に描く。
 * width: 帯の幅(m)、dash: [線, 間](m) で破線
 */
function lines(color, opacity, width, dash = null) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  m.renderOrder = 998;
  m.frustumCulled = false;
  m.raycast = () => {};
  m.visible = false;
  m.userData.band = { width, dash };
  return m;
}

/** pts: 線分ごとに [x0,y,z0, x1,y,z1] */
function setSegments(mesh, pts) {
  const { width, dash } = mesh.userData.band;
  const pos = [];
  const quad = (ax, az, bx, bz, y) => {
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / len) * (width / 2);
    const nz = ((bx - ax) / len) * (width / 2);
    pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  };
  for (let i = 0; i < pts.length; i += 6) {
    const [ax, y, az, bx, , bz] = pts.slice(i, i + 6);
    if (!dash) {
      quad(ax, az, bx, bz, y);
      continue;
    }
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < len; s += dash[0] + dash[1]) {
      const e = Math.min(len, s + dash[0]);
      quad(ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len, ax + ((bx - ax) * e) / len, az + ((bz - az) * e) / len, y);
    }
  }
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mesh.visible = pos.length > 0;
}

/** 物の外形（床の上で回転を考えた箱） */
const boundsOf = (def, rotY, x, z) => {
  const { hx, hz } = TankManager.footprintHalf(def, rotY);
  return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, cx: x, cz: z };
};

export class AlignGuides {
  constructor(scene, manager) {
    this.manager = manager;
    this.guides = lines(GUIDE_COLOR, 0.95, 0.04);
    this.centers = lines(CENTER_COLOR, 0.6, 0.05, [0.3, 0.2]);
    // 壁の中央線は壁の表面に沿わせ、壁の裏からは見えないよう奥行き判定する
    this.wallCenters = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: CENTER_COLOR, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.wallCenters.renderOrder = 997;
    this.wallCenters.raycast = () => {};
    this.wallCenters.visible = false;
    scene.add(this.guides, this.centers, this.wallCenters);
    this.reset();
  }

  /** ドラッグ・配置の始めに吸着状態を戻す */
  reset() {
    this.axis = { x: null, z: null }; // { value, since, released }
    this.hide();
  }

  hide() {
    this.guides.visible = false;
  }

  /**
   * 位置 (x,z) を周りの物の縁・中心へ吸着させる。
   * 戻り値 { x, z, snap: {x,z}, free: {x,z} }：snap は吸着した軸、free は解除中の軸（グリッドに合わせず細かく動かせる）
   */
  snap(def, rotY, x, z, exclude = []) {
    const me = boundsOf(def, rotY, x, z);
    const others = [...this.manager.objects.values()]
      .filter((o) => o.visible && o.userData.floor === this.manager.currentFloor && !exclude.includes(o) && !this.manager.defOf(o).atrium)
      .map((o) => ({ o, b: boundsOf(this.manager.defOf(o), o.rotation.y, o.position.x, o.position.z) }));
    const now = performance.now();
    const pts = [];
    const out = { x, z, snap: {}, free: {} };
    for (const [ax, keys] of [['x', ['x0', 'cx', 'x1']], ['z', ['z0', 'cz', 'z1']]]) {
      let best = null;
      for (const { b } of others) {
        for (const k of keys) for (const t of keys) {
          const delta = b[t] - me[k];
          if (Math.abs(delta) < SNAP_DIST && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, value: b[t], other: b };
        }
      }
      const st = this.axis[ax];
      // 解除した線から十分離れたら、また吸着できるようにする
      if (st?.released && Math.abs((ax === 'x' ? me.cx : me.cz) - st.anchor) > SNAP_DIST * 2) this.axis[ax] = null;
      if (!best) {
        if (!this.axis[ax]?.released) this.axis[ax] = null;
        continue;
      }
      // 吸着後の自分の位置で同じ吸着かを判断する（並んだ物の縁が重なっても計時を続ける）
      const center = ax === 'x' ? me.cx : me.cz;
      const target = center + best.delta;
      let cur = this.axis[ax];
      if (!cur || Math.abs(cur.value - target) > 1e-3) cur = this.axis[ax] = { value: target, since: now, released: false, anchor: center };
      if (!cur.released && now - cur.since >= RELEASE_MS) cur.released = true;
      if (cur.released) {
        out.free[ax] = true;
        continue;
      }
      out[ax] += best.delta;
      out.snap[ax] = true;
      // ガイド線：吸着した線に沿って、自分と相手の両方にかかる長さ
      const o = best.other;
      if (ax === 'x') {
        const z0 = Math.min(me.z0, o.z0) - 0.3;
        const z1 = Math.max(me.z1, o.z1) + 0.3;
        pts.push(best.value, LINE_Y, z0, best.value, LINE_Y, z1);
      } else {
        const x0 = Math.min(me.x0, o.x0) - 0.3;
        const x1 = Math.max(me.x1, o.x1) + 0.3;
        pts.push(x0, LINE_Y, best.value, x1, LINE_Y, best.value);
      }
    }
    setSegments(this.guides, pts);
    return out;
  }

  /** 壁ごとの中央に縦の破線（両面、床から1.2mまで） */
  showWallCenters(runs, visible = true) {
    if (!visible) {
      this.wallCenters.visible = false;
      return;
    }
    const pos = [];
    const W = 0.025;
    const H = 1.2;
    const OFF = 0.02;
    for (const run of runs) {
      if (!['exterior', 'partition', 'room'].includes(run.kind) || run.to - run.from < 1.2) continue;
      const mid = (run.from + run.to) / 2;
      for (const side of [-1, 1]) {
        for (let y = 0; y < H; y += 0.25) {
          const y1 = Math.min(H, y + 0.15);
          if (run.axis === 'x') {
            const z = run.line + side * OFF;
            pos.push(mid - W, y, z, mid + W, y, z, mid + W, y1, z, mid - W, y, z, mid + W, y1, z, mid - W, y1, z);
          } else {
            const x = run.line + side * OFF;
            pos.push(x, y, mid - W, x, y, mid + W, x, y1, mid + W, x, y, mid - W, x, y1, mid + W, x, y1, mid - W);
          }
        }
      }
    }
    this.wallCenters.geometry.dispose();
    this.wallCenters.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.wallCenters.visible = pos.length > 0;
  }

  /** 解放済みエリアの中央の十字線（その階だけ）。中央のマスから同じ種類の床が続く所＝壁まで伸ばす */
  showCenters(plan, unlocked, visible = true) {
    const floor = plan.floor;
    if (!visible) {
      this.centers.visible = false;
      return;
    }
    const pts = [];
    const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
    const wz = (j) => (j - GRID_Z0) * CELL_SIZE;
    for (const zone of ZONES) {
      if (zone.floor !== floor || !unlocked.has(zone.id) || zone.type === ZONE_TYPE.VOID) continue;
      for (const [i0, j0, i1, j1] of zone.rects) {
        // 細い通路（2マス以下）には出さない
        if (i1 - i0 < 3 || j1 - j0 < 3) continue;
        const ci = Math.floor((i0 + i1) / 2);
        const cj = Math.floor((j0 + j1) / 2);
        const t = plan.at(ci, cj);
        if (!t) continue;
        let a = ci;
        let b = ci;
        let c = cj;
        let d = cj;
        while (plan.at(a - 1, cj) === t && plan.passable(a - 1, cj, a, cj)) a--;
        while (plan.at(b + 1, cj) === t && plan.passable(b, cj, b + 1, cj)) b++;
        while (plan.at(ci, c - 1) === t && plan.passable(ci, c - 1, ci, c)) c--;
        while (plan.at(ci, d + 1) === t && plan.passable(ci, d, ci, d + 1)) d++;
        // 区画の中央（マス数が偶数でも線は区画の真ん中）
        const cx = (wx(i0) + wx(i1 + 1)) / 2;
        const cz = (wz(j0) + wz(j1 + 1)) / 2;
        pts.push(wx(a), LINE_Y, cz, wx(b + 1), LINE_Y, cz, cx, LINE_Y, wz(c), cx, LINE_Y, wz(d + 1));
      }
    }
    setSegments(this.centers, pts);
  }
}
