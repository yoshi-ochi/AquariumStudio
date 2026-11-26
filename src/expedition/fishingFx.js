import * as THREE from 'three';
import { BED, clamp01, fishSet, lerp, particles } from './gearKit.js';

/** 魚の群れ。set() で指定した位置へ少しずつ移動し、進む向きへ頭を向ける */
export class School {
  constructor(group, { count = 110, color = 0xdce8ee, len = 1, floor = BED } = {}) {
    this.n = count;
    this.mesh = fishSet(group, count, color, len);
    this.floor = floor;
    this.c = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.r = 6;
    this.tr = 6;
    this.flat = 0.32;
    this.size = 1;
    this.hold = false; // 流れに頭を向けて定位する（川の魚）
    this.first = true;
    this.prev = new Float32Array(count * 2);
    this.yaw = new Float32Array(count);
  }

  /** 群れの色と大きさを変える */
  style(color, size = 1) {
    this.mesh.material.color.set(color);
    this.mesh.material.emissive.set(color);
    this.size = size;
  }

  /** flat は上下の広がり（小さいほど薄い群れ） */
  set(x, y, z, r, flat = 0.32) {
    this.target.set(x, y, z);
    this.tr = r;
    this.flat = flat;
    if (this.first) {
      this.c.copy(this.target);
      this.r = r;
    }
  }

  update(dt, t) {
    const k = Math.min(1, dt * 1.6);
    this.c.lerp(this.target, k);
    this.r += (this.tr - this.r) * k;
    const turn = Math.min(1, dt * 7);
    for (let i = 0; i < this.n; i++) {
      const rr = this.r * (0.3 + ((i * 37) % 70) / 100);
      const a = this.hold ? i * 2.4 + Math.sin(t * 0.6 + i) * 0.25 : t * (0.5 + (i % 5) * 0.08) + i * 2.4;
      const x = this.c.x + Math.cos(a) * rr;
      const z = this.c.z + Math.sin(a) * rr * 0.85;
      const y = Math.max(this.floor + 0.3, Math.min(-0.35, this.c.y + Math.sin(i * 1.7 + t * 0.7) * this.r * this.flat));
      const dx = x - this.prev[i * 2];
      const dz = z - this.prev[i * 2 + 1];
      this.prev[i * 2] = x;
      this.prev[i * 2 + 1] = z;
      if (this.first) this.yaw[i] = -a - Math.PI / 2;
      else if (this.hold) this.yaw[i] += (Math.sin(t * 2 + i) * 0.18 - this.yaw[i]) * turn;
      else if (dx * dx + dz * dz > 1e-7) {
        let d = Math.atan2(-dz, dx) - this.yaw[i];
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw[i] += d * turn;
      }
      this.mesh.put(i, x, y, z, this.yaw[i], 0, this.size);
    }
    this.first = false;
    this.mesh.flush();
  }
}

