/**
 * 最初のリール動画「空っぽの水槽に、3匹がやってくる」のコマを作る（開発用）。
 * 縦 1080×1920・20秒・30コマ/秒。コマ（JPEG）を受け取りサーバーへ送り、ffmpeg で MP4 にまとめる。
 * 使い方（npm run dev 中のブラウザのコンソール）:
 *   const { createReel } = await import('/tools/reel/reel01.js');
 *   const reel = createReel();
 *   await reel.capture(0, 600); // コマ番号の範囲
 */
import * as THREE from 'three';
import { CREATURES } from '/src/expedition/creatureData.js';
import { buildCreature } from '/src/expedition/creatureBuilder.js';
import { getDef } from '/src/tanks/tankData.js';
import { buildObject } from '/src/tanks/tankBuilder.js';
import { createClipUniforms, updateClipUniforms, applyClip } from '/src/tanks/tankClip.js';

const W = 1080;
const H = 1920;
export const FPS = 30;
export const DURATION = 20;
const RECV = 'http://localhost:5297/';
const FONT = '"Yu Gothic", "YuGothic", "Meiryo", sans-serif';

// 置く物：[出る秒, id, x, z, { y（砂からの高さ）, ry, s }]
const OBJECTS = [
  [8.3, 'rock50', -0.08, -0.18, { ry: 0.4, s: 1.35 }],
  [9.0, 'rock30', -0.36, -0.02, { ry: 1.2, s: 1.2 }],
  [9.6, 'rock30', 0.32, -0.14, { ry: 2.1, s: 1.15 }],
  [10.1, 'rock30_brown', 0.1, -0.4, { ry: 0.8 }],
  [10.5, 'rock10', 0.3, 0.22, { ry: 0.3, s: 1.2 }],
  [11.2, 'heteractis', -0.06, -0.12, { y: 0.38, s: 1.8 }],
  [13.2, 'acropora', 0.33, -0.14, { y: 0.34, s: 1.7 }],
  [13.8, 'montipora', -0.37, -0.01, { y: 0.36, s: 1.6 }],
  [14.4, 'euphyllia', 0.3, 0.22, { y: 0.07, s: 1.7 }],
  [15.0, 'gsp', -0.22, 0.28, { s: 1.8 }],
  [15.5, 'discosoma', 0.02, 0.34, { s: 1.8 }],
  [16.0, 'tosaka', -0.4, -0.32, { y: 0.05, s: 1.6 }],
  [16.4, 'pocillopora', 0.12, -0.42, { y: 0.25, s: 1.5 }],
];

// 魚：sc 見やすくする拡大、r/y/w/a0 水槽内を回る半径・高さ・速さ・初めの角度、s〜e 外から水槽へ入る秒
const FISH = [
  { id: 'kakure', sc: 5.5, r: 0.36, y: 0.56, w: 0.9, a0: 1.0, s: 2.0, e: 4.6 },
  { id: 'nanyouhagi', sc: 4.2, r: 0.38, y: 0.8, w: -0.7, a0: 3.0, s: 2.4, e: 5.8 },
  { id: 'tsunodashi', sc: 3.2, r: 0.33, y: 0.66, w: 0.6, a0: 5.0, s: 2.8, e: 7.0 },
];

// 字幕：[出る秒, 消える秒, 文]
const CAPTIONS = [
  [0.2, 2, '空っぽの水槽から、はじめます'],
  [2.1, 4.5, '慶良間の海から、3匹'],
  [4.6, 5.8, 'カクレクマノミ'],
  [5.8, 7.0, 'ナンヨウハギ'],
  [7.0, 8.2, 'ツノダシ'],
  [8.3, 11, '岩を組んで'],
  [11.1, 13, 'すみかを作って'],
  [13.1, 17, 'サンゴを植えて'],
  [17.2, 19.7, 'あなたの水槽を、つくろう。'],
];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const back = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2; // 少し行き過ぎて戻る

