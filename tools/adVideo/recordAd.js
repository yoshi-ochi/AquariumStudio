/**
 * 広告用の15秒の動画（縦 1080×1920・30fps・MP4）を作る。開発用。
 * 見本の水族館（samples/showcase.json）を読み込み、カメラを台本どおりに動かして1コマずつ描き、
 * 字幕を重ねてブラウザの動画エンコーダー（WebCodecs）で MP4 にする。実時間で再生しないので、画面が遅くても滑らかになる。
 * 館内は壁・床を暗くし、水槽の水がほのかに光る演出にする（外観は昼のまま）。
 * 使い方（npm run dev 中のブラウザのコンソール）:
 *   const { recordAd } = await import('/tools/adVideo/recordAd.js');
 *   const bytes = await recordAd(window.__app);   // Uint8Array（MP4）
 *   const stills = await recordAd(window.__app, { probe: true });  // 各場面の真ん中のコマ（構図の確認）
 */
import * as THREE from '/node_modules/three/build/three.module.js';
import { Muxer, ArrayBufferTarget } from '/node_modules/mp4-muxer/build/mp4-muxer.mjs';
import { readLayoutFile } from '/src/io/layoutIO.js';
import { syncLife } from '/src/expedition/tankLife.js';
import { getDef } from '/src/tanks/tankData.js';
import { MATERIALS } from '/src/tanks/materials.js';
import { FishingScene } from '/src/expedition/fishingScene.js';
import { generatePreviews } from '/src/core/previewRenderer.js';
import { buildCreature } from '/src/expedition/creatureBuilder.js';
import { getCreature } from '/src/expedition/creatureData.js';
import { disposeObject } from '/src/tanks/tankBuilder.js';
import { zoneAt, zoneCenter } from '/src/building/blueprint.js';

const W = 1080;
const H = 1920;
const FPS = 30;
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mixV = (a, b, t) => a.clone().lerp(b, t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
/** はずむ拡大（0→1、少し行き過ぎて戻る） */
const pop = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 0.25 * Math.sin(t * Math.PI) - (1 - t) ** 3);

/** 館内を暗くする色（床・壁） */
const DARK = { floor: '#0b1017', wall: '#0d121b' };
const CATCH = [['katsuo', 6], ['buri', 3], ['maiwashi', 40], ['kuromaguro', 2]];

// ---- 広告用の展示室（別棟 10F を作り替える） ----
const HALL = 10;
const MAIN_ID = 'cx_box_1000_330_300';
/** 円柱水槽の位置（台に載せる）。北の壁一面が大水槽 */
const ROUND_AT = [[-10, -3], [-10, 2.5], [-10, 8], [10, -3], [10, 2.5], [10, 8]];
const PEDESTAL = 0.85;

/**
 * 見本データの 10F を、北の壁に埋め込んだ横 10m の大水槽と、台に載せた円柱水槽の部屋にする。
 * 東西の壁にも水槽を埋め込む（暗い部屋の左右も光る）。
 */
function buildHall(data) {
  const src = data.objects;
  const box = src.find((o) => o.defId === 'cx_box_600_300_200');
  const roundSrc = src.filter((o) => o.defId === 'round');
  const reef = src.find((o) => o.defId === 'cx_box_320_200_150');
  const jelly = src.find((o) => o.defId === 'cx_cylinder_160_180_160');
  data.objects = src.filter((o) => o.floor !== HALL);
  let uid = Math.max(...src.map((o) => o.uid ?? 0)) + 1;
  const add = (o) => data.objects.push({ uid: uid++, floor: HALL, rotY: 0, clean: { last: Date.now() }, care: { fed: Date.now(), water: 'tropical' }, contents: [], ...o });
  // 大水槽：600×300×200 の岩組みを横・奥に広げて使う
  add({
    defId: MAIN_ID, x: 0, z: -13.8,
    embed: { key: 'x:6:1:exterior', along: 0, ratio: 1, bottom: 0.12 },
    creatures: { jinbei: 2, manta: 3, kuromaguro: 8, maiwashi: 60, buri: 10, shirowani: 1, aoumigame: 2, katsuo: 6 },
    contents: (box?.contents ?? []).map((c) => ({ ...c, x: c.x * 1.6, z: c.z * 1.5 })),
  });
  // 左右の壁のサンゴ礁水槽
  for (const [key, along] of [['z:19:1:exterior', -7], ['z:53:-1:exterior', -7]]) {
    add({ defId: 'cx_box_320_200_150', x: 0, z: along, embed: { key, along, ratio: 1, bottom: 0.5 }, creatures: reef?.creatures, contents: reef?.contents ?? [] });
  }
  ROUND_AT.forEach(([x, z], i) => {
    const s = i < roundSrc.length ? roundSrc[i] : jelly;
    add({ defId: i < roundSrc.length ? 'round' : jelly.defId, x, z, creatures: s.creatures, contents: s.contents });
  });
}

