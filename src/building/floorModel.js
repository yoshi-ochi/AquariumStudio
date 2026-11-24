import * as THREE from 'three';
import { FloorPlan, CELL } from '../room/floorPlan.js';
import { TankManager } from '../tanks/tankManager.js';
import { CATEGORY } from '../tanks/tankData.js';
import { CELL_SIZE, GRID_X, GRID_Z, GRID_Z0, ZONES, floorLabel, zoneCenter, zoneHas } from './blueprint.js';

export function textSprite(text, bg, w = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 88;
  const c = canvas.getContext('2d');
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(2, 2, 380, 84, 22);
  c.fill();
  c.fillStyle = '#fff';
  c.font = '700 40px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 192, 46);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false }));
  s.scale.set(w, (w * 88) / 384, 1);
  s.renderOrder = 950;
  s.raycast = () => {};
  return s;
}

/** 1フロアの模型。全館ビューと間取り選択で使う。manager を渡すと置いてある物も表示する */
export function buildFloorModel({ floor, unlocked, manager = null }) {
  const g = new THREE.Group();
  const plan = new FloorPlan(floor, unlocked);
  const cells = [];
  for (let j = 0; j < GRID_Z; j++) for (let i = 0; i < GRID_X; i++) if (plan.at(i, j) && plan.at(i, j) !== CELL.VOID) cells.push([i, j]);
  const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, 0.3, CELL_SIZE), new THREE.MeshStandardMaterial({ roughness: 0.8 }), cells.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  cells.forEach(([i, j], k) => {
    const [x, z] = plan.cellMin(i, j);
    slab.setMatrixAt(k, m.makeTranslation(x + CELL_SIZE / 2, -0.15, z + CELL_SIZE / 2));
    const zone = ZONES.find((a) => a.floor === floor && zoneHas(a, i, j));
    const t = plan.at(i, j);
    const hex = t === CELL.LOCKED || t === CELL.LOCKED_OUT ? '#1a2026' : t === CELL.YARD ? '#c9ccd0' : zone?.color ?? '#cccccc';
    slab.setColorAt(k, color.set(hex));
  });
  slab.userData.floor = floor;
  g.userData.slab = slab;
  g.add(slab);
  const runs = plan.runs().filter((r) => r.kind !== 'rail' || r.side === CELL.OUT);
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.5, 0.14), new THREE.MeshStandardMaterial({ color: 0xf5f6f4, roughness: 0.7 }), runs.length);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  runs.forEach((r, k) => {
    const mid = (r.from + r.to) / 2;
    const pos = r.axis === 'x' ? new THREE.Vector3(mid, 0.75, r.line) : new THREE.Vector3(r.line, 0.75, mid);
    q.setFromAxisAngle(up, r.axis === 'x' ? 0 : Math.PI / 2);
    walls.setMatrixAt(k, m.compose(pos, q, new THREE.Vector3(r.to - r.from, 1, 1)));
  });
  walls.raycast = () => {};
  g.add(walls);
  const objs = manager ? [...manager.objects.values()].filter((o) => o.userData.floor === floor && !o.userData.embed) : [];
  if (objs.length) {
    const items = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), objs.length);
    objs.forEach((o, k) => {
      const def = manager.defOf(o);
      const { hx, hz } = TankManager.footprintHalf(def, o.rotation.y);
      const h = Math.min(def.size.h, 6);
      items.setMatrixAt(k, m.compose(new THREE.Vector3(o.position.x, h / 2, o.position.z), new THREE.Quaternion(), new THREE.Vector3(hx * 2, h, hz * 2)));
      items.setColorAt(k, color.set(def.category === CATEGORY.TANK ? '#2f9fd6' : '#e8dcc8'));
    });
    items.raycast = () => {};
    g.add(items);
  }
  for (const z of ZONES.filter((a) => a.floor === floor && (a.type !== 'outdoor' || a.open))) {
    const c = zoneCenter(z);
    const s = textSprite(z.name, unlocked.has(z.id) ? 'rgba(15,53,80,.9)' : 'rgba(80,88,96,.9)');
    s.position.set(c.x, 3.4, c.z);
    g.add(s);
  }
  const badge = textSprite(floorLabel(floor), '#e8862e', 5);
  badge.position.set(-(GRID_X / 2) * CELL_SIZE + 2, 2, (GRID_Z - GRID_Z0) * CELL_SIZE - 2);
  g.add(badge);
  return g;
}
