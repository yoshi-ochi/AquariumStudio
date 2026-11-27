import * as THREE from 'three';
import { TankManager } from '../tanks/tankManager.js';
import { getDef, hasDef } from '../tanks/tankData.js';
import { registerCustomIds } from '../tanks/customTanks.js';
import { updateCaustics } from '../tanks/sandLook.js';
import { setSwayTime } from '../flora/floraMaterial.js';
import { updateWater } from '../water/waterSurface.js';

/**
 * 共有した水槽を1つだけ置いた舞台（閲覧ページと、共有するときの画像の撮影で使う）。
 * 館内とは別のシーンに、写しから水槽を作り直す。正面は水槽の +Z 側。
 */
export class TankStage {
  constructor(snap) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1a26);
    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x30404a, 1.1));
    const key = new THREE.DirectionalLight(0xfff6e5, 1.2);
    key.position.set(2, 5, 4);
    this.scene.add(key);
    registerCustomIds([snap.defId]);
    if (!hasDef(snap.defId)) throw new Error('unknown_tank');
    this.def = getDef(snap.defId);
    // 床（水槽の影の代わりに、少し明るい円）
    const floor = new THREE.Mesh(new THREE.CircleGeometry(Math.max(this.def.size.w, this.def.size.d) * 1.6, 48), new THREE.MeshLambertMaterial({ color: 0x23394a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    this.scene.add(floor);
    this.manager = new TankManager(this.scene);
    this.tank = this.manager.add(snap.defId, { x: 0, z: 0, contents: snap.contents ?? [], look: snap.look ?? null, creatures: snap.creatures ?? null, variants: snap.variants ?? null, name: snap.name ?? null, waterLevel: snap.waterLevel ?? null });
  }

  /** 水槽の中心と、正面から全体が収まるカメラの距離 */
  frame(camera, { yaw = 0.35, pitch = 0.18, fill = 0.92 } = {}) {
    const box = new THREE.Box3().setFromObject(this.tank);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) * 0.62;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    // 正面から見たとき、水槽の幅と高さがどちらも画面に収まる距離（奥行きの半分だけ手前から測る）
    const fit = (Math.max(s.x / 2 / (tan * camera.aspect), (s.y / 2) / tan) + s.z / 2) / fill;
    camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * fit, c.y + Math.sin(pitch) * fit, c.z + Math.cos(yaw) * Math.cos(pitch) * fit);
    camera.near = fit / 100;
    camera.far = fit * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(c);
    return { center: c, distance: fit, radius: r };
  }

  /** 1コマ分の更新（time は秒） */
  update(time, renderer, camera, { caustics = true } = {}) {
    updateWater(time);
    this.manager.updateClips();
    this.manager.updateAeration(time);
    setSwayTime(time);
    this.manager.updateLife(time);
    // 水紋の計算は最初に使ったレンダラーに結び付くので、撮影用の別レンダラーでは使わない
    if (caustics) updateCaustics(time, renderer, this.manager.tanks, camera);
  }

  dispose() {
    this.manager.remove(this.tank);
  }
}
