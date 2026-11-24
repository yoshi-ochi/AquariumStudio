import * as THREE from 'three';

const DURATION = 0.9; // 秒
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 水槽内モードのカメラ。水槽全体が視野にぴったり収まる距離へ滑らかに移動し、
 * 注視点を水槽中心に固定する（回転・ズームのみ許可）。退出時は元の視点に戻す。
 */
export class InteriorCamera {
  constructor(cameraCtl) {
    this.ctl = cameraCtl;
    this.camera = cameraCtl.camera;
    this.controls = cameraCtl.controls;
    this.tween = null;
    this.saved = null;
  }

  get busy() {
    return !!this.tween;
  }

  enter(tank) {
    const c = this.controls;
    this.saved = {
      pos: this.camera.position.clone(),
      target: c.target.clone(),
      minDistance: c.minDistance,
      maxDistance: c.maxDistance,
      enablePan: c.enablePan,
      screenSpacePanning: c.screenSpacePanning,
      // 真上から見た部屋の編集（回転なし・1本指で移動）から入ったときのため、回転の設定も保存して水槽内では回せるようにする
      enableRotate: c.enableRotate,
      minPolarAngle: c.minPolarAngle,
      maxPolarAngle: c.maxPolarAngle,
      touches: { ...c.touches },
      mouseButtons: { ...c.mouseButtons },
    };
    Object.assign(c, { enableRotate: true, minPolarAngle: 0, maxPolarAngle: Math.PI / 2 - 0.03 });
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    // 水槽本体（中身を除く）のバウンディング球
    const box = new THREE.Box3().setFromObject(tank.getObjectByName('body'));
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.02;

    // 水槽の正面（ローカル +Z）のやや上から
    const q = tank.getWorldQuaternion(new THREE.Quaternion());
    const dir = new THREE.Vector3(0, 0.45, 1).applyQuaternion(q).normalize();
    const pos = center.clone().addScaledVector(dir, dist);

    // 2本指スライド（右ドラッグ）で視点を平行移動。注視点は水槽の範囲内に制限
    c.enablePan = true;
    c.screenSpacePanning = true;
    this.panBox = box.clone().expandByScalar(sphere.radius * 0.1);
    this._tweenTo(pos, center, { minDistance: dist * 0.15, maxDistance: dist * 1.8 });
  }

  exit() {
    const s = this.saved;
    if (!s) return;
    this.saved = null;
    this.controls.enablePan = s.enablePan;
    this.controls.screenSpacePanning = s.screenSpacePanning;
    Object.assign(this.controls, { enableRotate: s.enableRotate, minPolarAngle: s.minPolarAngle, maxPolarAngle: s.maxPolarAngle, touches: s.touches, mouseButtons: s.mouseButtons });
    this.panBox = null;
    this._tweenTo(s.pos, s.target, { minDistance: s.minDistance, maxDistance: s.maxDistance });
  }

  _tweenTo(pos, target, limits) {
    // 距離制限は移動完了後に適用（途中でクランプされて飛ばないように）
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.ctl.setEnabled(false);
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      pos,
      target,
      limits,
      t: 0,
    };
  }

  update(dt) {
    const tw = this.tween;
    if (!tw) {
      // パンで注視点が水槽の外へ出ないように（カメラも同じだけ戻す）
      if (this.panBox) {
        const t = this.controls.target;
        const clamped = t.clone().clamp(this.panBox.min, this.panBox.max);
        if (!clamped.equals(t)) {
          this.camera.position.add(clamped.clone().sub(t));
          t.copy(clamped);
        }
      }
      return;
    }
    tw.t = Math.min(1, tw.t + dt / DURATION);
    const k = ease(tw.t);
    this.camera.position.lerpVectors(tw.fromPos, tw.pos, k);
    this.controls.target.lerpVectors(tw.fromTarget, tw.target, k);
    if (tw.t >= 1) {
      Object.assign(this.controls, tw.limits);
      this.tween = null;
      this.ctl.setEnabled(true);
    }
  }
}
