import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClient } from '@supabase/supabase-js';
import './viewer.css';
import { TankStage } from './tankStage.js';
import { unpackSnapshot } from './shareData.js';
import { getCreature } from '../expedition/creatureData.js';
import { WAVE_PARAMS, bakeWaves, waveCacheKey } from '../water/waveBaker.js';
import { loadCached, saveCached } from '../water/waveCache.js';
import { setWaveData } from '../water/waterSurface.js';

/**
 * 共有された水槽の閲覧ページ（share.html?id=xxxx）。ログイン不要。
 * Supabase の get_shared_tank で写しを1件読み、その水槽だけを置いた舞台を指で回して見る。
 */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fail = (text) => {
  $('sv-title').textContent = '水槽を表示できません';
  $('sv-msg').textContent = text;
};

async function load() {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  if (!/^[A-Za-z0-9]{10}$/.test(id)) return fail('URL が正しくありません。共有した人にもう一度送ってもらってください。');
  // 開発用：?id=DevSample1 で、端末に置いた見本の写し（localStorage の share-dev）を表示する
  if (import.meta.env.DEV && id === 'DevSample1') return show({ title: '見本の水槽', owner_name: 'テスト', data: localStorage.getItem('share-dev') });
  const URL_ = import.meta.env.VITE_SUPABASE_URL;
  const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!URL_ || !KEY) return fail('オンライン設定がありません。');
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  const res = await sb.rpc('get_shared_tank', { share_id: id });
  if (res.error) return fail(`読み込めませんでした：${res.error.message}`);
  const row = res.data?.[0];
  if (!row) return fail('この共有は見つかりません（共有がやめられたか、期限が切れました）。');
  return show(row);
}

async function show(row) {
  let snap;
  try {
    snap = unpackSnapshot(row.data);
  } catch {
    return fail('水槽のデータを読めませんでした。');
  }
  const title = row.title || snap.name || '水槽';
  document.title = `${title} | Aquarium Studio`;
  $('sv-title').textContent = title;
  $('sv-owner').textContent = row.owner_name ? `${row.owner_name} さんの水族館` : '';
  showList(snap.creatures ?? {});
  await start(snap);
}

function showList(creatures) {
  const list = Object.entries(creatures).map(([id, n]) => [getCreature(id), n]).filter(([c]) => c);
  if (!list.length) return;
  const btn = $('sv-list-btn');
  btn.hidden = false;
  btn.textContent = `生き物 ${list.length}種`;
  $('sv-list').innerHTML = `<h3>展示中の生き物</h3><ul>${list.map(([c, n]) => `<li><b>${esc(c.name)}</b>${c.sci ? `<i>${esc(c.sci)}</i>` : ''}<span>${n}匹</span></li>`).join('')}</ul>`;
  btn.onclick = () => ($('sv-list').hidden = !$('sv-list').hidden);
}

async function start(snap) {
  $('sv-msg').textContent = '水槽を準備中…';
  // 水面の動き（館内と同じ。端末に保存済みならそれを使う）
  const key = waveCacheKey();
  let waves = await loadCached(key);
  if (!waves) {
    waves = await bakeWaves(WAVE_PARAMS, (r) => ($('sv-msg').textContent = `水面を準備中… ${Math.round(r * 100)}%`));
    await saveCached(key, waves);
  }
  setWaveData(waves);
  let stage;
  try {
    stage = new TankStage(snap);
  } catch {
    return fail('この水槽は表示できません（アプリの更新をお待ちください）。');
  }
  $('sv-msg').textContent = '';
  const view = $('sv-view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true }); // stencil：岩の切り口（tanks/clipCapPass.js）
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  view.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const resize = () => {
    const w = view.clientWidth;
    const h = view.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const fit = stage.frame(camera);
  controls.target.copy(fit.center);
  controls.minDistance = fit.radius * 0.4;
  controls.maxDistance = fit.distance * 2.5;
  controls.update();
  addEventListener('resize', () => {
    resize();
    controls.update();
  });
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    stage.update(clock.getElapsedTime(), renderer, camera);
    controls.update();
    renderer.render(stage.scene, camera);
  });
}

$('sv-play').href = import.meta.env.BASE_URL;
load().catch((e) => fail(`エラー：${e.message ?? e}`));
