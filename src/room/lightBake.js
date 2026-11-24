import * as THREE from 'three';
import { CELL } from './floorPlan.js';

/**
 * 室内照明の焼き付け（ライトマップ）。照明の光が床・壁・天井に広がる明るさを、照明を変えたときだけ CPU で計算して
 * テクスチャに書き込み、各面の lightMap に使う。毎フレームの光源計算と影がいらないので、照明の数に上限を設けない。
 * 照明は置いた部屋（エリア）の中だけを照らす（隣の部屋へは漏れない）。
 * 明るさの式は three.js のスポットライト（減衰なし・半影0.6）と同じ：強さ × 色 × N・L × 円錐の減衰。
 * それに、照らした所から周りへ回り込む柔らかい光（SPILL：距離で弱まる全方向の光）を足して、壁や天井にも光が広がるようにする。
 */
/** 1マスあたりの床・天井のテクセル数 */
export const FLOOR_RES = 3;
/** 壁の 1m あたりのテクセル数 */
export const WALL_RES = 4;
/** テクスチャに入れる明るさの上限（8bit に収めるための倍率。lightMapIntensity に使う） */
export const LM_SCALE = 8;
const ATLAS_W = 1024;
const PENUMBRA = 0.6;
/** 天井の地の明るさ（MeshBasicMaterial の lightMap は 1/π 倍されるので π で白） */
const CEIL_BASE = Math.PI;
/** 回り込む光の強さ（強さに対する割合）と、半分の明るさになる距離(m) */
const SPILL = 0.18;
const SPILL_D = 2.5;

