import { MAX_PIECES, PIECES_PER_STAR, STAR_COUNT, fishForPieces } from '../expedition/growth.js';
import { num } from './adminUi.js';

/**
 * 成長のグラフ：横軸はピース（0〜48）、縦軸はそこまでに使う匹数（累計）。
 * 8角星形の区切りに縦の線を引く。なぞると、そのピースの匹数と累計を出す。
 */
const W = 760;
const H = 300;
const PAD = { l: 64, r: 24, t: 16, b: 40 };

function niceStep(max, count = 5) {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
}
const x = (p) => PAD.l + (p / MAX_PIECES) * (W - PAD.l - PAD.r);
const scaleTop = () => {
  const max = fishForPieces(MAX_PIECES);
  const step = niceStep(max);
  return { step, top: Math.ceil(max / step) * step };
};

export function growthChartHtml() {
  const { step, top } = scaleTop();
  const y = (v) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);
  const grid = [];
  for (let v = 0; v <= top; v += step) grid.push(`<line class="xc-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text class="xc-tick" x="${PAD.l - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`);
  const stars = Array.from({ length: STAR_COUNT }, (_, k) => {
    const a = x(k * PIECES_PER_STAR);
    const b = x((k + 1) * PIECES_PER_STAR);
    return `<line class="xc-grid" x1="${b}" x2="${b}" y1="${PAD.t}" y2="${H - PAD.b}"/><text class="xc-tick" x="${(a + b) / 2}" y="${H - PAD.b + 18}" text-anchor="middle">${k + 1}つ目</text>`;
  });
  const pts = [];
  for (let p = 0; p <= MAX_PIECES; p++) pts.push(`${x(p).toFixed(1)},${y(fishForPieces(p)).toFixed(1)}`);
  return `<div class="xc">
      <div class="xc-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ピースごとの累計の匹数">
        ${grid.join('')}${stars.join('')}<line class="xc-axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${H - PAD.b}" y2="${H - PAD.b}"/>
        <polyline class="xc-line s1" points="${pts.join(' ')}"/>
        <line class="xc-cross" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/><circle class="xc-dot" r="4" visibility="hidden"/>
        <rect class="xc-hit" x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></svg>
        <div class="xc-tip" hidden></div></div></div>`;
}

/** なぞった位置のピース（1〜48）を出す */
export function bindGrowthChart(root) {
  const box = root.querySelector('.xc');
  if (!box) return;
  const svg = box.querySelector('svg');
  const cross = box.querySelector('.xc-cross');
  const dot = box.querySelector('.xc-dot');
  const tip = box.querySelector('.xc-tip');
  const { top } = scaleTop();
  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const p = Math.max(1, Math.min(MAX_PIECES, Math.round(((sx - PAD.l) / (W - PAD.l - PAD.r)) * MAX_PIECES)));
    const px = x(p);
    const cum = fishForPieces(p);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', H - PAD.b - (cum / top) * (H - PAD.t - PAD.b));
    dot.setAttribute('visibility', 'visible');
    const k = Math.ceil(p / PIECES_PER_STAR);
    const inStar = p - (k - 1) * PIECES_PER_STAR;
    tip.innerHTML = `<b>${k}つ目の星 ${inStar}/${PIECES_PER_STAR}ピース</b><div>このピース <b>${num(cum - fishForPieces(p - 1))}匹</b></div><div>累計 <b>${num(cum)}匹</b>（${p}/${MAX_PIECES}）</div>`;
    tip.hidden = false;
    const left = (px / W) * rect.width;
    tip.style.left = `${left + 12 + tip.offsetWidth > rect.width ? Math.max(0, left - tip.offsetWidth - 12) : left + 12}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const hit = box.querySelector('.xc-hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', hide);
}
