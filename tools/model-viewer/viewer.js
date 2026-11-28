/**
 * 生成モデルの確認ビューア（開発用）。ゲームと同じ buildCreature で作った形を、全角度から見る。
 *   ?id=<種のid> で直接開ける。src/ のファイルを保存すると画面が読み直され、同じ種が出る。
 *   コンソール／Claude からは window.__viewer.show(id)・view(name)・info() が使える。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CREATURES } from '../../src/expedition/creatureData.js';
import { PLANNED } from '../../src/expedition/speciesRoster.js';
import { ANATOMY } from '../../src/expedition/creatureAnatomy.js';
import { buildCreature } from '../../src/expedition/creatureBuilder.js';

const $ = (id) => document.getElementById(id);
const VIEWS = { side: [0, 0, 1], front: [1, 0, 0], back: [-1, 0, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001], quarter: [1, 0.4, 0.6] };

// ---- 種の一覧（モデルのある種＋モデル待ちの予定種） ----
const made = new Set(CREATURES.map((c) => c.id));
const SPECIES = [
  ...CREATURES.map((c) => ({ def: c, made: true, assembled: !ANATOMY[c.id] })),
  ...PLANNED.filter((p) => !made.has(p.id)).map((p) => ({ def: p, made: false, assembled: false })),
];
const byId = new Map(SPECIES.map((s) => [s.def.id, s]));

// ---- 3D ----
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
$('mv-canvas').append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f3d55');
const camera = new THREE.PerspectiveCamera(24, 1, 0.0001, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.autoRotateSpeed = 2.4;
const holder = new THREE.Group();
scene.add(holder);

const state = { id: null, obj: null, center: new THREE.Vector3(), radius: 1, swim: false, wire: false, time: 0, visible: [] };

function resize() {
  const el = $('mv-canvas');
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('mv-canvas'));

/** 形（ジオメトリ）は種類ごとに共有されているので、材質だけ捨てる */
function clear() {
  for (const o of [...holder.children]) {
    o.traverse((m) => m.material?.dispose());
    holder.remove(o);
  }
}

function setView(name) {
  const dir = new THREE.Vector3(...(VIEWS[name] ?? VIEWS.quarter)).normalize();
  // 画面の短い辺に体が収まる距離
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fit = state.radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)) / 2);
  controls.target.copy(state.center);
  camera.position.copy(state.center).addScaledVector(dir, fit * 1.08);
  camera.near = fit / 200;
  camera.far = fit * 40;
  camera.updateProjectionMatrix();
  controls.update();
}

