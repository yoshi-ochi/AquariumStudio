import * as THREE from 'three';

/**
 * 水面のしぶきと波紋（跳躍・滑空で魚が水面を抜けるとき）。座標は水槽ローカル。
 * しぶき＝小さな球の InstancedMesh（重力で落ちて水面で消える）、波紋＝輪の InstancedMesh（広がりながら薄れる・加算合成）
 */
const DROPS = 160;
const RINGS = 24;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export class LeapFx {
  /** surf は水面の高さ、maxR は波紋の最大半径（水槽の内側に収める） */
  constructor(surf, maxR) {
    this.surf = surf;
    this.maxR = maxR;
    this.group = new THREE.Group();
    this.group.name = 'leapFx';
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.85, depthWrite: false });
    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), dropMat, DROPS);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.82, 1, 40), ringMat, RINGS);
    this.rings.setColorAt(0, _c.setScalar(0));
    for (const im of [this.drops, this.rings]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      this.group.add(im);
    }
    this.d = []; // { x, y, z, vx, vy, vz, g, r }
    this.r = []; // { x, z, t, life, r0, r1, a }
  }

  /**
   * 魚が水面を抜けた（out）・落ちた（in）。L は体長、v は縦の速さの大きさ、dir は進む向き（水平の単位ベクトル）
   */
  splash(x, z, L, v, out, fx = 0, fz = 0) {
    const g = Math.max(0.5, (v * v) / (L * 1.4)); // しぶきは体長の半分ほどまで上がる重力にする
    const n = Math.min(DROPS - this.d.length, Math.round((18 + 18 * Math.min(1, v / 2)) * (out ? 1 : 1.5)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = (0.15 + Math.random() * 0.45) * v;
      // 抜けるときは進む向きへ、落ちるときは四方へ
      const fw = out ? 0.35 * v : 0;
      this.d.push({
        x: x + Math.cos(a) * L * 0.15,
        y: this.surf,
        z: z + Math.sin(a) * L * 0.15,
        vx: Math.cos(a) * h * 0.6 + fx * fw,
        vy: (0.4 + Math.random() * 0.8) * v * (out ? 0.8 : 0.6),
        vz: Math.sin(a) * h * 0.6 + fz * fw,
        g,
        r: L * (0.035 + Math.random() * 0.045),
      });
    }
    for (let k = 0; k < 2 && this.r.length < RINGS; k++) {
      this.r.push({ x, z, t: -k * 0.25, life: 1.6, r0: L * 0.25, r1: Math.min(this.maxR, L * (out ? 1.6 : 2.2)), a: out ? 0.6 : 0.8 });
    }
  }

  get busy() {
    return this.d.length > 0 || this.r.length > 0;
  }

  update(dt) {
    if (!this.busy) return;
    // しぶき：水面より下へ落ちたら消える
    this.d = this.d.filter((p) => {
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      return p.y > this.surf - p.r;
    });
    this.d.forEach((p, i) => {
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.setScalar(p.r));
      this.drops.setMatrixAt(i, _m);
    });
    this.drops.count = this.d.length;
    this.drops.instanceMatrix.needsUpdate = true;
    // 波紋：広がりながら薄れる
    this.r = this.r.filter((w) => (w.t += dt) < w.life);
    this.r.forEach((w, i) => {
      const p = Math.max(0, w.t) / w.life;
      const R = w.r0 + (w.r1 - w.r0) * (1 - (1 - p) ** 2);
      _m.compose(_p.set(w.x, this.surf + 0.002, w.z), FLAT, _s.set(R, R, 1));
      this.rings.setMatrixAt(i, _m);
      this.rings.setColorAt(i, _c.setScalar(w.t < 0 ? 0 : w.a * (1 - p) ** 2));
    });
    this.rings.count = this.r.length;
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.instanceColor.needsUpdate = true;
  }
}
