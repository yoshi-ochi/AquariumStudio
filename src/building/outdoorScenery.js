import * as THREE from 'three';
import { CELL_SIZE, GRID_X, GRID_Z, ZONES, getZone } from './blueprint.js';

/** 屋外エリアの地面と作り付けの景観（海獣プール・自然再現の磯と干潟） */
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z / 2) * CELL_SIZE;
const mat = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
const GROUND = { marine: 0xcfd6d6, plaza: 0xd9cdb8, nature: 0x86a862 };

function mesh(group, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.raycast = () => {};
  group.add(m);
  return m;
}

const rectInfo = ([x0, z0, x1, z1]) => ({ x: (wx(x0) + wx(x1 + 1)) / 2, z: (wz(z0) + wz(z1 + 1)) / 2, w: wx(x1 + 1) - wx(x0), d: wz(z1 + 1) - wz(z0) });

/** 自然再現エリア：磯・干潟・マングローブの小川 */
function buildNature(group, rect) {
  const r = rectInfo(rect);
  const rock = mat(0x6f6a60);
  mesh(group, new THREE.BoxGeometry(r.w, 0.3, r.d), mat(0x8fb06a), r.x, 0.15, r.z);
  const stream = new THREE.Shape();
  stream.moveTo(-r.w * 0.42, -r.d * 0.45);
  stream.bezierCurveTo(r.w * 0.4, -r.d * 0.2, -r.w * 0.4, r.d * 0.15, r.w * 0.34, r.d * 0.45);
  stream.lineTo(r.w * 0.1, r.d * 0.47);
  stream.bezierCurveTo(-r.w * 0.6, r.d * 0.15, r.w * 0.15, -r.d * 0.2, -r.w * 0.47, -r.d * 0.32);
  stream.closePath();
  mesh(group, new THREE.ShapeGeometry(stream, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3fa9bd, roughness: 0.15, side: THREE.DoubleSide }), r.x, 0.33, r.z);
  const tidal = mesh(group, new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), mat(0xcdbb91), r.x - r.w * 0.2, 0.32, r.z + r.d * 0.3);
  tidal.scale.set(r.w * 0.24, 1, r.d * 0.16);
  const trunk = mat(0x6b5038);
  const leaf = mat(0x3f8a4a);
  for (let k = 0; k < 13; k++) {
    const x = r.x + Math.sin(k * 2.3) * r.w * 0.42;
    const z = r.z + Math.cos(k * 1.7) * r.d * 0.44;
    const h = 2.2 + (k % 4) * 0.5;
    mesh(group, new THREE.CylinderGeometry(0.1, 0.18, h, 6), trunk, x, 0.3 + h / 2, z);
    mesh(group, new THREE.IcosahedronGeometry(1 + (k % 3) * 0.3, 1), leaf, x, 0.3 + h + 0.5, z);
  }
  for (let k = 0; k < 10; k++) {
    mesh(group, new THREE.DodecahedronGeometry(0.4 + (k % 3) * 0.28, 0), rock, r.x + Math.cos(k * 1.9) * r.w * 0.3, 0.5, r.z - r.d * 0.34 + Math.sin(k * 2.7) * r.d * 0.1).rotation.set(k, k, 0);
  }
  return [];
}

export class OutdoorScenery {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'outdoor-scenery';
    scene.add(this.group);
    this.seals = [];
    this.key = '';
  }

  /** 解放済みの屋外エリアに合わせて作り直す */
  sync(layoutId, unlocked) {
    const open = ZONES.filter((z) => z.open && unlocked.has(z.id));
    const key = `${layoutId}:${open.map((z) => z.id).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.group.clear();
    this.seals = [];
    for (const zone of open) {
      const r = rectInfo(zone.rects[0]);
      mesh(this.group, new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2), mat(GROUND[zone.id]), r.x, -0.008, r.z);
    }
    // 海獣エリアは作り付けの景観を置かず、水槽を自由に置ける更地にする
    if (unlocked.has('nature')) buildNature(this.group, getZone('nature').scenery);
  }

  update(time) {
    for (const s of this.seals) {
      const a = time * 0.5 + s.phase;
      s.seal.position.set(s.cx + Math.cos(a) * s.rx, 0.56 + Math.sin(time * 2 + s.phase) * 0.08, s.cz + Math.sin(a) * s.rz);
      s.seal.rotation.y = -a - Math.PI / 2;
    }
  }
}
