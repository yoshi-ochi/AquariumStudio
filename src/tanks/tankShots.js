import * as THREE from 'three';

/**
 * 置いた水槽のサムネイル（中の岩・水草・生き物ごと）。
 * 本体のレンダラーで画面の隅に小さく描いて画像にし、直後の本描画で上書きする（画面には出ない）。
 * 水槽の水紋・クリップは本体のレンダラーの物を使うので、別のレンダラーでは撮らない。1コマに1基まで。
 */
const W = 192;
const H = 128;
const STALE_MS = 3 * 60 * 1000; // これより古い画像は撮り直す（生き物が動く・汚れが変わる）

export class TankShots {
  constructor(renderer, { onShot } = {}) {
    this.renderer = renderer;
    this.onShot = onShot;
    this.shots = new WeakMap(); // 水槽 → { url, at }
    this.queue = new Set();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbe9f3);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    // 水槽の親（階のグループなど）と同じ位置に置く入れ物。水槽のワールド座標を変えずに撮る
    this.holder = new THREE.Group();
    this.holder.matrixAutoUpdate = false;
    this.scene.add(this.holder);
    this.camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this._box = new THREE.Box3();
    this._center = new THREE.Vector3();
    this._sphere = new THREE.Sphere();
    this._dir = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._vp = new THREE.Vector4();
    this._sc = new THREE.Vector4();
  }

  /** 画像の URL（無い・古いときは撮る予約をして、撮るまでは前の画像か ''） */
  url(tank) {
    const s = this.shots.get(tank);
    if (!s || Date.now() - s.at > STALE_MS) this.queue.add(tank);
    return s?.url ?? '';
  }

  /** 先に撮っておく（起動後・読込後） */
  request(tanks) {
    for (const t of tanks) if (!this.shots.has(t)) this.queue.add(t);
  }

  /** 中身を変えたので撮り直す */
  invalidate(tank) {
    const s = this.shots.get(tank);
    if (s) s.at = 0;
    this.queue.add(tank);
  }

  /** 毎コマ、本描画の前に呼ぶ。予約があれば1基だけ撮る */
  update() {
    const tank = this.queue.values().next().value;
    if (!tank) return;
    this.queue.delete(tank);
    if (!tank.parent) return; // 撤去済み
    try {
      this.shots.set(tank, { url: this._shoot(tank), at: Date.now() });
      this.onShot?.(tank);
    } catch (err) {
      console.warn('水槽のサムネイルを撮れませんでした', err);
    }
  }

  _shoot(tank) {
    const r = this.renderer;
    const parent = tank.parent;
    const idx = parent.children.indexOf(tank);
    const visible = tank.visible;
    // 親から外して入れ物へ（イベントを出さないよう children を直接入れ替える）
    parent.children.splice(idx, 1);
    tank.parent = this.holder;
    this.holder.children.push(tank);
    this.holder.matrix.copy(parent.matrixWorld);
    this.holder.matrixWorld.copy(parent.matrixWorld);
    tank.visible = true; // 別の階の水槽も撮る
    const shadow = r.shadowMap.needsUpdate;
    r.getViewport(this._vp);
    r.getScissor(this._sc);
    const scissor = r.getScissorTest();
    try {
      tank.updateMatrixWorld(true);
      this._frame(tank);
      const pr = r.getPixelRatio();
      r.shadowMap.needsUpdate = false; // 本描画の影の更新を横取りしない
      r.setRenderTarget(null);
      r.setViewport(0, 0, W / pr, H / pr);
      r.setScissor(0, 0, W / pr, H / pr);
      r.setScissorTest(true);
      r.render(this.scene, this.camera);
      // 描いた直後（同じ処理の中）なら preserveDrawingBuffer なしでも読める。左下の W×H
      const src = r.domElement;
      this.ctx.drawImage(src, 0, src.height - H, W, H, 0, 0, W, H);
      return this.canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      r.setViewport(this._vp);
      r.setScissor(this._sc);
      r.setScissorTest(scissor);
      r.shadowMap.needsUpdate = shadow;
      this.holder.children.length = 0;
      tank.parent = parent;
      parent.children.splice(idx, 0, tank);
      tank.visible = visible;
    }
  }

  /** 水槽の正面やや上から、全体が収まる距離にカメラを置く */
  _frame(tank) {
    const box = this._box.setFromObject(tank);
    if (box.isEmpty()) box.setFromCenterAndSize(tank.getWorldPosition(this._center), new THREE.Vector3(1, 1, 1));
    box.getCenter(this._center);
    box.getBoundingSphere(this._sphere);
    const cam = this.camera;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
    const dist = (this._sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.72;
    tank.getWorldQuaternion(this._quat);
    this._dir.set(0.35, 0.45, 1).normalize().applyQuaternion(this._quat);
    cam.position.copy(this._center).addScaledVector(this._dir, dist);
    cam.near = Math.max(0.01, dist - this._sphere.radius * 2);
    cam.far = dist + this._sphere.radius * 2;
    cam.updateProjectionMatrix();
    cam.lookAt(this._center);
    cam.updateMatrixWorld();
  }
}
