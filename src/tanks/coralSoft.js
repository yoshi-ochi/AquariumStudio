import * as THREE from 'three';
import { Parts, colony, place, stem, tone, flat } from './colonyKit.js';

/**
 * ソフトコーラル・イソギンチャク類。どれも growth.ext の方向へ群体（クローン）が広がり、growth.density で数が変わる。
 *   ウミキノコ（Sarcophyton）… 太い柄の上に縁の波打つ傘。傘の上面にポリプが密に開いて毛羽立って見える
 *   イソギンチャクモドキ（Discosoma / Rhodactis）… 直径2〜5cmの円盤が岩を覆う。中央に口、放射状の筋と斑点。赤・青・緑
 *   タマイタダキイソギンチャク（Entacmaea quadricolor）… 体壁は赤〜赤紫。触手は褐色〜緑で先端近くが球状に膨らみ、先は桃〜紫。
 *     触手は8〜10cm。単体（口盤40cmまで）か、小さな個体のクローンの群れ。クマノミ類の宿主
 *   センジュイソギンチャク（Heteractis magnifica）… 体壁は赤・紫・青などの鮮やかな色。指状の長い触手が口盤を覆う。
 *     岩の上の流れのよい場所に付く。カクレクマノミ・ハナビラクマノミの宿主
 *   ハタゴイソギンチャク（Stichodactyla gigantea）… 平らで縁が大きく波打つ口盤（〜80cm）を、短くねばる触手が絨毯のように覆う。砂地
 */

/** ウミキノコ：柄・波打つ傘・傘の上の毛羽立ったポリプ */
function sarcophyton(g, def, opt) {
  const P = new Parts();
  const polyp = new THREE.ConeGeometry(0.0012, 0.006, 4).translate(0, 0.003, 0);
  const pal = [[0xd8c890, 0xe8dca0], [0xb8a070, 0xd8c080], [0xc8b0a0, 0xe8d8b0]][opt.seed % 3];
  for (const c of colony(opt, 0.05, 90)) {
    const sh = 0.03 + c.rand() * 0.03;
    const R = 0.028 + c.rand() * 0.02;
    const base = new THREE.Vector3(c.x, c.y, c.z);
    const st = stem(R * 0.45, R * 0.35, sh, 9);
    P.add(st, tone(0xe6dcc6, c.rand, 0.05), place(base));
    st.dispose();
    const cap = new THREE.RingGeometry(0.002, R, 22, 5); // 内側にも頂点がある円盤（ポリプを面全体に付ける）
    const pos = cap.attributes.position;
    const ph = c.rand() * 6;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = Math.hypot(x, y) / R;
      pos.setZ(i, Math.sin(Math.atan2(y, x) * 5 + ph) * 0.008 * t * t - t * t * 0.006); // 縁が波打ち、少し垂れる
    }
    const top = base.clone().add(new THREE.Vector3(0, sh, 0));
    const capM = place(top, flat(0, c.rand() * 6));
    P.add(cap, tone(pal[0], c.rand, 0.05), capM);
    // 傘の上面のポリプ（中央の禿げた部分を残す）
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 2) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (v.length() < R * 0.25) continue;
      v.applyMatrix4(capM);
      P.add(polyp, tone(pal[1], c.rand, 0.08), place(v, new THREE.Vector3((c.rand() - 0.5) * 0.4, 1, (c.rand() - 0.5) * 0.4)));
    }
    cap.dispose();
  }
  polyp.dispose();
  P.into(g, { double: true, roughness: 0.8, flat: false });
}

/** イソギンチャクモドキ：円盤が重なり合って岩を覆う */
function discosoma(g, def, opt) {
  const P = new Parts();
  const pal = [[0xb03a4a, 0xe86a7a], [0x3a5ab0, 0x7aa0e8], [0x3a8a5a, 0x8ad06a], [0x8a3a9a, 0xd080e0]][opt.seed % 4];
  for (const c of colony(opt, 0.06, 1100)) {
    const r = 0.01 + c.rand() * 0.012;
    const disc = new THREE.CircleGeometry(r, 16);
    const pos = disc.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.hypot(pos.getX(i), pos.getY(i)) / r;
      pos.setZ(i, t * t * r * 0.35 - (t < 0.15 ? 0.001 : 0)); // 皿のようにくぼみ、中央に口
    }
    const a = tone(pal[0], c.rand, 0.1);
    const b = tone(pal[1], c.rand, 0.1);
    const spot = (i, p) => {
      const x = p.getX(i);
      const y = p.getY(i);
      return Math.sin(Math.atan2(y, x) * 9) > 0.3 && Math.hypot(x, y) > r * 0.4 ? b : a; // 放射状の筋と斑
    };
    P.add(disc, spot, place([c.x, c.y + 0.004 + c.rand() * 0.004, c.z], flat((c.rand() - 0.5) * 0.6, c.rand() * 6, (c.rand() - 0.5) * 0.6)));
    disc.dispose();
  }
  P.into(g, { double: true, roughness: 0.55, flat: false });
}

/** イソギンチャクの体（体壁の柱と口盤）を作り、口盤の上の触手の付け根の点を返す */
function anemoneBody(P, c, { R, h, column, disc }) {
  const base = new THREE.Vector3(c.x, c.y, c.z);
  const col = stem(R * 0.75, R * 0.9, h, 14);
  P.add(col, tone(column, c.rand, 0.06), place(base));
  col.dispose();
  const plate = new THREE.CircleGeometry(R, 18).rotateX(-Math.PI / 2);
  P.add(plate, tone(disc, c.rand, 0.06), place(base.clone().add(new THREE.Vector3(0, h, 0))));
  plate.dispose();
  return base.add(new THREE.Vector3(0, h, 0));
}

