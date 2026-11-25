import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mulberry32 } from '../tanks/random.js';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { createMotion, stepMotion } from '../expedition/lifeMotion.js';
import { behaviorOf } from '../expedition/behaviorData.js';
import { swimOf, swimParams } from '../expedition/swimStyles.js';

/**
 * 管理者ツールの泳ぎの試し見。ゲームと同じ形・泳ぎのシェーダー・行動（lifeMotion.js）で、岩と海藻を1つずつ置いた小さな水槽に泳がせる。
 * WebGL の文脈は1つだけ作り、画面を描き直しても同じ canvas を付け直して使う。
 */
const FLOOR = 0x2a3f4a;
const ROCK = 0x6d5f55;
const WEED = 0x3f8a4a;

export class SwimPreview {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'ad-swim-canvas';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f3d55);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.005, 200);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.tank = new THREE.Group();
    this.life = new THREE.Group();
    this.scene.add(this.tank, this.life);
    this.ctx = null;
    this.key = '';
    this.raf = 0;
    this.last = 0;
    this.time = 0;
    this.follow = false; // true：1匹目に寄って追いかける（ひれの動きを近くで見る）
    this.L = 0.1;
    new ResizeObserver(() => this._resize()).observe(this.canvas);
  }

  /** el に canvas を付け、描画を始める */
  mount(el) {
    el.append(this.canvas);
    this._resize();
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  /** 生き物 c（c.swim・c.beh に編集中の値）を表示する。行動が変わらなければ、ひれの動きだけ差し替える */
  show(c) {
    const key = `${c.id}|${c.len}|${JSON.stringify(behaviorOf(c))}`;
    if (key !== this.key) this._rebuild(c);
    this.key = key;
    const sw = swimOf(c);
    const params = swimParams(c);
    for (const f of this.life.children) {
      const u = f.userData.uni;
      Object.assign(f.userData.motion, { sw: params, gw: -1 });
      u.uSwimA.value.set(...sw.a);
      u.uSwimB.value.set(...sw.b);
      u.uSwimC.value.set(...sw.c);
    }
  }

  _rebuild(c) {
    this._clear(this.tank);
    this._clear(this.life);
    // 水槽の幅は体長の15倍（奥行・高さは幅の0.45・0.5倍）。体長との比が一定なので、どの種も同じ見え方で速さを比べられる
    const W = c.len * 15;
    const D = W * 0.45;
    const H = W * 0.5;
    const box = { cx: 0, hx: (W / 2) * 0.86, hz: (D / 2) * 0.86, y0: 0.03 * W, y1: H - 0.03 * W, round: false };
    const rock = { x: -box.hx * 0.55, z: box.hz * 0.15, w: W * 0.18, d: D * 0.35, y0: 0, h: H * 0.22 };
    const weed = { x: box.hx * 0.5, z: -box.hz * 0.2, w: W * 0.06, d: W * 0.06, y0: 0, h: H * 0.7 };
    // 柔らかいサンゴ（ナガレハナサンゴ）：クマノミの住みかになる
    const coral = { id: 'euphyllia', x: 0, z: box.hz * 0.2, w: W * 0.14, d: W * 0.14, y0: 0, h: H * 0.12 };
    for (const a of [rock, weed, coral]) Object.assign(a, { r: Math.min(a.w, a.d) / 2, bx: a.x, bz: a.z });
    this.ctx = { box, anchors: { rocks: [rock], holds: [weed], coral: [coral] }, sig: '', current: 0.8, checked: 0, last: null };

    const mat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(FLOOR));
    floor.rotation.x = -Math.PI / 2;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: 0x9fd4ef, transparent: true, opacity: 0.5, depthWrite: false }));
    edges.position.y = H / 2;
    const rockMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat(ROCK));
    rockMesh.scale.set(rock.w / 2, rock.h, rock.d / 2);
    rockMesh.position.set(rock.x, 0, rock.z);
    const weedMesh = new THREE.Mesh(new THREE.CylinderGeometry(weed.w * 0.15, weed.w * 0.3, weed.h, 5), mat(WEED));
    weedMesh.position.set(weed.x, weed.h / 2, weed.z);
    const coralMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat(0xc77fa0));
    coralMesh.scale.set(coral.w / 2, coral.h, coral.d / 2);
    coralMesh.position.set(coral.x, 0, coral.z);
    this.tank.add(floor, edges, rockMesh, weedMesh, coralMesh);

    const beh = behaviorOf(c);
    // 群れ・巣穴のコロニーは5匹、宿主に住む魚はつがいと若魚の3匹
    const n = beh.school || beh.mode === 'burrow' ? 5 : beh.mode === 'host' ? 3 : 1;
    const scale = Math.min(1, (Math.min(box.hx, box.hz) * 1.4) / c.len);
    const shared = { n };
    for (let i = 0; i < n; i++) {
      const fish = buildCreature(c);
      fish.scale.setScalar(scale);
      fish.userData.motion = createMotion(c, c.len * scale, this.ctx, mulberry32(97 + i * 131), shared, i);
      this.life.add(fish);
    }
    this.L = c.len * scale;
    this.H = H;
    this.W = W;
    this.size = { W, D, H };
    this.camera.near = W * 0.002;
    this.camera.far = W * 20;
    this.camera.updateProjectionMatrix();
    this.time = 0;
    this.frame();
  }

  /** 水槽全体が収まる視点、または1匹目の近く */
  frame() {
    const { W, H, L } = this;
    const fish = this.life.children[0];
    if (this.follow && fish) {
      this.controls.target.copy(fish.position);
      this.camera.position.copy(fish.position).add(new THREE.Vector3(0, L * 0.6, L * 2.6));
    } else {
      this.camera.position.set(0, H * 0.75, W * 1.25);
      this.controls.target.set(0, H * 0.4, 0);
    }
    this.controls.update();
  }

  /** 寄って追いかける：カメラと注視点を魚の移動分だけ動かす（回した向きはそのまま） */
  _track() {
    const fish = this.life.children[0];
    if (!this.follow || !fish) return;
    const d = fish.position.clone().sub(this.controls.target);
    this.controls.target.add(d);
    this.camera.position.add(d);
  }

  /** 形（ジオメトリ）は種類ごとに共有しているので、材質だけ捨てる */
  _clear(group) {
    for (const o of [...group.children]) {
      o.traverse((m) => {
        if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
        if (m.material) m.material.dispose();
      });
      group.remove(o);
    }
  }

  _resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop(now) {
    // 画面から外れたら止める（タブの切り替え・別の魚種を選んだとき）
    if (!this.canvas.isConnected) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.ctx) for (const f of this.life.children) stepMotion(f, f.userData.motion, this.ctx, dt, this.time);
    this._track();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }
}
