import { STAR_LIST } from '../expedition/creatureData.js';
import { MAX_LEVEL, GROWTH_RULES, xpForStarLevel } from '../expedition/growth.js';
import { num } from './adminUi.js';

/**
 * レベルアップに要る経験値のグラフ（SVG の折れ線、星の数ごとに1本）。
 * mode: 'step'（次のレベルまで）/ 'cum'（Lv1 からの累計）。ホバーで十字線とツールチップ。
 */
const W = 760;
const H = 300;
const PAD = { l: 64, r: 72, t: 16, b: 36 };
const SERIES = STAR_LIST;

const valueAt = (mode, lv, r) => (mode === 'cum' ? xpForStarLevel(lv, r) : xpForStarLevel(lv + 1, r) - xpForStarLevel(lv, r));
const lastLevel = (mode) => (mode === 'cum' ? MAX_LEVEL : MAX_LEVEL - 1);

/** 目盛りのきりのよい間隔 */
function niceStep(max, count = 5) {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
}
const short = (n) => (n >= 1e8 ? `${+(n / 1e8).toFixed(1)}億` : n >= 1e4 ? `${+(n / 1e4).toFixed(1)}万` : num(n));

export function xpChartHtml(mode) {
  const end = lastLevel(mode);
  const max = Math.max(...SERIES.map((r) => valueAt(mode, end, r)), 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const x = (lv) => PAD.l + ((lv - 1) / (MAX_LEVEL - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);
  const grid = [];
  for (let v = 0; v <= top; v += step) grid.push(`<line class="xc-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text class="xc-tick" x="${PAD.l - 8}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`);
  const xs = [1, 100, 200, 300, 400, 500, 600, 700, 800, 900, MAX_LEVEL].map((lv) => `<text class="xc-tick" x="${x(lv)}" y="${H - PAD.b + 18}" text-anchor="middle">${lv === 1 ? 'Lv1' : lv}</text>`);
  // 同じ値の線が重なる（倍率が同じ）ときは、ラベルを縦にずらす
  const ends = SERIES.map((r) => ({ r, y: y(valueAt(mode, end, r)) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  const lines = SERIES.map((r) => {
    const pts = [];
    for (let lv = 1; lv <= end; lv += lv < 20 ? 1 : 4) pts.push(`${x(lv).toFixed(1)},${y(valueAt(mode, lv, r)).toFixed(1)}`);
    pts.push(`${x(end).toFixed(1)},${y(valueAt(mode, end, r)).toFixed(1)}`);
    const ly = ends.find((e) => e.r === r).y;
    return `<polyline class="xc-line s${r}" points="${pts.join(' ')}"/><text class="xc-label" x="${W - PAD.r + 6}" y="${ly + 4}">星${r}</text>`;
  }).join('');
  const legend = SERIES.map((r) => `<span><i class="xc-key s${r}"></i>星${r}（×${Math.max(0.05, GROWTH_RULES.levelMul[r] ?? 1)}）</span>`).join('');
  return `<div class="xc" data-mode="${mode}">
      <div class="xc-legend">${legend}</div>
      <div class="xc-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="レベルごとの${mode === 'cum' ? '累計' : '必要'}経験値">
        ${grid.join('')}${xs.join('')}<line class="xc-axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${H - PAD.b}" y2="${H - PAD.b}"/>
        ${lines}<line class="xc-cross" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/>
        <rect class="xc-hit" x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></svg>
        <div class="xc-tip" hidden></div></div></div>`;
}

/** ホバー（タッチ）で、そのレベルの値と要る匹数を出す */
export function bindXpChart(root, fishFor) {
  const box = root.querySelector('.xc');
  if (!box) return;
  const mode = box.dataset.mode;
  const svg = box.querySelector('svg');
  const cross = box.querySelector('.xc-cross');
  const tip = box.querySelector('.xc-tip');
  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const lv = Math.max(1, Math.min(lastLevel(mode), Math.round(1 + ((sx - PAD.l) / (W - PAD.l - PAD.r)) * (MAX_LEVEL - 1))));
    const px = PAD.l + ((lv - 1) / (MAX_LEVEL - 1)) * (W - PAD.l - PAD.r);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');
    const rows = SERIES.map((r) => {
      const v = valueAt(mode, lv, r);
      return `<div><i class="xc-key s${r}"></i>星${r} <b>${num(v)}</b> <small>${num(Math.ceil(v / fishFor(r)))}匹</small></div>`;
    }).join('');
    tip.innerHTML = `<b>${mode === 'cum' ? `Lv${lv} まで（累計）` : `Lv${lv} → ${lv + 1}`}</b>${rows}`;
    tip.hidden = false;
    const left = (px / W) * rect.width;
    tip.style.left = `${Math.min(rect.width - tip.offsetWidth, Math.max(0, left + 12 + tip.offsetWidth > rect.width ? left - tip.offsetWidth - 12 : left + 12))}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const hit = box.querySelector('.xc-hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', hide);
}