function triangles(obj) {
  // 近くの詳しい形だけ数える（離れたとき用の粗い形は数えない）
  const root = obj.userData.lod ? obj.userData.lod.levels[0].object : obj;
  let n = 0;
  root.traverse((m) => {
    if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return Math.round(n);
}

function show(id, { keepView = false } = {}) {
  const s = byId.get(id);
  if (!s) return false;
  clear();
  const obj = buildCreature(s.def);
  obj.traverse((m) => {
    if (m.material) m.material.wireframe = state.wire;
  });
  holder.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(state.center);
  state.radius = Math.max(size.length() / 2, 1e-6);
  Object.assign(state, { id, obj, time: 0 });
  if (!keepView) setView('quarter');

  const mm = (v) => (v * 1000 >= 100 ? `${(v * 100).toFixed(0)}cm` : `${(v * 1000).toFixed(1)}mm`);
  const kind = !s.made ? 'モデル待ち（体形からの仮の形）' : s.assembled ? '組み立て' : 'トレース';
  $('mv-info').textContent = `${s.def.name}（${id}）｜${kind}｜体形 ${s.def.form}｜全長 ${mm(s.def.len)}｜三角形 ${triangles(obj).toLocaleString()} 枚｜大きさ ${mm(size.x)} × ${mm(size.y)} × ${mm(size.z)}`;
  document.title = `${s.def.name}｜モデル確認`;
  history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
  for (const li of $('mv-list').children) li.classList.toggle('on', li.dataset.id === id);
  $('mv-list').querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  loadRefs(s.def.name);
  return true;
}

// ---- 参考画像（reference/fish。git 管理外。無ければ何も出さない） ----
async function loadRefs(name) {
  const box = $('mv-refs');
  box.replaceChildren();
  let files = [];
  try {
    files = await (await fetch(`/ref?name=${encodeURIComponent(name)}`)).json();
  } catch {
    return;
  }
  if (byId.get(state.id)?.def.name !== name) return; // 読み込み中に別の種へ移った
  for (const f of files) {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = `/ref?name=${encodeURIComponent(name)}&file=${encodeURIComponent(f)}`;
    img.alt = `${name} の参考画像`;
    const cap = document.createElement('figcaption');
    cap.textContent = f.replace('../', '');
    fig.append(img, cap);
    box.append(fig);
  }
}

// ---- 一覧 ----
function renderList() {
  const q = $('mv-search').value.trim().toLowerCase();
  const filter = $('mv-filter').value;
  let rows = SPECIES.filter((s) => (filter === 'all' ? true : filter === 'wait' ? !s.made : filter === 'assembled' ? s.made && s.assembled : s.made));
  if (q) rows = rows.filter((s) => s.def.name.toLowerCase().includes(q) || s.def.id.toLowerCase().includes(q));
  // 公開日の新しい順（最初から居る種は後ろ）
  if (filter === 'made') rows = [...rows].sort((a, b) => (b.def.released ?? '').localeCompare(a.def.released ?? ''));
  state.visible = rows.map((s) => s.def.id);
  const frag = document.createDocumentFragment();
  for (const s of rows) {
    const li = document.createElement('li');
    li.dataset.id = s.def.id;
    li.textContent = s.def.name;
    const small = document.createElement('small');
    small.textContent = s.def.released ? s.def.released.slice(5) : s.made ? '' : '待ち';
    li.append(small);
    li.classList.toggle('on', s.def.id === state.id);
    frag.append(li);
  }
  $('mv-list').replaceChildren(frag);
}

function step(d) {
  const i = state.visible.indexOf(state.id);
  const next = state.visible[(i + d + state.visible.length) % state.visible.length];
  if (next) show(next, { keepView: true });
}

// ---- 操作 ----
$('mv-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (li) show(li.dataset.id, { keepView: true });
});
$('mv-search').addEventListener('input', renderList);
$('mv-filter').addEventListener('change', renderList);
$('mv-views').addEventListener('click', (e) => e.target.dataset.view && setView(e.target.dataset.view));
$('mv-bg').addEventListener('click', (e) => e.target.dataset.bg && scene.background.set(e.target.dataset.bg));
for (const b of $('mv-bg').children) b.style.color = b.dataset.bg;

const toggle = (id, fn) =>
  $(id).addEventListener('click', () => {
    const on = $(id).getAttribute('aria-pressed') !== 'true';
    $(id).setAttribute('aria-pressed', String(on));
    fn(on);
  });
toggle('mv-swim', (on) => (state.swim = on));
toggle('mv-spin', (on) => (controls.autoRotate = on));
toggle('mv-wire', (on) => {
  state.wire = on;
  state.obj?.traverse((m) => {
    if (m.material) m.material.wireframe = on;
  });
});
toggle('mv-ref', (on) => $('mv-refs').classList.toggle('off', !on));

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') step(-1);
  else return;
  e.preventDefault();
});

// ---- 描画 ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.swim) state.time += dt;
  if (state.obj?.userData.uni) state.obj.userData.uni.uTime.value = state.time;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

renderList();
resize();
const first = new URLSearchParams(location.search).get('id');
if (!show(first)) show(state.visible[0]);
requestAnimationFrame(loop);

window.__viewer = {
  show,
  view: setView,
  info: () => $('mv-info').textContent,
  ids: () => SPECIES.map((s) => s.def.id),
};
