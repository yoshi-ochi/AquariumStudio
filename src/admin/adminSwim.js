import { STYLE_NAMES, SWIM_KEYS, swimParams, styleOf, baseStyleOf } from '../expedition/swimStyles.js';
import { MODE_NAMES, BEH_KEYS, behaviorOf, baseBehaviorOf } from '../expedition/behaviorData.js';
import { esc } from './adminUi.js';
import { SwimPreview } from './swimPreview.js';

/**
 * 魚種の編集画面の「ひれ・泳ぎ・行動」。入力するとその場で試し見が動き、「この内容にする」で設定（c.swim・c.beh）に入る。
 * 組み込みと同じ値は保存しない（体形・泳法を変えたら、その泳法の標準値が基準になる）。
 */
const SWIM_FIELDS = [
  ['hz', '振動数（回/秒）', 0.05, '尾・ひれを1秒に振る回数'],
  ['body', '体のくねり', 0.005, '体の後ろ半分の振れ幅（体長比）'],
  ['waves', '体の波の数', 0.1, '体に乗る波の数。ウナギ型は1以上'],
  ['start', 'くねり始める位置', 0.05, '頭 0.5 〜 尾 -0.5。小さいほど尾だけが動く'],
  ['caudal', '尾びれの振れ', 0.005, ''],
  ['median', '背びれ・尻びれの振れ', 0.005, 'クリオネの翼もここ'],
  ['mWaves', '背・尻びれの波の数', 0.5, '波を流すときの波の数'],
  ['pect', '胸びれ・腹びれの振れ', 0.005, ''],
  ['pMul', '胸びれの周期倍', 0.1, '尾の何倍の速さで動かすか'],
];
const M_MODES = [[0, '波を流す（モンガラ・リュウグウノツカイ）'], [1, '同じ側へ羽ばたく（マンボウ・クリオネ）']];
const P_MODES = [[0, '前後に漕ぐ'], [1, '上下に羽ばたく（ベラ型）'], [2, '左右交互に漕ぐ（シーラカンス）']];
const BEH_FIELDS = [
  ['cruise', '巡航の速さ（体長/秒）', 0.05, 'マグロ 1.0・カツオ 1.9・ジンベエザメ 0.12'],
  ['burst', '突進の倍率', 0.5, '巡航の何倍で突進するか（1 で突進なし）'],
  ['every', '突進の間隔（秒）', 5, '0 で突進しない'],
  ['kick', 'ひと蹴りと滑走の強さ', 0.05, '0 一定の速さ 〜 1 強く蹴って惰性で滑る'],
  ['pause', '止まる割合', 0.05, '泳いでは止まる魚が止まっている割合'],
];
const r3 = (v) => Math.round(v * 1000) / 1000;
const differs = (a, b) => Math.abs(r3(a) - r3(b)) > 1e-9;

let preview = null;
/** キーの順に関係なく比べる */
const norm = (o) => JSON.stringify(o ?? null, o ? Object.keys(o).sort() : undefined);