export async function recordAd(app, { onProgress = () => {}, probe = false } = {}) {
  const stills = [];
  const { sceneMgr, manager, views, room } = app;
  const renderer = sceneMgr.renderer;
  const camera = sceneMgr.camera;
  const scene = sceneMgr.scene;
  const controls = app.cameraCtl.controls;

  // ---- 見本の水族館を、壁・床を暗い色にして読み込む ----
  const data = await readLayoutFile(new File([await (await fetch('/samples/showcase.json')).text()], 'showcase.json'));
  data.room.floor = { type: 'solid', color: DARK.floor };
  data.room.wall = { ...data.room.wall, color: DARK.wall };
  data.room.zoneLook = Object.fromEntries(Object.keys(data.room.zoneLook ?? {}).concat(data.room.unlocked ?? []).map((id) => [id, { floor: DARK.floor, wall: DARK.wall }]));
  buildHall(data);
  app.applySnapshot(data);
  await new Promise((r) => setTimeout(r, 1500));

  const tanks = manager.tanks;
  const onHall = tanks.filter((t) => t.userData.floor === HALL);
  const main = onHall.find((t) => manager.defOf(t).id === MAIN_ID);
  const rounds = onHall.filter((t) => !t.userData.embed);
  // レイアウトの場面：1Fの熱帯の180cm水槽を空にして、熱帯魚を入れておく
  // 部屋のいちばん端の壁沿いの水槽（正面に、部屋の中央に並ぶ大きな水槽が来ない）
  const reefRow = tanks.filter((t) => t.userData.floor === 0 && manager.defOf(t).id === 'tank180' && t.userData.care?.water === 'tropical');
  const far = (t) => {
    const z = zoneAt(0, t.position.x, t.position.z);
    const c = z ? zoneCenter(z) : { x: 0, z: 0 };
    return Math.hypot(t.position.x - c.x, t.position.z - c.z);
  };
  const stage = reefRow.sort((a, b) => far(b) - far(a))[0] ?? tanks[0];
  for (const c of [...manager.contentsOf(stage).children]) {
    manager.contentsOf(stage).remove(c);
    disposeObject(c);
  }
  stage.userData.creatures = { kakure: 4, nanyouhagi: 3, togecho: 2, kiirohagi: 3 };
  syncLife(stage);
  const center = (o, dy = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0));

  // 採取結果のアイコン（ゲームのサムネイルと同じ撮り方）
  const thumbs = await generatePreviews(CATCH.map(([id]) => getCreature(id)), buildCreature, { dispose: disposeObject });
  const thumbImg = new Map(await Promise.all([...thumbs].map(([id, url]) => new Promise((r) => { const i = new Image(); i.onload = () => r([id, i]); i.src = url; }))));

  // ---- 録画用の設定（終わったら元に戻す） ----
  app.setManual(true);
  const lights = [];
  scene.traverse((o) => o.isLight && lights.push([o, o.intensity]));
  const saved = {
    pr: renderer.getPixelRatio(), size: renderer.getSize(new THREE.Vector2()), aspect: camera.aspect, far: camera.far,
    damping: controls.enableDamping, min: controls.minDistance, max: controls.maxDistance, polar: controls.maxPolarAngle,
    bg: scene.background?.clone?.(), water: [MATERIALS.water.emissive.getHex(), MATERIALS.water.emissiveIntensity, MATERIALS.water.opacity], glass: [MATERIALS.glass.emissive.getHex(), MATERIALS.glass.emissiveIntensity],
  };
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.far = Math.max(camera.far, 600);
  camera.updateProjectionMatrix();
  Object.assign(controls, { enableDamping: false, minDistance: 0.01, maxDistance: 2000, maxPolarAngle: Math.PI });

  /** 館内の演出：暗い部屋で水槽の水が光る（on）／昼の外観（off） */
  const mood = (on) => {
    for (const [l, i] of lights) l.intensity = on ? i * (l.isSpotLight ? 0.8 : 0.45) : i;
    MATERIALS.water.emissive.setHex(on ? 0x0b5ed7 : saved.water[0]);
    MATERIALS.water.emissiveIntensity = on ? 1.1 : saved.water[1];
    MATERIALS.water.opacity = on ? 0.38 : saved.water[2];
    MATERIALS.glass.emissive.setHex(on ? 0x1260a0 : saved.glass[0]);
    MATERIALS.glass.emissiveIntensity = on ? 0.6 : saved.glass[1];
    room.grass.visible = !on;
    if (on) scene.background = new THREE.Color(0x05080d);
    else if (saved.bg) scene.background = saved.bg.clone();
    if (scene.fog) scene.fog.color.setHex(on ? 0x05080d : 0xbfe6ff);
  };

  // 来館者の表示（レイアウトの場面では水槽の前を横切らないよう消す）
  const crowdObj = app.life.crowd;
  const crowdSet = crowdObj.setVisible.bind(crowdObj);
  const crowd = (on) => (crowdObj.setVisible = on ? crowdSet : () => crowdSet(false));
  const view = (mode, floor) => {
    if (mode === 'floor') {
      views.setMode('floor');
      if (floor !== undefined && floor !== app.economy.floor) views.goFloor(floor);
    } else views.setMode(mode);
    views.tween = null; // 自前のカメラで動かす
    views.slide = 0;
  };

  // ---- 2D（字幕・タップの印・結果カード） ----
  const comp = document.createElement('canvas');
  comp.width = W;
  comp.height = H;
  const g = comp.getContext('2d');
  const font = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
  const caption = (txt, alpha) => {
    if (!txt || alpha <= 0) return;
    const lines = txt.split('\n');
    g.save();
    g.globalAlpha = alpha;
    const y0 = H * 0.74;
    g.fillStyle = 'rgba(6, 30, 48, .62)';
    g.fillRect(0, y0 - 70, W, lines.length * 96 + 70);
    g.fillStyle = '#fff';
    g.font = `800 68px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 12;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 - 34 + i * 96));
    g.restore();
  };
  const titleCard = (alpha) => {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(6, 30, 48, .55)';
    g.fillRect(0, H * 0.36, W, 420);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 18;
    g.font = `900 88px ${font}`;
    g.fillText('Aquarium Studio', W / 2, H * 0.36 + 150);
    g.font = `700 54px ${font}`;
    g.fillStyle = '#ffd36b';
    g.fillText('いますぐ無料でプレイ', W / 2, H * 0.36 + 290);
    g.restore();
  };
  /** 指でタップしている印（tap: 0〜1 で波紋） */
  const finger = (x, y, tap = 0) => {
    g.save();
    if (tap > 0) {
      g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - tap)})`;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x, y, 34 + tap * 70, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.strokeStyle = 'rgba(20,60,90,.6)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, 30, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  };
  const toScreen = (p) => {
    const q = p.clone().project(camera);
    return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H];
  };
  /** 採取結果のカード（アイコンが順に飛び出す） */
  const catchCard = (t) => {
    if (t <= 0) return;
    g.save();
    const y = H * 0.18;
    g.globalAlpha = clamp01(t * 4);
    g.fillStyle = 'rgba(255,255,255,.94)';
    g.beginPath();
    g.roundRect(70, y, W - 140, 470, 36);
    g.fill();
    g.fillStyle = '#1f6f9c';
    g.textAlign = 'center';
    g.font = `900 64px ${font}`;
    g.fillText('🎁 採取成功！', W / 2, y + 96);
    CATCH.forEach(([id, n], k) => {
      const s = pop(clamp01(t * 3 - k * 0.35));
      if (s <= 0) return;
      const cx = 70 + ((W - 140) / CATCH.length) * (k + 0.5);
      const cy = y + 270;
      const w = 200 * s;
      const h = 150 * s;
      g.fillStyle = '#e6f2f9';
      g.beginPath();
      g.roundRect(cx - w / 2, cy - h / 2, w, h, 18 * s);
      g.fill();
      const im = thumbImg.get(id);
      if (im) g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
      g.fillStyle = '#1f6f9c';
      g.font = `800 ${Math.round(44 * s)}px ${font}`;
      g.fillText(`×${n}`, cx, cy + h / 2 + 52 * s);
    });
    g.restore();
  };

  // ---- 場面ごとの準備 ----
  // 展示室：天井・円柱水槽の台とランプ・水槽の青い照り返し（録画中だけ置く）
  const base = main.getWorldPosition(new THREE.Vector3()).y - 0.12;
  const M = center(main, 1.7);
  const props = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x06090f, roughness: 0.9 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30.6, 30.6), darkMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = base + 3.6;
  props.add(ceil);
  // 天井のダウンライト（小さな光る円）
  const dlMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
  for (let x = -12; x <= 12; x += 6) for (let z = -9; z <= 12; z += 7) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), dlMat);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, base + 3.59, z);
    props.add(d);
  }
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, emissive: 0x6fb6ff, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.6 });
  for (const t of rounds) {
    const r = manager.defOf(t).size.w / 2;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, PEDESTAL, 40), darkMat);
    ped.position.set(t.position.x, base + PEDESTAL / 2, t.position.z);
    // 天井から下がる円筒のランプ（下に光を落とす）
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.7, 40, 1, true), shadeMat);
    shade.position.set(t.position.x, base + 3.25, t.position.z);
    const spot = new THREE.SpotLight(0xdff0ff, 60, 6, 0.5, 0.6, 1.2);
    spot.position.set(t.position.x, base + 2.9, t.position.z);
    spot.target.position.set(t.position.x, base, t.position.z);
    props.add(ped, shade, spot, spot.target);
  }
  // 大水槽・左右の水槽からの青い照り返し（床と天井、来館者が青く浮かぶ）
  for (const t of onHall.filter((o) => o.userData.embed)) {
    const big = t === main;
    const p = center(t, big ? 1.2 : 0.6);
    const n = v3(0, 0, 0).sub(v3(t.position.x, 0, t.position.z)).setY(0).normalize();
    const l = new THREE.PointLight(0x3aa8ff, big ? 40 : 8, big ? 14 : 6, 1.6);
    l.position.copy(p).addScaledVector(n, big ? 2.2 : 1.2);
    props.add(l);
  }
  // 大水槽の前で見入る人の影（並んだシルエット）
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x03060a });
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.75, 4, 12);
  const headGeo = new THREE.SphereGeometry(0.12, 16, 12);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) {
    const h = 0.82 + rnd() * 0.25 - (i % 5 === 0 ? 0.3 : 0); // 何人かは子ども
    const x = -4.6 + (i / 15) * 9.2 + (rnd() - 0.5) * 0.4;
    const z = -14.2 + rnd() * 1.6;
    const body = new THREE.Mesh(bodyGeo, shadowMat);
    body.scale.set(1, h, 1);
    body.position.set(x, base + 0.6 * h, z);
    const head = new THREE.Mesh(headGeo, shadowMat);
    head.position.set(x + (rnd() - 0.5) * 0.05, base + 1.32 * h + 0.06, z);
    props.add(body, head);
  }
  scene.add(props);
  props.visible = false;
  // 来館者は水槽の光を背にした影（シルエット）にする
  const crowdMats = crowdObj.parts.map((m) => m.material);
  const silhouette = (on) => crowdObj.parts.forEach((m, i) => (m.material = on ? shadowMat : crowdMats[i]));
  const hall = () => {
    view('floor', HALL);
    mood(true);
    silhouette(true);
    props.visible = true;
    for (const t of rounds) t.position.y = PEDESTAL;
  };
  const S = center(stage);
  const SI = stage.userData.interior;
  // 水槽を見る側（部屋の中央の側）
  const zone = zoneAt(stage.userData.floor, S.x, S.z);
  const zc = zone ? zoneCenter(zone) : { x: 0, z: 0 };
  const zoneMid = v3(zc.x, 0, zc.z);
  // 水槽の正面（長い面）の向き。部屋の中央を向く側から撮る
  const ry = stage.rotation.y;
  const normal = v3(Math.sin(ry), 0, Math.cos(ry));
  if (normal.dot(zoneMid.clone().sub(S)) < 0) normal.negate();
  const side = v3(normal.z, 0, -normal.x);
  const ST = v3(S.x, S.y + (SI.floorY + SI.waterTop) / 2 + 0.05, S.z);
  // 置く順：岩2つ → サンゴ → 前に背の低いサンゴ・ウミブドウ → 最後のサンゴは指で動かす
  const back = -SI.halfD * 0.35;
  const steps = [
    { f: 12, id: 'rock30', x: -0.45, z: back },
    { f: 24, id: 'rock30', x: 0.35, z: back },
    { f: 36, id: 'acropora', x: -0.45, z: back, y: 0.17 },
    { f: 46, id: 'brain', x: 0.0, z: SI.halfD * 0.2 },
    { f: 56, id: 'umibudou', x: -0.15, z: SI.halfD * 0.25 },
    { f: 64, id: 'umieda', x: -0.6, z: SI.halfD * 0.1, drag: [-0.6, 0.55] },
  ];
  const placed = [];
  const localPoint = (st, x = st.x) => stage.localToWorld(v3(x, SI.floorY + (st.y ?? 0) + 0.05, st.z));

  // 採取の場面：ゲームの漁の再現（まき網）を、別のキャンバスで1コマずつ進める
  const fishEl = document.createElement('div');
  fishEl.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;`;
  document.body.append(fishEl);
  const fishing = new FishingScene(fishEl);
  let fishingOn = false;

  // レイアウト場面：カメラと舞台の水槽の間にある水槽を隠す（手前の水面や泡で見えなくなるため）
  const blockers = tanks.filter((t) => {
    if (t === stage || t.userData.floor !== stage.userData.floor) return false;
    const d = t.position.clone().sub(S);
    const along = d.dot(normal);
    return along > 0.2 && along < 4 && Math.abs(d.dot(side)) < 3;
  });
  const clearView = (on) => blockers.forEach((t) => (t.visible = !on));

  const MF = v3(0, base + 1.75, -15.3); // 大水槽の前面の中央
  const shots = [
    {
      t: 3.2, setup: hall, caption: 'あなただけの\n水族館をつくろう',
      cam: (k) => [mixV(v3(-1.3, 1.45, 2.5), v3(0.6, 1.4, -2.5), ease(k)), MF.clone().add(v3(0, 0.45, 0))],
    },
    {
      t: 2.8, setup: hall, caption: '円柱水槽を並べて\n館内を自由にデザイン',
      cam: (k) => [mixV(v3(-1.5, base + 2.4, 13), v3(-3.5, base + 2.2, 11), ease(k)), mixV(v3(-10, base + 1.1, 0), v3(-10, base + 1.1, 3), k)],
    },
    {
      t: 3.0, setup: () => { props.visible = false; silhouette(false); view('floor', 0); mood(true); crowd(false); clearView(true); }, caption: '水槽の中も\n自由にレイアウト',
      cam: (k) => [ST.clone().addScaledVector(normal, lerp(2.9, 2.4, ease(k))).addScaledVector(side, lerp(-0.15, 0.15, k)).add(v3(0, 0.3, 0)), v3(ST.x, ST.y - 0.08, ST.z)],
      each: (i) => {
        for (const st of steps) {
          if (i === st.f && !st.item) {
            st.item = manager.createInterior(stage, st.id, { x: st.x, y: SI.floorY + (st.y ?? 0), z: st.z, rotY: 0.6 });
            placed.push(st);
          }
          if (st.item) {
            const s = pop(clamp01((i - st.f) / 8));
            st.item.scale.setScalar(Math.max(0.001, s));
            if (st.drag && i > st.f + 12) st.item.position.x = lerp(st.drag[0], st.drag[1], ease(clamp01((i - st.f - 12) / 14)));
          }
        }
      },
      overlay: (i) => {
        // 指：次に置く場所へ移動 → タップ。最後はサンゴをつかんで横へ動かす
        const next = steps.find((st) => i < st.f + 6) ?? steps[steps.length - 1];
        const prev = steps[steps.indexOf(next) - 1];
        const to = toScreen(next.drag && i > next.f ? localPoint(next, next.item?.position.x ?? next.x) : localPoint(next));
        const from = prev ? toScreen(prev.drag ? localPoint(prev, prev.drag[1]) : localPoint(prev)) : [W * 0.5, H * 0.9];
        const k = next.drag && i > next.f ? 1 : ease(clamp01((i - (prev?.f ?? 0) - 2) / Math.max(1, next.f - (prev?.f ?? 0) - 4)));
        finger(lerp(from[0], to[0], k), lerp(from[1], to[1], k), i >= next.f && i < next.f + 8 ? (i - next.f) / 8 : 0);
      },
    },
    {
      t: 3.0, setup: () => { clearView(false); crowd(true); mood(false); fishing.play('purse'); fishing.renderer.setAnimationLoop(null); fishingOn = true; }, caption: '世界の海で\n生き物を採取',
      source: () => fishing.renderer.domElement,
      each: () => {
        // 実際の漁の作業を4倍速で進める
        fishing.last = performance.now() - (1000 / FPS) * 4;
        fishing._frame();
      },
      overlay: (i, n) => catchCard((i - n * 0.45) / (n * 0.55)),
    },
    {
      t: 3.0, setup: () => { if (fishingOn) { fishing._finish(); fishingOn = false; } hall(); }, title: true,
      cam: (k) => [mixV(v3(0.8, 2.5, -4.8), v3(-0.3, 2.3, -7.2), ease(k)), MF.clone().add(v3(0, -0.1, 0))],
    },
  ];

  // ---- エンコーダー（H.264 / MP4） ----
  const muxer = probe ? null : new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' });
  const encoder = probe ? null : new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => console.error(e) });
  const config = { codec: 'avc1.640034', width: W, height: H, bitrate: 10_000_000, framerate: FPS };
  if (!probe) {
    if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('この環境では H.264 で書き出せません');
    encoder.configure(config);
  }

  try {
    const total = Math.round(shots.reduce((s, x) => s + x.t, 0) * FPS);
    let frameNo = 0;
    let time = 0;
    for (const shot of shots) {
      shot.setup();
      const n = Math.round(shot.t * FPS);
      if (!shot.source) app.frame(1 / FPS, time); // 切り替え直後の作り直しを済ませる
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        time += 1 / FPS;
        shot.each?.(i, n);
        const wanted = !probe || i === Math.floor(n * 0.7);
        if (shot.cam) {
          const [pos, target] = shot.cam(k);
          camera.position.copy(pos);
          controls.target.copy(target);
          camera.lookAt(target);
          app.frame(1 / FPS, time);
        }
        if (!wanted) continue;
        g.drawImage(shot.source ? shot.source() : renderer.domElement, 0, 0, W, H);
        shot.overlay?.(i, n);
        if (shot.title) titleCard(clamp01((i - 18) / 12));
        else caption(shot.caption, Math.min(1, Math.max(0, (i - 4) / 10), (n - 1 - i) / 8));
        const fade = Math.min(1, i / 6, (n - 1 - i) / 6);
        if (fade < 1 && !shot.title) {
          g.fillStyle = `rgba(0,0,0,${(1 - fade) * 0.85})`;
          g.fillRect(0, 0, W, H);
        }
        if (probe) {
          stills.push(comp.toDataURL('image/jpeg', 0.8));
          continue;
        }
        const vf = new VideoFrame(comp, { timestamp: Math.round((frameNo * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
        encoder.encode(vf, { keyFrame: frameNo % (FPS * 2) === 0 });
        vf.close();
        frameNo++;
        if (encoder.encodeQueueSize > 8) await new Promise((r) => encoder.addEventListener('dequeue', r, { once: true }));
        onProgress(frameNo / total);
      }
    }
    if (probe) return stills;
    await encoder.flush();
    muxer.finalize();
    return new Uint8Array(muxer.target.buffer);
  } finally {
    clearView(false);
    scene.remove(props);
    silhouette(false);
    for (const t of rounds) t.position.y = 0;
    if (fishingOn) fishing._finish();
    fishEl.remove();
    crowd(true);
    encoder?.close?.();
    mood(false);
    for (const st of placed) st.item?.scale.setScalar(1);
    renderer.setPixelRatio(saved.pr);
    renderer.setSize(saved.size.x, saved.size.y, false);
    camera.aspect = saved.aspect;
    camera.far = saved.far;
    camera.updateProjectionMatrix();
    Object.assign(controls, { enableDamping: saved.damping, minDistance: saved.min, maxDistance: saved.max, maxPolarAngle: saved.polar });
    app.setManual(false);
    window.dispatchEvent(new Event('resize'));
  }
}
