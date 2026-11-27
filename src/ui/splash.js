import * as THREE from 'three';
import { buildEarth } from './splash/earth.js';
import { buildHumpback, buildOrca, buildDolphin } from './splash/creatures.js';
import { pixelRatio } from '../core/quality.js';

const EARTH_R_WORLD = 1.3; // 地球の半径
// 体長（ザトウクジラ : シャチ : イルカ ≒ 14 : 7 : 3）
const LEN = { humpback: 1.3, orca: 0.65, dolphin: 0.28 };

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * 周回軌道。層ごとに半径を分け、傾き・昇交点の歳差・半径方向の上下動・
 * 軌道面からのうねりを加えて「自由に泳ぎ回る」動きにする。
 */
const SWIMMERS = [
  // バンドウイルカ3匹：内側の層を群れで（ポーポイジングで上下に跳ねる）
  ...[0, 0.16, -0.14].map((phase, i) => ({
    build: () => buildDolphin(LEN.dolphin),
    orbit: { radius: EARTH_R_WORLD + 0.28 + i * 0.04, incl: 0.35, node: 0, precess: 0.06, speed: 0.34, phase,
      bobAmp: 0.07, bobFreq: 2.4 + i * 0.3, weaveAmp: 0.08 + i * 0.03, weaveFreq: 0.9 + i * 0.2 },
    flap: { freq: 10, amp: 0.45 },
  })),
  // シャチ2匹：中間の層を逆回りに（オス・メス）
  ...[0, 0.42].map((phase, i) => ({
    build: () => buildOrca(LEN.orca, { male: i === 0 }),
    orbit: { radius: EARTH_R_WORLD + 0.62 + i * 0.08, incl: -0.65, node: 1.6, precess: -0.04, speed: -0.2, phase,
      bobAmp: 0.05, bobFreq: 0.9, weaveAmp: 0.12, weaveFreq: 0.45 + i * 0.1 },
    flap: { freq: 5, amp: 0.35 },
  })),
  // ザトウクジラ：外側の層をゆったりと
  {
    build: () => buildHumpback(LEN.humpback),
    orbit: { radius: EARTH_R_WORLD + 1.05, incl: 0.18, node: 2.6, precess: 0.03, speed: 0.11, phase: 2.2,
      bobAmp: 0.1, bobFreq: 0.5, weaveAmp: 0.2, weaveFreq: 0.25 },
    flap: { freq: 2, amp: 0.28 },
  },
];

function orbitPosition(o, t, out) {
  const a = o.phase + o.speed * t;
  const r = o.radius + Math.sin(t * o.bobFreq + o.phase * 5) * o.bobAmp;
  out.set(Math.cos(a) * r, Math.sin(t * o.weaveFreq + o.phase * 3) * o.weaveAmp, Math.sin(a) * r);
  out.applyAxisAngle(X_AXIS, o.incl);
  out.applyAxisAngle(Y_AXIS, o.node + o.precess * t);
  return out;
}

function starField(count, radius) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(radius * (0.7 + Math.random() * 0.3));
    v.toArray(pos, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.05, transparent: true, opacity: 0.8 }));
}

/** 起動時スプラッシュ：ローポリの地球の周りを鯨類が層を分けて周回する */
export class Splash {
  constructor({ root, canvas, bar, label }) {
    this.root = root;
    this.bar = bar;
    this.label = label;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(pixelRatio());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.target = new THREE.Vector3(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x0a1830, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(5, 3, 4);
    this.scene.add(sun);

    // 地球（地軸を傾けて自転）
    this.earthTilt = new THREE.Group();
    this.earthTilt.rotation.z = THREE.MathUtils.degToRad(23.4);
    this.earth = buildEarth(EARTH_R_WORLD);
    this.earthTilt.add(this.earth.group);
    this.scene.add(this.earthTilt);

    this.swimmers = SWIMMERS.map((s) => {
      const obj = s.build();
      this.scene.add(obj);
      return { ...s, obj, phaseOffset: Math.random() * Math.PI * 2 };
    });

    this.scene.add(starField(600, 30));

    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
    this._x = new THREE.Vector3();
    this._y = new THREE.Vector3();
    this._z = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._wiggle = new THREE.Quaternion();

    this.clock = new THREE.Clock();
    this._running = true;
    this._resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // 一番外の軌道が画面に収まる距離
      const outer = SWIMMERS[SWIMMERS.length - 1].orbit.radius + 1.2;
      const vFov = THREE.MathUtils.degToRad(this.camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
      const dist = outer / Math.tan(Math.min(vFov, hFov) / 2);
      this.camera.position.set(0, dist * 0.28, dist);
      this.camera.lookAt(0, -outer * 0.12, 0); // 地球を少し上に（下部に UI）
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._resize);
    this._resize();
    this._loop();
  }

  _loop = () => {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    const t = this.clock.getElapsedTime();
    this.earth.surface.rotation.y = t * 0.06;
    this.earth.clouds.rotation.y = t * 0.085;

    for (const s of this.swimmers) {
      const { orbit, flap, obj } = s;
      orbitPosition(orbit, t, this._p);
      orbitPosition(orbit, t + 0.02, this._q);
      // 進行方向を頭（+x）、地球の外向きを背中（+y）に
      const fwd = this._x.subVectors(this._q, this._p).normalize();
      const up = this._y.copy(this._p).normalize();
      up.addScaledVector(fwd, -up.dot(fwd)).normalize();
      const side = this._z.crossVectors(fwd, up);
      this._m.makeBasis(fwd, up, side);
      obj.position.copy(this._p);
      obj.quaternion.setFromRotationMatrix(this._m);
      // 泳ぎ：体の上下のしなりと尾びれの羽ばたき
      const ph = t * flap.freq + s.phaseOffset;
      obj.quaternion.multiply(this._wiggle.setFromAxisAngle(this._z.set(0, 0, 1), Math.sin(ph - 0.6) * 0.06));
      obj.userData.tail.rotation.z = Math.sin(ph) * flap.amp;
    }
    this.renderer.render(this.scene, this.camera);
  };

  setProgress(ratio, text) {
    this.bar.style.width = `${Math.round(ratio * 100)}%`;
    if (text) this.label.textContent = text;
  }

  /** フェードアウトして WebGL リソースを解放する */
  hide() {
    return new Promise((resolve) => {
      this.root.classList.add('fade');
      setTimeout(() => {
        this._running = false;
        window.removeEventListener('resize', this._resize);
        this.scene.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.root.remove();
        resolve();
      }, 850);
    });
  }
}