/** RGBA 8bit のライトマップ用テクスチャ */
function dataTexture(w, h) {
  const tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat);
  tex.channel = 1; // uv1 を使う
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 照明1灯の計算用の値 */
function prep(l, zoneIndex) {
  const c = new THREE.Color(l.color);
  const I = l.intensity * 3;
  const P = new THREE.Vector3(l.x, l.height, l.z);
  const D = new THREE.Vector3(l.tx - l.x, -l.height, l.tz - l.z).normalize();
  const half = THREE.MathUtils.degToRad(l.angle / 2);
  const reach = Math.min(30, Math.max(SPILL_D * 3.2, Math.hypot(l.tx - l.x, l.tz - l.z) + l.height * Math.tan(Math.min(half, 1.35)) * 1.6 + 1.5));
  return { zi: zoneIndex, r: c.r * I, g: c.g * I, b: c.b * I, P, D, coneCos: Math.cos(half), penCos: Math.cos(half * (1 - PENUMBRA)), reach, cx: (l.x + l.tx) / 2, cz: (l.z + l.tz) / 2 };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 点 (qx,qy,qz)・法線 n への照明 p の明るさの倍率（N・L × 円錐） */
function shade(p, qx, qy, qz, nx, ny, nz) {
  const lx = p.P.x - qx;
  const ly = p.P.y - qy;
  const lz = p.P.z - qz;
  const d = Math.hypot(lx, ly, lz) || 1e-6;
  const ndl = (lx * nx + ly * ny + lz * nz) / d;
  if (ndl <= 0) return 0;
  const spill = (SPILL * ndl) / (1 + (d / SPILL_D) ** 2);
  const cosA = -(lx * p.D.x + ly * p.D.y + lz * p.D.z) / d;
  if (cosA <= p.coneCos) return spill;
  return ndl * smooth(p.coneCos, p.penCos, cosA) + spill;
}

export class LightBaker {
  constructor() {
    this.floorTex = null;
    this.ceilTex = null;
    this.wallTex = null;
    this.strips = [];
  }

  /** 床・天井のテクスチャ（敷地の格子全体）と、床の頂点の uv1 */
  floorUv(plan, x, z) {
    return [(x / plan.cell + plan.GX / 2) / plan.GX, (z / plan.cell + plan.Z0) / plan.GZ];
  }

  /**
   * 壁の割り付け：壁1面ごとに帯をアトラスへ詰め、ShapeGeometry の座標から uv1 を付ける。
   * walls: [{ mesh, len, H }]（mesh はワールド位置・回転が決まっていること）
   */
  layoutWalls(walls) {
    let x = 0;
    let y = 0;
    let rowH = 0;
    this.strips = [];
    for (const w of walls) {
      const sw = Math.max(2, Math.ceil(w.len * WALL_RES)) + 2;
      const sh = Math.max(2, Math.ceil(w.H * WALL_RES)) + 2;
      if (x + sw > ATLAS_W) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      this.strips.push({ ...w, ax: x, ay: y, sw, sh });
      x += sw;
      rowH = Math.max(rowH, sh);
    }
    const AH = Math.max(4, THREE.MathUtils.ceilPowerOfTwo(y + rowH));
    if (!this.wallTex || this.wallTex.image.height !== AH) {
      this.wallTex?.dispose();
      this.wallTex = dataTexture(ATLAS_W, AH);
    }
    for (const s of this.strips) {
      const pos = s.mesh.geometry.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let k = 0; k < pos.count; k++) {
        uv[k * 2] = (s.ax + 1 + (pos.getX(k) + s.len / 2) * WALL_RES) / ATLAS_W;
        uv[k * 2 + 1] = (s.ay + 1 + pos.getY(k) * WALL_RES) / AH;
      }
      s.mesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
      // 帯の向き：ローカル X 軸と法線（ワールド）
      const th = s.mesh.rotation.y;
      s.ux = Math.cos(th);
      s.uz = -Math.sin(th);
      s.nx = Math.sin(th);
      s.nz = Math.cos(th);
      s.ox = s.mesh.position.x;
      s.oz = s.mesh.position.z;
    }
  }

  /**
   * 焼き付け。plan: 今の階の FloorPlan、lights: [{ light, zoneIndex }]、H: 天井の高さ
   */
  bake(plan, lights, H) {
    const R = FLOOR_RES;
    const fw = plan.GX * R;
    const fh = plan.GZ * R;
    if (!this.floorTex || this.floorTex.image.width !== fw || this.floorTex.image.height !== fh) {
      this.floorTex?.dispose();
      this.ceilTex?.dispose();
      this.floorTex = dataTexture(fw, fh);
      this.ceilTex = dataTexture(fw, fh);
    }
    const floor = new Float32Array(fw * fh * 3);
    const ceil = new Float32Array(fw * fh * 3);
    const ps = lights.map(({ light, zoneIndex }) => prep(light, zoneIndex));
    const C = plan.cell;
    const tx = (x) => Math.floor((x / C + plan.GX / 2) * R);
    const ty = (z) => Math.floor((z / C + plan.Z0) * R);
    const inside = (i, j) => {
      const t = plan.at(i, j);
      return t === CELL.FLOOR || t === CELL.YARD;
    };
    for (const p of ps) {
      // 床：照らす範囲の四角の中で、照明と同じ部屋のテクセルだけ
      const x0 = Math.max(0, tx(Math.min(p.P.x, p.cx) - p.reach));
      const x1 = Math.min(fw - 1, tx(Math.max(p.P.x, p.cx) + p.reach));
      const y0 = Math.max(0, ty(Math.min(p.P.z, p.cz) - p.reach));
      const y1 = Math.min(fh - 1, ty(Math.max(p.P.z, p.cz) + p.reach));
      for (let j = y0; j <= y1; j++) {
        for (let i = x0; i <= x1; i++) {
          const ci = Math.floor(i / R);
          const cj = Math.floor(j / R);
          if (plan.zoneIds[plan.idx(ci, cj)] !== p.zi || !inside(ci, cj)) continue;
          const qx = ((i + 0.5) / R - plan.GX / 2) * C;
          const qz = ((j + 0.5) / R - plan.Z0) * C;
          const k = (j * fw + i) * 3;
          const f = shade(p, qx, 0, qz, 0, 1, 0);
          if (f > 0) {
            floor[k] += p.r * f;
            floor[k + 1] += p.g * f;
            floor[k + 2] += p.b * f;
          }
          // 天井：器具のまわりがほんのり明るくなる
          const d2 = (qx - p.P.x) ** 2 + (qz - p.P.z) ** 2;
          if (d2 < 4) {
            const h = 0.35 * Math.exp(-d2 / 0.5) / Math.max(1, H - p.P.y + 0.5);
            ceil[k] += p.r * h;
            ceil[k + 1] += p.g * h;
            ceil[k + 2] += p.b * h;
          }
        }
      }
    }
    this._write(this.floorTex, floor, 0);
    this._write(this.ceilTex, ceil, CEIL_BASE);
    this._bakeWalls(plan, ps);
  }

  _bakeWalls(plan, ps) {
    const tex = this.wallTex;
    if (!tex) return;
    const AW = tex.image.width;
    const AH = tex.image.height;
    const acc = new Float32Array(AW * AH * 3);
    for (const s of this.strips) {
      // 帯の各列が面している部屋（壁の少し手前のマス）
      const cols = s.sw;
      const zoneOf = new Int16Array(cols);
      for (let c = 0; c < cols; c++) {
        const u = Math.min(s.len / 2, Math.max(-s.len / 2, (c - 1 + 0.5) / WALL_RES - s.len / 2));
        const [ci, cj] = plan.cellOf(s.ox + s.ux * u + s.nx * 0.45, s.oz + s.uz * u + s.nz * 0.45);
        zoneOf[c] = plan.zoneIds[plan.idx(ci, cj)] ?? -1;
      }
      for (const p of ps) {
        // 壁の線分と照明の水平距離で、届かない壁を飛ばす
        const ax = s.ox - s.ux * (s.len / 2);
        const az = s.oz - s.uz * (s.len / 2);
        const t = Math.min(s.len, Math.max(0, (p.P.x - ax) * s.ux + (p.P.z - az) * s.uz));
        if (Math.hypot(ax + s.ux * t - p.P.x, az + s.uz * t - p.P.z) > p.reach) continue;
        for (let c = 0; c < cols; c++) {
          if (zoneOf[c] !== p.zi) continue;
          const u = Math.min(s.len / 2, Math.max(-s.len / 2, (c - 1 + 0.5) / WALL_RES - s.len / 2));
          const qx = s.ox + s.ux * u;
          const qz = s.oz + s.uz * u;
          for (let r = 0; r < s.sh; r++) {
            const v = Math.min(s.H, Math.max(0, (r - 1 + 0.5) / WALL_RES));
            const f = shade(p, qx, v, qz, s.nx, 0, s.nz);
            if (f <= 0) continue;
            const k = ((s.ay + r) * AW + s.ax + c) * 3;
            acc[k] += p.r * f;
            acc[k + 1] += p.g * f;
            acc[k + 2] += p.b * f;
          }
        }
      }
    }
    this._write(tex, acc, 0);
  }

  _write(tex, acc, base) {
    const out = tex.image.data;
    const k = 255 / LM_SCALE;
    for (let i = 0, n = acc.length / 3; i < n; i++) {
      out[i * 4] = Math.min(255, (acc[i * 3] + base) * k);
      out[i * 4 + 1] = Math.min(255, (acc[i * 3 + 1] + base) * k);
      out[i * 4 + 2] = Math.min(255, (acc[i * 3 + 2] + base) * k);
      out[i * 4 + 3] = 255;
    }
    tex.needsUpdate = true;
  }
}
