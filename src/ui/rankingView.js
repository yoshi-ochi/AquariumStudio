import { getCreature, RARITY_NAME } from '../expedition/creatureData.js';
import { RANK_WEIGHT, MAX_PIECES, speciesPoints, totalScore } from '../expedition/growth.js';
import { octagrams } from './octagram.js';
import { creatureThumb } from './creatureThumb.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Math.round(n).toLocaleString('ja-JP');

/**
 * 総合レベルのランキング。自分の総合レベルの内訳（魚種ごとの（ピース＋1）×レア度の重み）と、全国の上位100人。
 * 点数は5分ごと（と、この画面を開いたとき）にサーバーへ送る。
 */
export class RankingView {
  constructor({ manager, expeditions, online, previews, isVisiting, onLoaded }) {
    Object.assign(this, { manager, expeditions, online, previews, isVisiting, onLoaded });
    this.data = null;
    this.error = '';
    this.loading = false;
    this.sent = null;
  }

  get score() {
    return totalScore(this.manager.tanks, (id) => this.expeditions.pieces(id));
  }

  /** 展示している魚種ごとの点数（多い順） */
  _parts() {
    const ids = new Set();
    for (const t of this.manager.tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) if (n > 0 && getCreature(id)) ids.add(id);
    return [...ids].map((id) => {
      const c = getCreature(id);
      const pieces = this.expeditions.pieces(id);
      return { id, c, pieces, pts: speciesPoints(id, pieces) };
    }).sort((a, b) => b.pts - a.pts);
  }

  /** 点数が変わっていればサーバーへ送る */
  async submit(force = false) {
    if (!this.online.user || this.isVisiting()) return;
    const parts = this._parts();
    const score = Math.round(parts.reduce((s, p) => s + p.pts, 0));
    const key = `${score}:${parts.length}`;
    if (!force && key === this.sent) return;
    await this.online.submitScore(score, parts.length);
    this.sent = key;
  }

  async load() {
    if (!this.online.user || this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      await this.submit(true);
      this.data = await this.online.ranking();
    } catch (err) {
      this.error = err.message;
    }
    this.loading = false;
    this.onLoaded();
  }

  html() {
    const parts = this._parts();
    const score = Math.round(parts.reduce((s, p) => s + p.pts, 0));
    const me = this.online.user?.id;
    const rank = this.data?.rank;
    const head = `<div class="mo-card"><small>あなたの総合レベル${rank ? ` ・ 全国 ${num(rank)}位` : ''}</small><b>${num(score)}</b>
      <small>展示している ${parts.length}種の「（埋めたピース＋1）×レア度の重み」の合計。同じ魚種を育ててピースを埋めると上がります。</small></div>`;
    const top = parts.slice(0, 5).map((p) => `<div class="gs-row">${creatureThumb(this.previews, p.id)}<div class="gs-info"><b>${p.c.name}</b>${octagrams(p.pieces, { mini: true })}<small>${p.pieces}/${MAX_PIECES}ピース ・ レア度 ${RARITY_NAME[p.c.rarity]} ×${RANK_WEIGHT[p.c.rarity]} ＝ ${num(p.pts)}</small></div></div>`).join('');
    let board;
    if (!me) board = '<p class="gs-empty">ログインするとランキングに参加できます。</p>';
    else if (this.error) board = `<p class="gs-empty">${esc(this.error)}</p><button data-act="rank-reload">再読み込み</button>`;
    else if (!this.data) board = '<p class="gs-empty">読み込み中…</p>';
    else if (!this.data.rows.length) board = '<p class="gs-empty">まだ参加者がいません。</p>';
    else {
      board = this.data.rows.map((r) => `<div class="rk-row ${r.user_id === me ? 'me' : ''}"><b>${num(r.pos)}</b><span>${esc(r.name)}</span><small>${num(r.species)}種</small><em>${num(r.score)}</em></div>`).join('');
    }
    return `${head}${top ? `<h4 class="gs-sub">点数の多い魚種</h4>${top}` : '<p class="gs-empty">生き物を展示すると点数が入ります。</p>'}
      <h4 class="gs-sub">全国ランキング（上位100）</h4>${board}`;
  }

  act(act) {
    if (act !== 'rank-reload') return false;
    this.load();
    return true;
  }
}
