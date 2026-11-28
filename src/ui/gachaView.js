import { CATS, PRICE, PITY, machinesAt, isOpen, oddsOf } from '../gacha/gachaData.js';
import { RARITY_NAME, getCreature } from '../expedition/creatureData.js';
import { fmtLeft } from '../management/buildTimes.js';
import { pickBoost } from './boostPicker.js';
import { dia, diaBtn } from './currency.js';
import { decorOdds } from '../decor/decor.js';

const RARITY_COLOR = { 1: '#5cb85c', 2: '#3a8ad8', 3: '#9a5ad0', 4: '#d8a400' };
const egg = (cat, rarity) => `<i class="gc-egg" style="--egg:${CATS[cat].egg};--ring:${RARITY_COLOR[rarity] ?? '#9aa'}"></i>`;
const pct = (n) => `${n >= 1 ? n.toFixed(1) : n.toFixed(2)}%`;

/**
 * 卵ガチャ：並んでいる2台・確率の表示・天井・卵のふ化。
 * 卵のレア度は引いたときに分かり、中身（種）はかえるまで分からない。
 */
export class GachaView {
  constructor({ gacha, decor, wallet, items, purchases, toast, onChange }) {
    Object.assign(this, { gacha, decor, wallet, items, purchases, toast, onChange });
    this.decorLast = null; // 直前に内装ガチャで出た物
    this.odds = null; // 確率を開いている区分
    this.last = null; // 直前に引いた卵
    this.busy = false;
  }

  html() {
    const now = Date.now();
    const machines = machinesAt(now).map(({ cat, until }) => this._machine(cat, until, now)).join('');
    const last = this.last?.length
      ? `<div class="st-sum"><b>引いた卵</b><div class="gc-row">${this.last.map((e) => `<span class="gc-got">${egg(e.cat, e.rarity)}<small>${RARITY_NAME[e.rarity]}</small></span>`).join('')}</div><small>卵の中身はかえるまでのお楽しみ。下の「ふ化中の卵」から加速できます。</small></div>`
      : '';
    return `<p class="gs-empty">卵ガチャでしか手に入らない生き物がいます。2台のうち1台が3日ごとに入れ替わります。</p>${machines}${last}${this._eggs(now)}${this.decor ? this._decor() : ''}`;
  }

  _machine(cat, until, now) {
    const c = CATS[cat];
    const head = `<div class="st-head"><b>${egg(cat, 4)} ${c.name}</b><small>入れ替わりまで ${fmtLeft((until - now) / 1000)}</small></div><small>${c.text}</small>`;
    if (!isOpen(cat)) {
      return `<div class="st-sum gc-machine gc-soon">${head}<em class="gc-soon-note">近日登場 ・ 準備ができしだい引けるようになります</em></div>`;
    }
    const w = this.wallet;
    const left = this.gacha.pityLeft(cat);
    const btn = (count, price) => `<button ${diaBtn(w, price, 'gc-pull', `${cat}:${count}`, { busy: this.busy })}>${count === 10 ? '10連' : '1回'} ${dia(price)}</button>`;
    const odds = this.odds === cat ? this._odds(cat) : '';
    return `<div class="st-sum gc-machine">${head}
      <small>10連は${RARITY_NAME[3]}以上が1つ確定 ・ ${RARITY_NAME[4]}が出ずに${PITY}回引くと${RARITY_NAME[4]}が確定（あと${left}回）</small>
      <div class="gs-btns">${btn(1, PRICE.one)}${btn(10, PRICE.ten)}<button data-act="gc-odds" data-id="${cat}">${this.odds === cat ? '確率を閉じる' : '出る確率'}</button></div>${odds}</div>`;
  }

  _odds(cat) {
    const rows = oddsOf(cat).map((t) => `<tr><th colspan="2">${RARITY_NAME[t.rarity]} ${pct(t.rate)}</th></tr>${t.species.map((s) => `<tr><td>${s.name}</td><td>${pct(s.rate)}</td></tr>`).join('')}`).join('');
    return `<table class="gc-odds">${rows}</table><small>10連の確定枠・天井の回は、その条件の中で同じ割合で選びます。</small>`;
  }

  _eggs(now) {
    const eggs = [...this.gacha.eggs].sort((a, b) => a.until - b.until);
    if (!eggs.length) return '';
    const ready = eggs.filter((e) => e.until <= now).length;
    const rows = eggs.map((e) => {
      const done = e.until <= now;
      const right = done ? `<button data-act="gc-hatch" data-id="${e.seq}" class="primary">ふ化させる</button>` : `<button data-act="gc-boost" data-id="${e.seq}">⚡加速</button>`;
      return `<div class="gs-row">${egg(e.cat, e.rarity)}<div class="gs-info"><b>${CATS[e.cat].name}の${RARITY_NAME[e.rarity]}の卵</b><small>${done ? 'かえりそうです！' : `ふ化まで <span data-until="${e.until}">${fmtLeft((e.until - now) / 1000)}</span>`}</small></div>${right}</div>`;
    });
    const all = ready > 1 ? `<button data-act="gc-hatch-all" class="primary tv-wide">かえった卵をまとめてふ化（${ready}個）</button>` : '';
    return `<h4 class="gs-sub">ふ化中の卵 ${eggs.length}個</h4>${all}${rows.join('')}`;
  }