export function createReel() {
  const gl = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 6, 3);
  scene.add(key);

  const tank = buildObject(getDef('round'));
  scene.add(tank);
  const F = tank.userData.interior.floorY;
  // アプリと同じ側面クリップ（ガラスの外へはみ出た岩やサンゴを切り取る）。水紋は使わない
  const clip = createClipUniforms(tank.userData.interior);
  clip.uCauOn.value = 0;
  tank.userData.clip = clip;
  updateClipUniforms(tank);

  const objs = OBJECTS.map(([t0, id, x, z, { y = 0, ry = 0, s = 1 } = {}]) => {
    const o = buildObject(getDef(id));
    o.position.set(x, F + y, z);
    o.rotation.y = ry;
    o.visible = false;
    applyClip(o, clip);
    tank.add(o);
    return { o, t0, s, y: F + y };
  });

  const fish = FISH.map((f) => {
    const o = buildCreature(CREATURES.find((c) => c.id === f.id));
    o.scale.setScalar(f.sc);
    o.rotation.order = 'YZX';
    o.visible = false;
    scene.add(o);
    return { ...f, o };
  });

  const cam = new THREE.PerspectiveCamera(22, W / H, 0.05, 100);
  const target = new THREE.Vector3(0, 0.8, 0);
  // 少し斜め上からゆっくり回り、最後に大きく回る
  const camAt = (t) => {
    const th = 0.2 + 0.1 * t + smooth(17, 20, t) * 1.5;
    const el = 0.3;
    return new THREE.Vector3(Math.sin(th) * Math.cos(el), Math.sin(el), Math.cos(th) * Math.cos(el)).multiplyScalar(6.55).add(target);
  };

  const inTank = (i, t) => {
    const f = fish[i];
    let { r } = f;
    let cx = 0;
    let cz = 0;
    let y = F + f.y;
    if (i === 0) {
      // カクレクマノミはイソギンチャクが置かれたら近くへ寄る
      const m = smooth(11.4, 12.6, t);
      r += (0.2 - r) * m;
      cx = -0.05 * m;
      cz = 0.04 * m;
      y += 0.1 * m;
    }
    const a = f.a0 + f.w * t;
    return new THREE.Vector3(cx + r * Math.cos(a), y + 0.03 * Math.sin(1.3 * t + i * 2), cz + r * Math.sin(a));
  };
  // 画面の右の外 → 水槽の真上 → 水槽の中
  const right = new THREE.Vector3().subVectors(target, camAt(3)).cross(new THREE.Vector3(0, 1, 0)).normalize();
  const posOf = (i, t) => {
    const f = fish[i];
    if (t >= f.e) return inTank(i, t);
    const u = smooth(f.s, f.e, t);
    const A = right.clone().multiplyScalar(1.25).add(new THREE.Vector3(0, 1.22 + 0.08 * i, 0));
    const B = new THREE.Vector3(0.1, 1.5, 0);
    const C = inTank(i, f.e);
    return A.multiplyScalar((1 - u) ** 2).add(B.multiplyScalar(2 * u * (1 - u))).add(C.multiplyScalar(u * u));
  };

  function frame(t) {
    cam.position.copy(camAt(t));
    cam.lookAt(target);
    for (const { o, t0, s, y } of objs) {
      const k = (t - t0) / 0.45;
      o.visible = k > 0;
      if (!o.visible) continue;
      const e = Math.min(k, 1);
      o.scale.setScalar(s * Math.max(0.001, back(e)));
      o.position.y = y + (1 - e) * 0.12;
    }
    fish.forEach((f, i) => {
      f.o.visible = t >= f.s;
      if (!f.o.visible) return;
      const p = posOf(i, t);
      const d = posOf(i, t + 0.03).sub(p);
      f.o.position.copy(p);
      f.o.rotation.set(0, Math.atan2(-d.z, d.x), Math.max(-0.9, Math.min(0.9, Math.atan2(d.y, Math.hypot(d.x, d.z)))));
      f.o.userData.uni.uTime.value = t + i;
    });
    renderer.render(scene, cam);

    // 背景（夜の紺と、水槽の後ろの光）→ 3D → 字幕
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c2852');
    g.addColorStop(1, '#030c22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, 1080, 60, W / 2, 1080, 820);
    rg.addColorStop(0, 'rgba(80,170,255,0.42)');
    rg.addColorStop(1, 'rgba(80,170,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(gl, 0, 0);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [a, b, s] of CAPTIONS) {
      const al = Math.min(smooth(a, a + 0.25, t), 1 - smooth(b - 0.25, b, t));
      if (al <= 0) continue;
      ctx.globalAlpha = al;
      ctx.fillStyle = '#fff';
      ctx.font = `700 68px ${FONT}`;
      ctx.fillText(s, W / 2, 300 - (1 - smooth(a, a + 0.25, t)) * 14);
    }
    const ta = smooth(17.6, 18.0, t) * (1 - smooth(19.45, 19.7, t));
    if (ta > 0) {
      ctx.globalAlpha = ta;
      ctx.fillStyle = '#bfe1ff';
      ctx.font = `700 46px ${FONT}`;
      ctx.fillText('水族館をつくるゲーム「アクスタ」', W / 2, 396);
    }
    // 最初と最後を同じ色へ溶かして、繰り返しのつなぎ目を目立たなくする
    const fade = Math.max(1 - smooth(0, 0.35, t), smooth(19.6, 20, t));
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#071833';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  const send = async (name, quality = 0.93) => (await fetch(`${RECV}?name=${name}`, { method: 'POST', body: out.toDataURL('image/jpeg', quality).split(',')[1] })).text();

  /** 秒を指定して1枚だけ送る（確認用） */
  async function still(t, name) {
    frame(t);
    return send(name, 0.85);
  }

  /** コマ番号 from 以上 to 未満を送る */
  async function capture(from = 0, to = FPS * DURATION) {
    for (let i = from; i < to; i++) {
      frame(i / FPS);
      await send(`f_${String(i).padStart(4, '0')}.jpg`);
    }
    return to;
  }

  return { frame, still, capture, canvas: out };
}