/** タマイタダキイソギンチャク：先端近くが球状に膨らむ触手。先は桃〜紫 */
function entacmaea(g, def, opt) {
  const P = new Parts();
  const bulb = new THREE.SphereGeometry(1, 7, 5);
  const tipC = 0xd84a9a;
  const bodyC = [0x9a7a4a, 0x6a8a4a, 0x8a3a3a][opt.seed % 3];
  for (const c of colony(opt, 0.05, 45)) {
    const R = 0.025 + c.rand() * 0.015;
    const top = anemoneBody(P, c, { R, h: 0.02 + c.rand() * 0.01, column: 0xb8305a, disc: bodyC });
    const n = 34;
    for (let k = 0; k < n; k++) {
      const a = k * 2.4 + c.rand() * 0.3; // 黄金角で口盤に均等に並べる
      const d = Math.sqrt((k + 0.5) / n) * R * 0.9;
      const from = top.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      const dir = new THREE.Vector3(Math.cos(a) * (d / R) * 0.9, 1, Math.sin(a) * (d / R) * 0.9).normalize();
      const len = 0.03 + c.rand() * 0.025;
      const t = stem(0.0028, 0.0035, len * 0.7, 5);
      P.add(t, tone(bodyC, c.rand, 0.08), place(from, dir));
      t.dispose();
      const bp = from.clone().addScaledVector(dir, len * 0.78);
      P.add(bulb, tone(bodyC, c.rand, 0.1), place(bp, dir, new THREE.Vector3(0.0055, 0.008, 0.0055)));
      P.add(bulb, tone(tipC, c.rand, 0.1), place(bp.clone().addScaledVector(dir, 0.0075), dir, 0.0026));
    }
  }
  bulb.dispose();
  P.into(g, { roughness: 0.5, flat: false });
}

/** センジュイソギンチャク：鮮やかな体壁と、口盤を覆う長い指状の触手 */
function heteractis(g, def, opt) {
  const P = new Parts();
  const column = [0xc8283a, 0x7a3aa8, 0x3a5ac8][opt.seed % 3];
  const tip = new THREE.SphereGeometry(0.0023, 5, 4);
  for (const c of colony(opt, 0.07, 25)) {
    const R = 0.04 + c.rand() * 0.02;
    const top = anemoneBody(P, c, { R, h: 0.025 + c.rand() * 0.015, column, disc: 0xc8b878 });
    const n = 130;
    for (let k = 0; k < n; k++) {
      const a = k * 2.4;
      const d = Math.sqrt((k + 0.5) / n) * R * 0.95;
      const from = top.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      // 指状の触手：根元は外へ、先は流れになびいて上へ曲がる（2節）
      const out = 0.5 + (d / R) * 1.4;
      const d1 = new THREE.Vector3(Math.cos(a) * out, 1, Math.sin(a) * out).normalize();
      const d2 = new THREE.Vector3(Math.cos(a) * out * 0.4 + (c.rand() - 0.5) * 0.4, 1, Math.sin(a) * out * 0.4 + (c.rand() - 0.5) * 0.4).normalize();
      const len = 0.012 + c.rand() * 0.01;
      const hue = tone(c.rand() < 0.7 ? 0xb8c060 : 0xd8c890, c.rand, 0.08);
      const s1 = stem(0.0032, 0.0027, len, 5);
      const s2 = stem(0.0027, 0.0022, len, 5);
      P.add(s1, hue, place(from, d1));
      const mid = from.clone().addScaledVector(d1, len);
      P.add(s2, hue, place(mid, d2));
      s1.dispose();
      s2.dispose();
      P.add(tip, hue, place(mid.addScaledVector(d2, len)));
    }
  }
  tip.dispose();
  P.into(g, { roughness: 0.55, flat: false });
}

/** ハタゴイソギンチャク：縁が大きく波打つ平らな口盤を、短い触手が絨毯のように覆う */
function stichodactyla(g, def, opt) {
  const P = new Parts();
  const tent = new THREE.ConeGeometry(0.0016, 0.006, 4).translate(0, 0.003, 0);
  const pal = [[0x5a8a4a, 0x8ac06a], [0x8a6a4a, 0xc8a070], [0x7a4a8a, 0xb08ad0]][opt.seed % 3];
  for (const c of colony(opt, 0.08, 18)) {
    const R = 0.05 + c.rand() * 0.03;
    const disc = new THREE.RingGeometry(0.003, R, 36, 7);
    const pos = disc.attributes.position;
    const ph = c.rand() * 6;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = Math.hypot(x, y) / R;
      pos.setZ(i, Math.sin(Math.atan2(y, x) * 6 + ph) * 0.012 * t * t + 0.008);
    }
    const m = place([c.x, c.y, c.z], flat(0, c.rand() * 6));
    P.add(disc, tone(pal[0], c.rand, 0.05), m);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (v.length() < R * 0.12) continue;
      v.applyMatrix4(m);
      P.add(tent, tone(c.rand() < 0.8 ? pal[1] : pal[0], c.rand, 0.1), place(v));
    }
    disc.dispose();
  }
  tent.dispose();
  P.into(g, { double: true, roughness: 0.5, flat: false });
}

export const SOFT_BUILDERS = { sarcophyton, discosoma, entacmaea, heteractis, stichodactyla };
