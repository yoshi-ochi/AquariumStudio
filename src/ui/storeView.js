import { ITEMS, PACKS, PASS, TEAM_UNLOCK, EXCHANGE, EARN, getItem } from '../management/walletData.js';
import { jobHtml, boostButton } from '../building/builder.js';
import { coin, dia } from './currency.js';
import { BIGWOOD_SET } from '../decor/decorData.js';
import { INTERIOR_DEFS } from '../tanks/tankData.js';

const date = (t) => new Date(t).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const kindName = { catch: '採取倍', boost: '加速', nurse: '保育管理', event: 'イベントカード' };

/**
 * ショップ：ダイヤの財布・両替・毎日のダイヤ・工事・アイテム・館長パス・調査隊の永久解放・ダイヤのパック。
 * 有料の商品は purchases.js を通す（開発中はテスト購入、本番は第7段階の App内課金まで準備中）。
 */
export class StoreView {
  constructor({ wallet, items, daily, purchases, builder, toast, onChange }) {
    Object.assign(this, { wallet, items, daily, purchases, builder, toast, onChange });
  }

  html() {
    const w = this.wallet;
    const dev = this.purchases.mode === 'dev';
    const ex = (units) => `<button data-act="st-exchange" data-id="${units}" ${w.canAfford(EXCHANGE.dia * units) ? '' : 'disabled'}>${dia(EXCHANGE.dia * units)} → ${coin(EXCHANGE.coin * units)}</button>`;
    const wallet = `<div class="st-sum"><div class="st-head"><b>ダイヤ ${dia(w.total)}</b><small>無償 ${w.free.toLocaleString('ja-JP')} ・ 有償 ${w.paid.toLocaleString('ja-JP')}</small></div>
      <small>使うときは無償ダイヤから先に減ります。ダイヤはコインに両替できます（コインはダイヤにできません）。</small>
      <div class="gs-btns">${ex(1)}${ex(10)}</div></div>`;
    const d = this.daily;
    const tasks = d.tasks.map((t) => `<li class="${t.done ? 'done' : ''}">${t.done ? '✓' : '・'} ${t.text}（${dia(t.dia)}）</li>`).join('');
    const daily = `<h4 class="gs-sub">毎日のダイヤ</h4><div class="st-sum"><small>ログインボーナス ${dia(EARN.login)}${d.state.login ? ' ・ 受け取り済み' : ''}</small>
      <ul class="st-tasks">${tasks}</ul>
      <small>清掃完了 ${dia(EARN.clean)}/回 ・ 今日あと${d.cleanLeft}回 ・ 1日の評価 S ${EARN.daily.S}〜C ${EARN.daily.C}</small></div>`;
    const job = this.builder.construction.jobs[0];
    const work = `<h4 class="gs-sub">工事</h4>${job ? `<div class="gs-row"><div class="gs-info"><b>${job.label}</b>${jobHtml(job)}</div>${boostButton(job)}</div>` : '<p class="gs-empty">進めている工事はありません。増築・昇格・生け簀の工事は同時に1件です。</p>'}`;
    const rows = ITEMS.map((it) => `<div class="gs-row"><div class="gs-info"><b>${it.name}</b><small>${it.text} ・ 所持 ${this.items.count(it.id)}</small></div>
      <button data-act="st-item" data-id="${it.id}" class="primary" ${w.canAfford(it.price) ? '' : 'disabled'}>${dia(it.price)}</button></div>`);
    const groups = Object.keys(kindName).map((k) => `<h4 class="gs-sub">${kindName[k]}</h4>${rows.filter((_, i) => ITEMS[i].kind === k).join('')}`).join('');
    const buy = (id, yen, ok = true) => `<button data-act="st-buy" data-id="${id}" class="primary" ${dev && ok ? '' : 'disabled'}>¥${yen.toLocaleString('ja-JP')}${dev ? '（テスト）' : ''}</button>`;
    const pass = `<h4 class="gs-sub">館長パス（${PASS.days}日）</h4><div class="gs-row"><div class="gs-info"><b>館長パス</b>
      <small>放置収入の上限${PASS.offlineHours}時間 ・ 調査隊+${PASS.teams}（期間中） ・ 採取倍${PASS.catchCards}枚 ・ ${PASS.dia.toLocaleString('ja-JP')}ダイヤ</small>
      <small>${w.hasPass() ? `有効：${date(w.passUntil)}まで（買い足すと${PASS.days}日延長）` : '未購入'}</small></div>${buy(PASS.id, PASS.yen)}</div>`;
    const teams = `<div class="gs-row"><div class="gs-info"><b>調査隊の永久解放</b><small>同時に出せる調査隊が1隊ずつ増えます（${TEAM_UNLOCK.max}隊まで） ・ 解放済み ${w.teams}/${TEAM_UNLOCK.max}</small></div>${buy(TEAM_UNLOCK.id, TEAM_UNLOCK.yen, w.teams < TEAM_UNLOCK.max)}</div>`;
    const woodOwned = INTERIOR_DEFS.filter((d) => d.unlock === 'dia');
    const woodLeft = woodOwned.filter((d) => !this.purchases.decor?.ownsDef(d)).length;
    const wood = `<div class="gs-row"><div class="gs-info"><b>大型流木セット</b><small>大型流木5形（枝分かれ・根張り・アーチ・倒木・ねじれ）をまとめて解放。1形ずつならカタログから${BIGWOOD_SET.dia ?? 300}ダイヤ ・ 未解放 ${woodLeft}/${woodOwned.length}</small></div>${buy(BIGWOOD_SET.id, BIGWOOD_SET.yen, woodLeft > 0)}</div>`;
    const packs = PACKS.map((p) => `<div class="gs-row"><div class="gs-info"><b>${dia(p.dia)}</b></div>${buy(p.id, p.yen)}</div>`).join('');
    const note = dev ? '<p class="gs-empty">開発中のテスト購入です（この端末にだけ記録され、お金はかかりません）。</p>' : '<p class="gs-empty">App内課金は準備中です。</p>';
    return `${wallet}${daily}${work}${groups}${pass}${teams}${wood}<h4 class="gs-sub">ダイヤ</h4>${note}${packs}`;
  }

  act(act, id) {
    if (act === 'st-exchange') {
      if (this.wallet.exchange(+id)) this.toast(`${(EXCHANGE.coin * id).toLocaleString('ja-JP')}コインに両替しました`);
    } else if (act === 'st-item') {
      const it = getItem(id);
      if (this.items.buy(id)) this.toast(`${it.name} を買いました（所持 ${this.items.count(id)}）`);
      else this.toast('ダイヤが足りません', { error: true });
    } else if (act === 'build-boost') {
      const [kind, jid] = id.split('|');
      this.builder.boost(kind, kind === 'stage' ? +jid : jid);
    } else if (act === 'st-buy') {
      this.purchases.buy(id).then(() => {
        this.toast('購入しました');
        this.onChange?.();
      }, (err) => this.toast(err.message, { error: true }));
    } else return false;
    return true;
  }
}
