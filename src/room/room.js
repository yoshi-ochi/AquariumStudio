import * as THREE from 'three';
import { FloorPlan, CELL } from './floorPlan.js';
import { getTexture } from './textures.js';
import { runTheta } from './embed.js';
import { ATRIUM_VOID, STORY_H, ZONES, zoneHas, zoneAt } from '../building/blueprint.js';

const DIRT_MARGIN = 1.6;
const RAIL_H = 1.1;
const SHUTTER_H = 2.4;

/** 未解放エリアとの境の工事用パネル */
function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = '#f2c230';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#2c3238';
  c.lineWidth = 14;
  for (let k = -64; k < 128; k += 40) {
    c.beginPath();
    c.moveTo(k, 64);
    c.lineTo(k + 64, 0);
    c.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/**
 * 部屋：マス目の床（館内・バックヤード）、外壁・仕切り壁（埋め込み穴あき）、室内ライト、屋外の地面。
 * 天井と照明器具は、カメラが天井より下にあるときだけ表示する（上から見下ろすときは隠す）。
 */
export class Room {
  constructor(scene, sceneMgr) {
    this.scene = scene;
    this.sceneMgr = sceneMgr;
    this.group = new THREE.Group();
    this.group.name = 'room';
    scene.add(this.group);

    this.floorMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    // 壁は片面だが、室内ライトの影は両面で落とす（光が壁を突き抜けて外を照らさない）
    this.wallMat.shadowSide = THREE.DoubleSide;
    this.yardFloorMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xb9bec2, roughness: 0.95 });
    this.yardWallMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xd5d8da, roughness: 0.95 });
    this.yardWallMat.shadowSide = THREE.DoubleSide;
    this.alcoveMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xd5d8da, roughness: 0.95, side: THREE.DoubleSide });
    this.dirtMat = new THREE.MeshStandardMaterial({ map: getTexture('dirt'), roughness: 1, side: THREE.DoubleSide, depthWrite: false });

    // 屋外の芝生（固定）
    // 地面は深度を書かない（2階の吹き抜けから、地面より下に置いた1階部分を見下ろすため）
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: getTexture('grass'), roughness: 1, depthWrite: false }));
    grass.renderOrder = -10;
    this.grass = grass;
    grass.geometry.attributes.uv.array.forEach((_, i, a) => (a[i] *= 400)); // UV をメートル単位に
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    scene.add(grass);

    this.built = new THREE.Group();
    this.lightGroup = new THREE.Group();
    this.helperGroup = new THREE.Group();
    this.helperGroup.visible = false;
    this.group.add(this.built, this.lightGroup, this.helperGroup);
    this.lights = []; // { spot, bulb, aim, line }
    this.holes = [];
    // 展示室の間の壁は、引いて見るときだけ腰の高さで切って部屋の中を見せる
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.6);
    sceneMgr.renderer.localClippingEnabled = true;
    this.roomWallMat = new THREE.MeshStandardMaterial({ roughness: 0.95, clippingPlanes: [this.cutPlane] });
    this.lockedFloorMat = new THREE.MeshStandardMaterial({ color: 0x11161b, roughness: 1 });
    this.outdoorMat = new THREE.MeshStandardMaterial({ color: 0xd3cbb9, roughness: 1 });
    this.shutterMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), color: 0x5a5f64, roughness: 0.8, side: THREE.DoubleSide });
    this.railMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ee, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    // 天井：下向きの面だけ（上からは見えない）。色はエリアごとに頂点色で持つ
    // 下向きの面は半球光の地面色（暗い緑）を受けて暗く濁るので、照明に左右されない色で塗る
    this.ceilingMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.fixtureMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
    this.ceilingOn = false;
  }

  /** 天井の高さ(m) */
  get ceilingHeight() {
    return this.stage?.wallHeight ?? STORY_H;
  }

  /** 毎フレーム：カメラが天井より下なら、天井と照明器具を出す */
  updateCeiling(camY) {
    const on = camY - this.built.position.y < this.ceilingHeight - 0.05;
    if (on === this.ceilingOn) return;
    this.ceilingOn = on;
    if (this.ceiling) this.ceiling.visible = on;
    for (const e of this.lights) e.fixture.visible = on;
  }

  // ---- 設定 -----------------------------------------------------------------

  /** 表示するフロアと解放済みエリアを設定する */
  setStage(stage, floor, unlocked) {
    this.stage = stage;
    this.plan = new FloorPlan(floor, unlocked);
  }

  /** zoneLook: エリアごとの色 { id: { floor, wall } }（無ければ全体の色） */
  applyLook({ floor, wall, ceiling, zoneLook }) {
    // 塗りつぶし：模様なしのマット調。床の色は頂点色で持つ（エリアごとに変えられる）
    this.floorMat.map = floor.type === 'solid' ? null : getTexture(floor.type);
    this.floorMat.roughness = floor.type === 'solid' ? 1 : 0.85;
    this.floorMat.color.set(0xffffff);
    this.floorMat.vertexColors = true;
    this.floorMat.needsUpdate = true;
    this.look = { floor: floor.color, wall: wall.color, ceiling: ceiling?.color ?? '#f2f1ec', zones: zoneLook ?? {} };
    for (const m of this.zoneWallMats?.values() ?? []) m.dispose();
    this.zoneWallMats = new Map();
    this.wallMat.map = getTexture(wall.type);
    this.wallMat.color.set(wall.color);
    this.wallMat.needsUpdate = true;
    this.roomWallMat.map = this.wallMat.map;
    this.roomWallMat.color.copy(this.wallMat.color);
    this.roomWallMat.needsUpdate = true;
    if (this.plan && this.built.children.length) this.rebuild();
  }

  /** そのマスの床（kind = 'ceiling' なら天井）の色 */
  _floorColor(i, j, floor, kind = 'floor') {
    const zone = ZONES.find((z) => z.floor === floor && zoneHas(z, i, j));
    return this._c.set((zone && this.look.zones[zone.id]?.[kind]) || this.look[kind]);
  }

  /** エリアの色を指定した壁は、その色の材質にする（面が向いている側のエリア） */
  _wallMatFor(run, base, flip) {
    const zones = this.look?.zones;
    if (!zones || !Object.keys(zones).length) return base;
    const s = (flip ? -1 : 1) * (run.n || 1) * 0.45;
    const mid = (run.from + run.to) / 2;
    const [x, z] = run.axis === 'x' ? [mid, run.line + s] : [run.line + s, mid];
    const color = zones[zoneAt(this.plan.floor, x, z)?.id]?.wall;
    if (!color) return base;
    const key = `${base.uuid}:${color}`;
    let m = this.zoneWallMats.get(key);
    if (!m) {
      m = base.clone();
      m.color.set(color);
      m.clippingPlanes = base.clippingPlanes;
      this.zoneWallMats.set(key, m);
    }
    return m;
  }

  /** ライトを作り直す（数が変わるとき） */
  setLights(list) {
    for (const o of [...this.lightGroup.children, ...this.helperGroup.children]) {
      o.parent.remove(o);
      o.geometry?.dispose();
      o.material?.dispose();
      o.dispose?.();
    }
    this.lights = list.map((l, i) => {
      const spot = new THREE.SpotLight(0xffffff, 1, 0, 1, 0.6, 0);
      // 壁で光を止めるため影を落とす（スマホ向けに影の解像度は控えめ）
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      spot.shadow.bias = -0.0008;
      spot.shadow.normalBias = 0.03;
      spot.shadow.camera.near = 0.1;
      spot.shadow.camera.far = 30;
      this.lightGroup.add(spot, spot.target);
      // 編集時だけ見えるハンドル：電球と、その真下の床のリング（どちらも移動）、照らす場所の ●（向き）
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial());
      bulb.userData = { lightIndex: i, handle: 'bulb' };
      const flat = (geo, opacity, order) => {
        const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity, depthTest: false, depthWrite: false }));
        m.renderOrder = order;
        return m;
      };
      const ring = flat(new THREE.RingGeometry(0.34, 0.62, 32), 0.55, 6);
      ring.userData = { lightIndex: i, handle: 'move' };
      // 中央まで塗った円（リングだと中心をタップしても掴めない）。白地に色の縁
      const aim = flat(new THREE.CircleGeometry(0.26, 24), 0.95, 8);
      aim.material.color.set(0xffffff);
      const aimEdge = flat(new THREE.RingGeometry(0.26, 0.32, 24), 0.95, 8);
      aimEdge.raycast = () => {};
      aim.add(aimEdge);
      aim.userData = { lightIndex: i, handle: 'aim' };
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.06 }));
      const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 }));
      drop.raycast = line.raycast = () => {};
      this.helperGroup.add(bulb, ring, aim, line, drop);
      const fixture = this._fixture();
      fixture.visible = this.ceilingOn;
      this.lightGroup.add(fixture);
      const entry = { spot, bulb, ring, aim, aimEdge, line, drop, fixture };
      this._applyLight(entry, l);
      return entry;
    });
    this.setSelectedLight(this.selectedLight ?? 0);
  }

  /**
   * 天井から吊るしたペンダントライト：天井の受け皿・吊り棒（長さは scale.y）・下向きの笠・光る面。
   * 原点が笠の高さ（ライトの高さ）
   */
  _fixture() {
    const g = new THREE.Group();
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), this.fixtureMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0), this.fixtureMat);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.17, 0.16, 20, 1, true).translate(0, 0.02, 0), this.fixtureMat);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20).rotateX(Math.PI / 2).translate(0, -0.05, 0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    g.add(rose, stem, shade, glow);
    g.userData = { rose, stem, glow };
    g.traverse((o) => (o.raycast = () => {}));
    return g;
  }

  /** ライト1灯の値だけ更新（ドラッグ中など） */
  updateLight(i, l) {
    if (this.lights[i]) this._applyLight(this.lights[i], l);
  }

  /** 選んだ照明のハンドルを濃く、ほかは薄く */
  setSelectedLight(i) {
    this.selectedLight = i;
    this.lights.forEach((e, k) => {
      const on = k === i;
      // 明るい床でも見えるよう、選んだ照明はオレンジ（選択枠と同じ色）、ほかは灰色
      e.ring.material.color.set(on ? 0xffb300 : 0x9aa4ad);
      e.ring.material.opacity = on ? 0.85 : 0.45;
      e.aimEdge.material.color.set(on ? 0x0f3550 : 0x5f6f7c);
      e.aim.material.opacity = e.aimEdge.material.opacity = on ? 0.95 : 0.5;
      e.bulb.scale.setScalar(on ? 1.15 : 0.85);
    });
  }

  _applyLight({ spot, bulb, ring, aim, aimEdge, line, drop, fixture }, l) {
    spot.color.set(l.color);
    spot.intensity = l.intensity * 3;
    spot.angle = THREE.MathUtils.degToRad(l.angle / 2);
    spot.position.set(l.x, l.height, l.z);
    spot.target.position.set(l.tx, 0, l.tz);
    bulb.position.copy(spot.position);
    bulb.material.color.set(l.color);
    ring.position.set(l.x, 0.03, l.z);
    aim.position.set(l.tx, 0.04, l.tz);
    drop.geometry.setFromPoints([spot.position, ring.position]);
    drop.material.color.set(l.color);
    line.geometry.setFromPoints([spot.position, aim.position]);
    line.computeLineDistances();
    line.material.color.set(l.color);
    // 照明器具：笠はライトの高さ、吊り棒は天井まで
    const H = this.ceilingHeight;
    fixture.position.set(l.x, Math.min(l.height, H - 0.1), l.z);
    const { rose, stem, glow } = fixture.userData;
    stem.position.y = 0.1;
    stem.scale.y = Math.max(0.01, H - fixture.position.y - 0.1);
    rose.position.y = H - fixture.position.y - 0.015;
    glow.material.color.set(l.color);
  }

  /** ドラッグ可能なハンドル（レイキャスト対象） */
  get handles() {
    return this.lights.flatMap((e) => [e.bulb, e.ring, e.aim]);
  }

  setEditVisible(visible) {
    this.helperGroup.visible = visible;
  }

  // ---- 形状 -----------------------------------------------------------------

  /** 地下を表示している間は地上の景色を隠す */
  setUnderground(on) {
    this.grass.visible = !on;
    this.sceneMgr.scene.background.set(on ? 0x141a20 : 0xbfe6ff);
  }

  /** 壁の編集中：壁を低くして交点の目印を表示する */
  setWallEditing(on) {
    this.editingWalls = on;
    if (this.gridLines) {
      this.gridLines.geometry.dispose();
      this.group.remove(this.gridLines);
      this.gridLines = null;
    }
    if (!on) return;
    const pts = [];
    const plan = this.plan;
    for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
      if (plan.at(i, j) !== CELL.FLOOR && plan.at(i, j) !== CELL.OUT) continue;
      const [x, z] = plan.cellMin(i, j);
      pts.push(x, 0.04, z, x + plan.cell, 0.04, z, x, 0.04, z, x, 0.04, z + plan.cell);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x2b8fd6, transparent: true, opacity: 0.55 }));
    this.gridLines.raycast = () => {};
    this.group.add(this.gridLines);
  }

  /** カメラの距離に応じて展示室の壁の高さを変える */
  updateCut(distance, dt) {
    // 天井の下から見ているときは、壁を天井まで出す
    const target = this.editingWalls ? 0.5 : this.ceilingOn || distance <= 11 ? 3.7 : 1.25;
    this.cutPlane.constant += (target - this.cutPlane.constant) * Math.min(1, dt * 6);
  }

  /** 床・壁・土を作り直す。holes: [{ key, along, width, bottom, top }] */
  rebuild(holes = this.holes) {
    this.holes = holes;
    for (const o of [...this.built.children]) {
      this.built.remove(o);
      o.geometry.dispose();
    }
    const plan = this.plan;
    this.built.add(this._floorMesh(plan, CELL.FLOOR, this.floorMat, 0, plan.floor));
    this.built.add(this._floorMesh(plan, CELL.YARD, this.yardFloorMat));
    this.built.add(this._floorMesh(plan, CELL.LOCKED, this.lockedFloorMat));
    this.built.add(this._floorMesh(plan, CELL.LOCKED_OUT, this.lockedFloorMat));
    this.built.add(this._floorMesh(plan, CELL.OUT, this.outdoorMat));
    // 吹き抜けから見下ろす1階の床
    this.built.add(this._floorMesh(plan, CELL.VOID, this.floorMat, -STORY_H, 0));
    for (const run of plan.runs()) {
      if (run.kind === 'shutter' || run.kind === 'rail') {
        this.built.add(this._wallMesh(run, [], run.kind === 'rail' ? this.railMat : this.shutterMat, false, run.kind === 'rail' ? RAIL_H : SHUTTER_H));
        continue;
      }
      const hs = holes.filter((h) => h.key === run.key && h.along >= run.from && h.along <= run.to);
      if (run.kind === 'room') {
        this.built.add(this._wallMesh(run, hs, this._wallMatFor(run, this.roomWallMat, false), false));
        this.built.add(this._wallMesh(run, hs, this._wallMatFor(run, this.roomWallMat, true), true));
      } else if (run.kind === 'partition') {
        // 仕切り壁は両面：館内側は選んだ壁材、バックヤード側はコンクリート
        this.built.add(this._wallMesh(run, hs, this._wallMatFor(run, this.wallMat, false), false));
        this.built.add(this._wallMesh(run, hs, this.yardWallMat, true));
      } else {
        this.built.add(this._wallMesh(run, hs, run.side === CELL.YARD ? this.yardWallMat : this._wallMatFor(run, this.wallMat, false), false));
        // 外壁に埋め込んだ水槽の外側を囲う張り出し
        for (const h of hs) this.built.add(this._alcove(run, h));
      }
    }
    this.ceiling = this._ceilingMesh(plan);
    this.ceiling.visible = this.ceilingOn;
    this.built.add(this.ceiling);
    const b = plan.bounds();
    this.built.add(this._dirtMesh(b));
    this.sceneMgr.fitShadow(b.cx, b.cz, Math.max(b.w, b.d) / 2 + DIRT_MARGIN);
  }

  /** colorFloor を渡すと、そのフロアのエリア色を頂点色に入れる */
  _floorMesh(plan, type, material, y = 0, colorFloor = null) {
    const pos = [];
    const uv = [];
    const col = [];
    this._c ??= new THREE.Color();
    const c = plan.cell;
    for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
      if (plan.at(i, j) !== type) continue;
      const [x, z] = plan.cellMin(i, j);
      const k = colorFloor === null ? null : this._floorColor(i, j, colorFloor);
      for (const [qx, qz] of [[x, z], [x, z + c], [x + c, z], [x + c, z], [x, z + c], [x + c, z + c]]) {
        pos.push(qx, y, qz);
        uv.push(qx, -qz);
        if (k) col.push(k.r, k.g, k.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (col.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    return m;
  }

  /** 天井：館内とバックヤードのマスの上（1階の吹き抜けの下は2階まで抜けているので張らない） */
  _ceilingMesh(plan) {
    const pos = [];
    const col = [];
    const c = plan.cell;
    const H = this.ceilingHeight;
    const voidRect = plan.floor === 0 && ATRIUM_VOID ? ATRIUM_VOID.rect : null;
    this._c ??= new THREE.Color();
    for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
      const t = plan.at(i, j);
      if (t !== CELL.FLOOR && t !== CELL.YARD) continue;
      if (voidRect && i >= voidRect[0] && i <= voidRect[2] && j >= voidRect[1] && j <= voidRect[3]) continue;
      const [x, z] = plan.cellMin(i, j);
      const k = this._floorColor(i, j, plan.floor, 'ceiling');
      // 下向きの面になる頂点の順
      for (const [qx, qz] of [[x, z], [x + c, z], [x, z + c], [x + c, z], [x + c, z + c], [x, z + c]]) {
        pos.push(qx, H, qz);
        col.push(k.r, k.g, k.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.ceilingMat);
    m.receiveShadow = true;
    m.raycast = () => {};
    return m;
  }

  /** 壁1面。flip で裏向き（法線を反転）にする */
  _wallMesh(run, holes, material, flip, height = this.stage.wallHeight) {
    const H = height;
    const len = run.to - run.from;
    const mid = (run.from + run.to) / 2;
    const theta = runTheta(run) + (flip ? Math.PI : 0);
    // ラン方向の単位ベクトルと、壁ローカル X 軸との向きの一致（±1）
    const u = run.axis === 'x' ? [1, 0] : [0, 1];
    const sign = Math.sign(u[0] * Math.cos(theta) - u[1] * Math.sin(theta)) || 1;

    const shape = new THREE.Shape();
    shape.moveTo(-len / 2, 0);
    shape.lineTo(len / 2, 0);
    shape.lineTo(len / 2, H);
    shape.lineTo(-len / 2, H);
    shape.closePath();
    for (const h of holes) {
      const cx = (h.along - mid) * sign;
      const x0 = Math.max(-len / 2 + 0.01, cx - h.width / 2);
      const x1 = Math.min(len / 2 - 0.01, cx + h.width / 2);
      const y0 = Math.max(0.005, h.bottom);
      const y1 = Math.min(H - 0.01, h.top);
      if (x1 - x0 < 0.02 || y1 - y0 < 0.02) continue;
      const p = new THREE.Path();
      p.moveTo(x0, y0);
      p.lineTo(x0, y1);
      p.lineTo(x1, y1);
      p.lineTo(x1, y0);
      p.closePath();
      shape.holes.push(p);
    }
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    const [px, pz] = run.axis === 'x' ? [mid, run.line] : [run.line, mid];
    mesh.position.set(px, 0, pz);
    mesh.rotation.y = theta;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    // カメラと注視点の間に入ったら低くする（updateOcclusion）
    if (height > 1) mesh.userData.wall = { axis: run.axis, line: run.line, from: run.from, to: run.to, H };
    return mesh;
  }

  /**
   * カメラと注視点（水槽など）の間をさえぎる壁を、床すれすれまで下げる（足元の線だけ残す）。離れたら元に戻す。
   * 上から見下ろして壁の上を越える視線のときは下げない。
   */
  updateOcclusion(cam, target, dt) {
    const LOW = 0.06;
    const k = Math.min(1, dt * 8);
    const dx = target.x - cam.x;
    const dz = target.z - cam.z;
    for (const m of this.built.children) {
      const w = m.userData.wall;
      if (!w) continue;
      let block = false;
      // 視線（XZ）が壁の線を横切る位置 t（0=カメラ、1=注視点）
      const t = w.axis === 'x' ? (Math.abs(dz) > 1e-6 ? (w.line - cam.z) / dz : -1) : Math.abs(dx) > 1e-6 ? (w.line - cam.x) / dx : -1;
      if (t > 0 && t < 0.97) {
        const along = w.axis === 'x' ? cam.x + dx * t : cam.z + dz * t;
        const y = cam.y + (target.y - cam.y) * t;
        block = along >= w.from - 0.3 && along <= w.to + 0.3 && y < w.H + 0.2;
      }
      const want = block ? Math.min(1, LOW / w.H) : 1;
      const s = m.scale.y + (want - m.scale.y) * k;
      m.scale.y = Math.abs(s - want) < 0.002 ? want : s;
    }
  }

  /** 外壁の外側に、埋め込み水槽を囲うコンクリートの箱（前面は壁の穴）を作る */
  _alcove(run, h) {
    const m = 0.08;
    const W = h.width + m * 2;
    const D = h.depth + m;
    const H = Math.min(this.stage.wallHeight, Math.max(h.top, h.bottom + h.lightTop) + m);
    const pos = [];
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    // 壁ローカル：x = 壁沿い, y = 上, z = 内側（法線）。外側は -z
    const x0 = -W / 2, x1 = W / 2, z0 = 0, z1 = -D;
    quad([x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]); // 奥
    quad([x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]); // 左
    quad([x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1]); // 右
    quad([x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0]); // 屋根
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.alcoveMat);
    const theta = runTheta(run);
    const u = run.axis === 'x' ? [1, 0] : [0, 1];
    const sign = Math.sign(u[0] * Math.cos(theta) - u[1] * Math.sin(theta)) || 1;
    const mid = (run.from + run.to) / 2;
    const [px, pz] = run.axis === 'x' ? [mid, run.line] : [run.line, mid];
    mesh.position.set(px, 0, pz);
    mesh.rotation.y = theta;
    mesh.position.x += Math.cos(theta) * (h.along - mid) * sign;
    mesh.position.z += -Math.sin(theta) * (h.along - mid) * sign;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  /** 建物の周りの土（角丸の矩形） */
  _dirtMesh(b) {
    const m = DIRT_MARGIN;
    const x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
    const r = m * 0.9;
    const s = new THREE.Shape();
    s.moveTo(x0 + r, z0);
    s.lineTo(x1 - r, z0);
    s.absarc(x1 - r, z0 + r, r, -Math.PI / 2, 0);
    s.lineTo(x1, z1 - r);
    s.absarc(x1 - r, z1 - r, r, 0, Math.PI / 2);
    s.lineTo(x0 + r, z1);
    s.absarc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x0, z0 + r);
    s.absarc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5);
    const geo = new THREE.ShapeGeometry(s, 8);
    geo.rotateX(Math.PI / 2); // Shape の XY → XZ
    const mesh = new THREE.Mesh(geo, this.dirtMat);
    mesh.position.y = -0.015;
    mesh.renderOrder = -9;
    mesh.receiveShadow = true;
    return mesh;
  }
}