const num = (attr, k, label, step, hint, v) =>
  `<label class="ad-field"><span>${label}</span><input type="number" ${attr}="${k}" step="${step}" value="${v == null ? '' : r3(v)}">${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
const opts = (attr, k, label, list, v) =>
  `<label class="ad-field"><span>${label}</span><select ${attr}="${k}">${list.map(([x, t]) => `<option value="${x}" ${String(x) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

/** 泳ぎの値の入力欄（style の泳法の値で埋める） */
function swimInputs(c, style) {
  const s = swimParams({ ...c, swim: style === styleOf(c) ? c.swim : { style } });
  return `${num('data-sw', 'hz', SWIM_FIELDS[0][1], 0.05, SWIM_FIELDS[0][3], s.hz)}
    ${SWIM_FIELDS.slice(1, 6).map(([k, l, st, h]) => num('data-sw', k, l, st, h, s[k])).join('')}
    ${opts('data-sw', 'mMode', '背・尻びれの動かし方', M_MODES, s.mMode)}
    ${SWIM_FIELDS.slice(6).map(([k, l, st, h]) => num('data-sw', k, l, st, h, s[k])).join('')}
    ${opts('data-sw', 'pMode', '胸びれの動かし方', P_MODES, s.pMode)}`;
}

export function swimHtml(c) {
  const style = styleOf(c);
  const b = behaviorOf(c);
  const base = baseBehaviorOf(c);
  const changed = c.swim || c.beh ? '<i>変更あり</i>' : '';
  return `<h4>ひれ・泳ぎ・行動 ${changed}<small>組み込み：${esc(STYLE_NAMES[baseStyleOf(c)])}・${esc(MODE_NAMES[base.mode])}・${base.cruise}体長/秒</small></h4>
    <div class="ad-swim-view" id="ad-swim-view"><button type="button" class="ad-swim-zoom" id="ad-swim-zoom">${preview?.follow ? '水槽全体' : '寄って見る'}</button></div>
    <p class="ad-note" id="ad-swim-info"></p>
    <p class="ad-swim-state" id="ad-swim-state"></p>
    <div class="ad-swim" id="ad-swim">
      <div class="ad-grid">${opts('data-sw', 'style', '泳法', Object.entries(STYLE_NAMES), style)}</div>
      <div class="ad-grid" id="ad-swim-params">${swimInputs(c, style)}</div>
      <div class="ad-grid">
        ${opts('data-bh', 'mode', '動き方', Object.entries(MODE_NAMES), b.mode)}
        ${BEH_FIELDS.map(([k, l, st, h]) => num('data-bh', k, l, st, h, b[k])).join('')}
        ${num('data-bh', 'layer0', '泳ぐ高さ（下）', 0.05, '水底 0 〜 水面 1', b.layer?.[0])}
        ${num('data-bh', 'layer1', '泳ぐ高さ（上）', 0.05, '', b.layer?.[1])}
      </div>
      <div class="ad-acts"><button type="button" id="ad-swim-reset">ひれ・泳ぎ・行動を組み込みに戻す</button></div>
    </div>`;
}

/** 入力欄から、組み込みと違う値だけを取り出す：{ swim, beh }（無ければ undefined） */
export function readSwim(root, c) {
  const val = (sel) => root.querySelector(sel)?.value ?? '';
  const style = val('[data-sw=style]');
  const ref = swimParams({ ...c, swim: { style } });
  const swim = {};
  if (style !== baseStyleOf(c)) swim.style = style;
  for (const k of SWIM_KEYS) {
    const v = val(`[data-sw=${k}]`);
    if (v !== '' && Number.isFinite(+v) && differs(+v, ref[k])) swim[k] = +v;
  }
  const base = baseBehaviorOf(c);
  const beh = {};
  const mode = val('[data-bh=mode]');
  if (mode && mode !== base.mode) beh.mode = mode;
  for (const k of BEH_KEYS) {
    if (k === 'mode' || k === 'layer') continue;
    const v = val(`[data-bh=${k}]`);
    if (v !== '' && Number.isFinite(+v) && differs(+v, base[k] ?? 0)) beh[k] = +v;
  }
  const layer = [val('[data-bh=layer0]'), val('[data-bh=layer1]')].map(Number);
  if (layer.every(Number.isFinite) && (differs(layer[0], base.layer[0]) || differs(layer[1], base.layer[1]))) beh.layer = layer;
  return { swim: Object.keys(swim).length ? swim : undefined, beh: Object.keys(beh).length ? beh : undefined };
}

/** 試し見を付け、入力に合わせて動かす */
export function bindSwim(root, c) {
  const view = root.querySelector('#ad-swim-view');
  const panel = root.querySelector('#ad-swim');
  if (!view || !panel) return;
  try {
    preview ??= new SwimPreview();
  } catch {
    view.textContent = 'この端末では試し見を表示できません（WebGL）';
  }
  const info = root.querySelector('#ad-swim-info');
  const update = () => {
    const d = { ...c, ...readSwim(panel, c) };
    const s = swimParams(d);
    const b = behaviorOf(d);
    const cm = (v) => (v * 100 >= 10 ? Math.round(v * 100) : r3(v * 100));
    info.textContent = `振動数 ${r3(s.hz)}回/秒 ・ 巡航 ${cm(b.cruise * c.len)}cm/秒（体長${cm(c.len)}cm × ${b.cruise}）${b.every && b.burst > 1 ? ` ・ 突進 ${cm(b.cruise * b.burst * c.len)}cm/秒（約${b.every}秒ごと）` : ''}`;
    preview?.show(d);
    if (preview?.size) {
      const { W, D, H } = preview.size;
      const u = (v) => (W >= 1 ? `${Math.round(v * 10) / 10}m` : `${cm(v)}cm`);
      info.textContent += ` ・ 水槽 幅${u(W)}×奥行${u(D)}×高さ${u(H)}（体長の15倍）`;
    }
    // 確定済みの値（c.swim・c.beh）と入力欄が違えば「未確定」
    const cur = readSwim(panel, c);
    const pending = norm(cur.swim) !== norm(c.swim) || norm(cur.beh) !== norm(c.beh);
    state.className = `ad-swim-state ${pending ? 'pending' : 'done'}`;
    state.textContent = pending ? '● 未確定：試し見だけの変更です。下の「この内容にする」で確定します' : '✓ 確定済みの内容です';
  };
  const state = root.querySelector('#ad-swim-state');
  if (preview) preview.mount(view);
  const zoom = root.querySelector('#ad-swim-zoom');
  zoom.onclick = () => {
    if (!preview) return;
    preview.follow = !preview.follow;
    zoom.textContent = preview.follow ? '水槽全体' : '寄って見る';
    preview.frame();
  };
  panel.addEventListener('input', update);
  panel.addEventListener('change', (e) => {
    // 泳法を変えたら、その泳法の標準値で入力欄を埋め直す
    if (e.target.dataset.sw === 'style') panel.querySelector('#ad-swim-params').innerHTML = swimInputs(c, e.target.value);
    update();
  });
  bindReset(panel, c, update);
  update();
}

/** 組み込みに戻す：入力欄を組み込みの値で作り直す（保存は「この内容にする」で） */
function bindReset(panel, c, update) {
  panel.querySelector('#ad-swim-reset').onclick = () => {
    panel.innerHTML = new DOMParser().parseFromString(swimHtml({ ...c, swim: undefined, beh: undefined }), 'text/html').querySelector('#ad-swim').innerHTML;
    bindReset(panel, c, update);
    update();
  };
}
