import { ITEMS, PACKS, PASS, TEAM_UNLOCK, EXCHANGE, EARN, getItem } from '../management/walletData.js';
import { jobHtml, boostButton } from '../building/builder.js';
import { coin, dia, diaBtn } from './currency.js';
import { BIGWOOD_SET } from '../decor/decorData.js';
import { INTERIOR_DEFS } from '../tanks/tankData.js';
import { icon } from './icons.js';

const date = (t) => new Date(t).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const kindName = { catch: '採取倍', boost: '加速', nurse: '保育管理', event: 'イベントカード' };
/** 種類ごとの説明（カードには名前・所持数・値段だけを出す） */
const kindNote = {
  catch: '遠征の成果を見てから使い、受け取る数を増やす（合同調査を除く）',
  boost: '建築・遠征・繁殖（産卵・ふ化）・卵のふ化の残り時間を縮める',
  nurse: '保育中の世話を、その時間ぶん自動で済ませる',
  event: '館内イベントを1回開催できる',
};
/** カードの名前：見出しの種類名と重なる頭の部分を省く（「イベントカード：特別展」→「特別展」、「加速 1分」→「1分」） */
const shortName = (it) => it.name.replace(/^(イベントカード：|加速 |保育管理 )/, '');

/**
 * ショップ：ダイヤの財布・両替・毎日のダイヤ・工事・アイテム・館長パス・調査隊の永久解放・ダイヤのパック。
 * 有料の商品は purchases.js を通す（iPhone アプリは App内課金、開発中はテスト購入、公開版のブラウザは表示だけ）。
 */
export class StoreView {
  constructor({ wallet, items, daily, purchases, builder, toast, onChange }) {
    Object.assign(this, { wallet, items, daily, purchases, builder, toast, onChange });
  }

  html() {
    const w = this.wallet;
    const mode = this.purchases.mode;
    const dev = mode === 'dev';
    const canBuy = mode === 'store' || dev;
    const ex = (units) => `<button ${diaBtn(w, EXCHANGE.dia * units, 'st-exchange', units, { cls: '' })}>${dia(EXCHANGE.dia * units)} → ${coin(EXCHANGE.coin * units)}</button>`;
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
    const card = (it) => `<div class="st-item" title="${it.text}"><b>${shortName(it)}</b><small>所持 ${this.items.count(it.id)}</small><button ${diaBtn(w, it.price, 'st-item', it.id)}>${dia(it.price)}</button></div>`;
    const groups = Object.keys(kindName).map((k) => `<h4 class="gs-sub">${kindName[k]}</h4><p class="st-note">${kindNote[k]}</p><div class="st-items">${ITEMS.filter((it) => it.kind === k).map(card).join('')}</div>`).join('');
    const buy = (id, yen, ok = true) => `<button data-act="st-buy" data-id="${id}" class="primary" ${canBuy && ok && !this.busy ? '' : 'disabled'}>${this.purchases.priceLabel(id, yen)}${dev ? '（テスト）' : ''}</button>`;
    const pass = `<h4 class="gs-sub">館長パス（${PASS.days}日）</h4><div class="gs-row"><div class="gs-info"><b>館長パス</b>
      <small>放置収入の上限${PASS.offlineHours}時間 ・ 調査隊+${PASS.teams}（期間中） ・ 採取倍${PASS.catchCards}枚 ・ ${PASS.dia.toLocaleString('ja-JP')}ダイヤ</small>
      <small>${w.hasPass() ? `有効：${date(w.passUntil)}まで（買い足すと${PASS.days}日延長）` : '未購入'}</small></div>${buy(PASS.id, PASS.yen)}</div>`;
    const teams = `<div class="gs-row"><div class="gs-info"><b>調査隊の永久解放</b><small>同時に出せる調査隊が1隊ずつ増えます（${TEAM_UNLOCK.max}隊まで） ・ 解放済み ${w.teams}/${TEAM_UNLOCK.max}</small></div>${buy(TEAM_UNLOCK.id, TEAM_UNLOCK.yen, w.teams < TEAM_UNLOCK.max)}</div>`;
    const woodOwned = INTERIOR_DEFS.filter((d) => d.unlock === 'dia');
    const woodLeft = woodOwned.filter((d) => !this.purchases.decor?.ownsDef(d)).length;
    const wood = `<div class="gs-row"><div class="gs-info"><b>大型流木セット</b><small>大型流木5形（枝分かれ・根張り・アーチ・倒木・ねじれ）をまとめて解放。1形ずつならカタログから${BIGWOOD_SET.dia ?? 300}ダイヤ ・ 未解放 ${woodLeft}/${woodOwned.length}</small></div>${buy(BIGWOOD_SET.id, BIGWOOD_SET.yen, woodLeft > 0)}</div>`;
    // 一番小さいパックの単価を基準にした「お得」の割合
    const base = PACKS[0].dia / PACKS[0].yen;
    const packs = PACKS.map((p) => {
      const bonus = Math.round(((p.dia / p.yen) / base - 1) * 100);
      return `<div class="gs-row st-pack"><span class="st-pack-ico">${icon('gem', 26)}</span><div class="gs-info"><b>${p.dia.toLocaleString('ja-JP')}<small>ダイヤ</small></b>${bonus >= 1 ? `<em class="st-bonus">${bonus}%お得</em>` : ''}</div>${buy(p.id, p.yen)}</div>`;
    }).join('');
    const note = dev
      ? '<p class="gs-empty">開発中のテスト購入です（この端末にだけ記録され、お金はかかりません）。</p>'
      : mode === 'store'
        ? '<p class="gs-empty">購入した有償ダイヤ・パス・解放はアカウントに記録されます。</p>'
        : '<p class="gs-empty">購入はiPhoneアプリ版で行えます。買った分はこの画面にも反映されます。</p>';
    const restore = mode === 'store' ? '<button data-act="st-restore" class="tv-wide">購入を復元</button>' : '';
    // 並び：財布 → ダイヤ購入 → パス・解放 → 毎日のダイヤ → 工事 → ダイヤで買うアイテム
    const buyDia = `<h4 class="gs-sub" id="st-packs">ダイヤを買う</h4>${note}${packs}${restore}`;
    return `${wallet}${buyDia}${pass}${teams}${wood}${daily}${work}${groups}`;
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
    } else if (act === 'st-restore') {
      this.purchases.restore().then(() => {
        this.toast('購入を復元しました');
        this.onChange?.();
      }, (err) => this.toast(`復元できませんでした：${err?.message ?? err}`, { error: true, duration: 10000 }));
    } else if (act === 'st-buy') {
      if (this.busy) return true;
      this.busy = true;
      if (this.purchases.mode === 'store') this.toast('App Store に接続しています…');
      this.purchases.buy(id).finally(() => (this.busy = false)).then((ok) => {
        if (ok === false) return this.onChange?.(); // やめた
        this.toast('購入しました');
        this.onChange?.();
      }, (err) => {
        // 原因が読めるように長めに出し、ボタンを押せる状態に戻す
        this.toast(`購入できませんでした：${err?.message ?? err}`, { error: true, duration: 10000 });
        this.onChange?.();
      });
    } else return false;
    return true;
  }
}