const hash = (i, s) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** ナブラ（小魚が追われて海面が沸き立つ所）。update(t, x, z, 半径, 強さ 0〜1) */
export function nabura(group, n = 64) {
  const drops = particles(group, n, 0xffffff, 0.3);
  const jumpers = fishSet(group, 10, 0xdbe7ee, 0.5);
  const flat = (geo, opacity) => {
    const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false }));
    group.add(m);
    return m;
  };
  const foam = flat(new THREE.CircleGeometry(1, 24), 0.18);
  const rings = Array.from({ length: 6 }, () => flat(new THREE.RingGeometry(0.82, 1, 20), 0.5));
  return (t, x, z, r, k) => {
    const on = k > 0.02;
    drops.visible = jumpers.visible = foam.visible = on;
    rings.forEach((m) => (m.visible = on));
    if (!on) return;
    foam.position.set(x, 0.07, z);
    foam.scale.setScalar(r * (1 + Math.sin(t * 3) * 0.05));
    foam.material.opacity = 0.2 * k;
    for (let i = 0; i < n; i++) {
      const ph = t * 1.9 + i * 0.37;
      const cyc = Math.floor(ph);
      const f = ph - cyc;
      const a = hash(i, cyc) * Math.PI * 2;
      const d = Math.sqrt(hash(i + 50, cyc)) * r;
      drops.setAt(i, x + Math.cos(a) * d, 0.05 + f * (1 - f) * 4.5 * (0.4 + hash(i, cyc + 9)) * k, z + Math.sin(a) * d);
    }
    drops.flush();
    for (let j = 0; j < 10; j++) {
      const ph = t * 1.2 + j * 0.61;
      const cyc = Math.floor(ph);
      const f = ph - cyc;
      if (hash(j, cyc) > k) {
        jumpers.hide(j);
        continue;
      }
      const a = hash(j + 20, cyc) * Math.PI * 2;
      const d = Math.sqrt(hash(j + 70, cyc)) * r * 0.9;
      const go = (f - 0.5) * 1.6;
      jumpers.put(j, x + Math.cos(a) * d + Math.cos(a) * go, f * (1 - f) * 4 - 0.15, z + Math.sin(a) * d + Math.sin(a) * go, -a, (0.5 - f) * 2.2);
    }
    jumpers.flush();
    rings.forEach((m, j) => {
      const ph = t * 0.75 + j / rings.length;
      const cyc = Math.floor(ph);
      const f = ph - cyc;
      const a = hash(j, cyc) * Math.PI * 2;
      const d = Math.sqrt(hash(j + 30, cyc)) * r * 0.8;
      m.position.set(x + Math.cos(a) * d, 0.06, z + Math.sin(a) * d);
      m.scale.setScalar(0.3 + f * 1.9);
      m.material.opacity = (1 - f) * 0.55 * k;
    });
  };
}

/** 鳥山（海鳥の群れ）。update(t, x, z, 集まり具合 0〜1, 高さ)。ときどき海面へ突っ込む */
export function birds(group, n = 12) {
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const wing = (s) => {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0.2, 0, 0, -0.22, 0, 0, -0.05, 0, s * 0.95], 3));
    return new THREE.Mesh(geo, white);
  };
  const bodyGeo = new THREE.ConeGeometry(0.1, 0.6, 5).rotateZ(-Math.PI / 2);
  const list = Array.from({ length: n }, () => {
    const g = new THREE.Group();
    const L = wing(-1);
    const R = wing(1);
    g.add(new THREE.Mesh(bodyGeo, white), L, R);
    group.add(g);
    return { g, L, R };
  });
  return (t, x, z, k, h = 6) => {
    const shown = Math.round(n * clamp01(k));
    list.forEach(({ g, L, R }, i) => {
      g.visible = i < shown;
      if (!g.visible) return;
      const dir = i % 2 ? 1 : -1;
      const a = dir * t * (0.55 + (i % 3) * 0.1) + i * 1.9;
      const rad = 2.5 + (i % 5) * 1.5;
      const dive = clamp01(1 - Math.abs(((t * 0.2 + i * 0.31) % 1) - 0.5) * 7);
      g.position.set(x + Math.cos(a) * rad, lerp(h + (i % 4) * 1.1 + Math.sin(t * 1.3 + i) * 0.4, 0.4, dive), z + Math.sin(a) * rad);
      g.rotation.set(0, -a - (dir * Math.PI) / 2, 0);
      const flap = Math.sin(t * 9 + i * 2) * 0.7 * (1 - dive * 0.8);
      L.rotation.x = flap;
      R.rotation.x = -flap;
    });
  };
}

const WAKE_LIFE = 2.6;
/** 航跡の泡。emit() で置いた泡が広がって消える */
export class Wake {
  constructor(group, n = 140) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }), n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    group.add(this.mesh);
    this.data = new Float32Array(n * 4).fill(99); // x, z, 経過, 大きさ
    this.next = 0;
    this.m = new THREE.Matrix4();
  }

  emit(x, z, size = 1) {
    const i = (this.next++ % this.n) * 4;
    this.data.set([x, z, 0, size], i);
  }

  /** drift は景色が後ろへ流れる速さ（走り続ける船の表現） */
  update(dt, drift = 0) {
    const d = this.data;
    for (let i = 0; i < this.n; i++) {
      const o = i * 4;
      d[o + 2] += dt;
      d[o] -= drift * dt;
      const k = Math.min(1, d[o + 2] / WAKE_LIFE);
      const s = d[o + 3] * (0.35 + k * 1.5) * (1 - k) ** 0.7;
      this.m.makeScale(s, 1, s).setPosition(d[o], 0.05, d[o + 1]);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
