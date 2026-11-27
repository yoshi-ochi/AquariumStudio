import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** トンネル水槽の断面と、水位に合わせた水・水面の形 */

/** 断面（幅 w・高さ topH）にアーチ状の穴をあけた Shape */
export function tunnelShape(w, topH, r, straightH) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, topH);
  s.lineTo(-w / 2, topH);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-r, 0);
  hole.lineTo(-r, straightH);
  hole.absarc(0, straightH, r, Math.PI, 0, true);
  hole.lineTo(r, 0);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

/** 水面の高さ top でのアーチの外側の端（|x|）。アーチの頂より上なら 0（水面は全面） */
function archEdge(r, straightH, top) {
  if (top <= straightH) return r;
  const k = top - straightH;
  return k >= r ? 0 : Math.sqrt(r * r - k * k);
}

/**
 * トンネル水槽の水（幅 w・奥行 d、高さ top）。アーチ（半径 r・直線部 straightH）の頂より上なら穴付きの押し出し、
 * 低ければ通路の左右の2つの塊（アーチの曲面に沿う）
 */
export function tunnelWater(w, d, r, straightH, top) {
  const opts = { depth: d, bevelEnabled: false, curveSegments: 24 };
  if (top > straightH + r + 0.02) return new THREE.ExtrudeGeometry(tunnelShape(w, top, r, straightH), opts).translate(0, 0, -d / 2);
  const shapes = [-1, 1].map((sx) => {
    const pts = [[w / 2, 0], [r, 0], [r, Math.min(top, straightH)]];
    if (top > straightH) {
      const end = Math.asin(Math.min(1, (top - straightH) / r));
      for (let i = 1; i <= 12; i++) {
        const a = (end * i) / 12;
        pts.push([r * Math.cos(a), straightH + r * Math.sin(a)]);
      }
    }
    pts.push([w / 2, top]);
    return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(sx * x, y)));
  });
  return new THREE.ExtrudeGeometry(shapes, opts).translate(0, 0, -d / 2);
}

/** トンネル水槽の水面（アーチの頂より低ければ通路の左右だけ）。XZ 平面に寝かせたもの */
export function tunnelSurface(w, d, r, straightH, top) {
  const e = archEdge(r, straightH, top);
  if (e < 0.005) return new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const sw = Math.max(0.005, w / 2 - e);
  return mergeGeometries([-1, 1].map((sx) => new THREE.PlaneGeometry(sw, d).rotateX(-Math.PI / 2).translate(sx * (e + sw / 2), 0, 0)));
}