  /** 内装ガチャ（常設）：水槽台・説明プレート・天井照明のデザインと、観葉植物・和風の館内オブジェ */
  _decor() {
    const w = this.wallet;
    const btn = (count, price) => `<button ${diaBtn(w, price, 'dc-pull', count, { busy: this.busy })}>${count === 10 ? '10連' : '1回'} ${dia(price)}</button>`;
    const odds = this.odds === 'decor' ? `<table class="gc-odds">${decorOdds().map((t) => `<tr><th colspan="2">${RARITY_NAME[t.rarity]} ${pct(t.rate)}</th></tr>${t.items.map((s) => `<tr><td>${s.name}</td><td>${pct(s.rate)}</td></tr>`).join('')}`).join('')}</table>` : '';
    const got = this.decorLast?.length ? `<ul class="dc-got">${this.decorLast.map((p) => `<li><b style="color:${RARITY_COLOR[p.rarity]}">${RARITY_NAME[p.rarity]}</b> ${p.name}${p.dup ? `（持っているので ${p.coins.toLocaleString('ja-JP')}コインに）` : ' NEW'}</li>`).join('')}</ul>` : '';
    return `<h4 class="gs-sub">内装ガチャ（いつでも）</h4><div class="st-sum gc-machine"><small>水槽台・説明プレート・天井照明のデザインと、観葉植物・和風の館内オブジェが出ます。出た物は何個でも使えます（置くときはコイン）。持っている物が出たらコインに替わります。</small>
      <small>10連は${RARITY_NAME[3]}以上が1つ確定 ・ ${RARITY_NAME[4]}が出ずに${PITY}回で${RARITY_NAME[4]}が確定（あと${this.decor.pityLeft}回）</small>
      <div class="gs-btns">${btn(1, PRICE.one)}${btn(10, PRICE.ten)}<button data-act="gc-odds" data-id="decor">${this.odds === 'decor' ? '確率を閉じる' : '出る確率'}</button></div>${odds}${got}</div>`;
  }

  async _decorPull(count) {
    if (this.busy) return;
    const price = count === 10 ? PRICE.ten : PRICE.one;
    if (!this.wallet.canAfford(price)) return this.toast('ダイヤが足りません', { error: true });
    this.busy = true;
    try {
      const paidPart = Math.max(0, price - this.wallet.free);
      const { rand, serverPaid } = await this.purchases.gachaRandom('decor', count, paidPart);
      if (!this.wallet.spend(price, 'gacha:decor', { remote: !serverPaid })) throw new Error('ダイヤが足りません');
      this.decorLast = this.decor.pull(count, rand);
      const fresh = this.decorLast.filter((p) => !p.dup).length;
      this.toast(`内装ガチャ：新しく${fresh}個手に入れました`);
    } catch (err) {
      this.toast(err.message, { error: true });
    } finally {
      this.busy = false;
      this.onChange?.();
    }
  }

  act(act, id) {
    if (act === 'dc-pull') return this._decorPull(+id), true;
    if (act === 'gc-odds') this.odds = this.odds === id ? null : id;
    else if (act === 'gc-pull') {
      const [cat, n] = id.split(':');
      this._pull(cat, +n);
    } else if (act === 'gc-boost') {
      const e = this.gacha.eggs.find((x) => x.seq === +id);
      if (e) pickBoost({ items: this.items, wallet: this.wallet, toast: this.toast, left: (e.until - Date.now()) / 1000, title: '卵のふ化の加速' }).then((sec) => {
        if (sec) this.gacha.boost(id, sec);
        this.onChange?.();
      });
    } else if (act === 'gc-hatch') this._hatch([+id]);
    else if (act === 'gc-hatch-all') this._hatch(this.gacha.ready().map((e) => e.seq));
    else return false;
    return true;
  }

  async _pull(cat, count) {
    if (this.busy || !isOpen(cat) || !machinesAt().some((m) => m.cat === cat)) return;
    const price = count === 10 ? PRICE.ten : PRICE.one;
    if (!this.wallet.canAfford(price)) return this.toast('ダイヤが足りません', { error: true });
    this.busy = true;
    try {
      const paidPart = Math.max(0, price - this.wallet.free);
      const { rand, serverPaid } = await this.purchases.gachaRandom(cat, count, paidPart);
      if (!this.wallet.spend(price, `gacha:${cat}`, { remote: !serverPaid })) throw new Error('ダイヤが足りません');
      this.last = this.gacha.pull(cat, count, rand);
      const best = Math.max(...this.last.map((e) => e.rarity));
      this.toast(`${CATS[cat].name}の卵を${count}個手に入れました（最高 ${RARITY_NAME[best]}）`);
    } catch (err) {
      this.toast(err.message, { error: true });
    } finally {
      this.busy = false;
      this.onChange?.();
    }
  }

  _hatch(seqs) {
    const got = seqs.map((s) => this.gacha.hatch(s)).filter(Boolean);
    if (got.length) this.toast(`${got.map((id) => getCreature(id)?.name).join('、')} がかえりました！`, { duration: 4000 });
    this.last = null;
  }
}
