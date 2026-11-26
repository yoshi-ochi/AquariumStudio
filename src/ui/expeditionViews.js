import { creatureThumb } from './creatureThumb.js';
import { creatureGrid, qtyPanel, updateQty, creatureInfo } from './creatureGrid.js';
import { tankLabel } from '../tanks/tankLabel.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { CREATURES, SEASONS, getCreature, getDestination, travelPlan, inSeason } from '../expedition/creatureData.js';
import { tankCapacity, usedCapacity, syncLife } from '../expedition/tankLife.js';
import { getMethod, methodsAt, waterOf } from '../expedition/fishingData.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
export const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ''}` : `${s}秒`);
const until = (t) => `<span data-until="${t}">${fmtTime(Math.max(0, Math.ceil((t - Date.now()) / 1000)))}</span>`;

/** 採取遠征：調査隊の状況と行き先 */
export class ExpeditionView {
  constructor({ economy, expeditions, toast, getHome, previews, getDiscount, getCapacity, fishing }) {
    Object.assign(this, { economy, expeditions, toast, getHome, previews, getDiscount, getCapacity, fishing });
    this.focus = null; // 地図で選んだ採取地
    this.methodId = null; // 選んだ漁法
  }

  html() {
    const ex = this.expeditions;
    const level = this.economy.stage.level;
    const trips = ex.trips.map((t, i) => {
      const d = getDestination(t.dest);
      return ex.isDone(t)
        ? `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>調査隊が帰還しました</small></div><button data-act="claim" data-id="${i}" class="primary">受け取る</button></div>`
        : `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>採取中 ・ 残り ${until(t.doneAt)}</small></div></div>`;
    });
    const teamCost = ex.nextTeamCost;
    const addTeam = teamCost == null
      ? '<small>調査隊は上限まで追加済みです</small>'
      : `<button data-act="team-add" ${this.economy.canAfford(teamCost) ? '' : 'disabled'}>調査隊を追加 ${yen(teamCost)}</button>`;
    const status = `<div class="st-sum"><div class="st-head"><b>調査隊 ${ex.trips.length}/${ex.teamLimit(level)}隊</b><small>追加 ${ex.extraTeams}隊</small></div>${addTeam}</div>${trips.join('')}`;
    const d = this.focus && getDestination(this.focus);
    if (!d) return `${status}<p class="gs-empty">地図の採取地をタップして行き先を選びます。</p>`;
    const methods = methodsAt(d);
    if (!methods.some((m) => m.method.id === this.methodId)) this.methodId = methods[0].method.id;
    const sel = methods.find((m) => m.method.id === this.methodId);
    const plan = this._plan(d, sel.method);
    const tabs = methods.map(({ method: m }) => `<button data-act="method" data-id="${m.id}" class="${m.id === this.methodId ? 'active' : ''}">${m.name}</button>`).join('');
    const species = sel.catches.map((id) => {
      const c = getCreature(id);
      const off = !inSeason(c);
      return `<div class="ex-sp${off ? ' off' : ''}">${creatureThumb(this.previews, id)}<small>${c.name}</small><small>${off ? `季節外（${c.seasons.map((i) => SEASONS[i]).join('・')}）` : ''}</small></div>`;
    }).join('');
    const locked = d.stage > level;
    const full = ex.usedSlots >= this.getCapacity();
    const ok = !locked && !full && ex.canDepart(level) && this.economy.canAfford(plan.cost);
    return `<div class="st-sum"><div class="st-head"><b>${d.name}</b><small>立地から ${plan.km.toLocaleString('ja-JP')}km</small></div><small>${d.text}</small>
      <h4 class="gs-sub">漁法を選ぶ</h4><div class="ex-methods">${tabs}</div>
      <small>${sel.method.how}</small>
      <button data-act="method-preview" data-id="${d.id}">▶ ${sel.method.name}の様子を見る</button>
      <div class="ex-species">${species}</div>
      <small>魚の保持 ${ex.usedSlots}/${this.getCapacity()}枠</small>
      ${full ? '<em class="gs-alert">保持枠がいっぱいです。バックヤードで拡張してください</em>' : ''}
      ${locked ? `<em class="gs-alert">ステージ${d.stage}で解放</em>` : `<button data-act="depart" data-id="${d.id}" class="primary" ${ok ? '' : 'disabled'}>${sel.method.name}で出港 ${yen(plan.cost)} ・ ${fmtTime(plan.seconds)}</button>`}</div>${status}`;
  }

  /** 研究「採取技術」の割引を反映した費用。時間は距離だけで決まる（漁法によらない） */
  _plan(d, method) {
    const plan = travelPlan(d, this.getHome());
    return { ...plan, cost: Math.round(plan.cost * method.cost * (1 - this.getDiscount())) };
  }

  act(act, id) {
    const ex = this.expeditions;
    if (act === 'team-add') {
      const cost = ex.nextTeamCost;
      if (cost != null && this.economy.spend(cost)) {
        ex.addTeam();
        this.toast('調査隊を追加しました');
      }
      return true;
    }
    if (act === 'method') {
      this.methodId = id;
      return true;
    }
    if (act === 'method-preview') {
      this.fishing.play(this.methodId, '', waterOf(getDestination(id)));
      return true;
    }
    if (act === 'depart') {
      const d = getDestination(id);
      const method = getMethod(this.methodId, waterOf(d));
      const plan = this._plan(d, method);
      if (!ex.canDepart(this.economy.stage.level) || !this.economy.spend(plan.cost)) return true;
      // 漁の作業を再現してから、待ち時間に入る
      // はじめての遠征（まだ1種も見つけていない・隊も出ていない）は20秒で帰る（チュートリアルで長く待たせない）
      const first = !Object.keys(ex.seen).length && !ex.trips.length;
      this.fishing.play(method.id, '', waterOf(d)).then(() => {
        ex.depart(d, first ? Math.min(20, plan.seconds) : plan.seconds, method.id);
      });
      return true;
    }
    if (act === 'claim') {
      const trip = ex.trips[+id];
      const caught = ex.claim(+id);
      const label = (list) => [...new Set(list)].map((c) => `${getCreature(c).name}×${list.filter((x) => x === c).length}`).join('、');
      const released = ex.released.length ? `／満杯のため放流：${label(ex.released)}` : '';
      const text = `${label(caught) || '持ち帰れる生き物はいませんでした'}${released}`;
      if (trip?.method) this.fishing.play(trip.method, text, waterOf(getDestination(trip.dest)));
      return true;
    }
    return false;
  }
}

/** アイテムの「生物」タブ：所持している生物と水槽への展示 */
/** 食堂（カフェ）で料理として出したときの売上（1匹）。レア度で値段が上がる */
const DISH_RARITY = { 1: 1, 2: 1.6, 3: 3, 4: 4 };
export const dishPrice = (c) => Math.round(((150 + Math.min(c.len, 3.5) * 2500) * DISH_RARITY[c.rarity]) / 10) * 10;

export class CreatureView {
  constructor({ manager, expeditions, previews, toast, onChanged, economy, hasCafe }) {
    Object.assign(this, { manager, expeditions, previews, toast, onChanged, economy, hasCafe });
    this.picking = null;
    this.sel = null; // 4列の一覧で選んでいる生き物
    this.qty = 1; // 選んでいる数
  }

  get _tanks() {
    return [...this.manager.objects.values()].filter((o) => o.userData.clip);
  }

  _img(id) {
    return creatureThumb(this.previews, id);
  }

  html() {
    return this.picking ? this._picker() : this._list();
  }

  _list() {
    const ex = this.expeditions;
    const cafe = this.hasCafe();
    const items = CREATURES.filter((c) => ex.count(c.id) > 0).map((c) => ({ id: c.id, n: ex.count(c.id), pieces: ex.pieces(c.id) }));
    if (this.sel && !ex.count(this.sel)) this.sel = null;
    let panel = '';
    if (this.sel) {
      const c = getCreature(this.sel);
      const n = ex.count(c.id);
      panel = qtyPanel({
        title: c.name, info: creatureInfo(c.id, `所持 ${n}`), max: n, qty: this.qty,
        buttons: [
          { act: 'pick', id: `${c.id}:{n}`, label: '{n}匹 水槽に展示', primary: true },
          { act: 'release', id: `${c.id}:{n}`, label: '{n}匹 放流' },
          { act: 'dish', id: `${c.id}:{n}`, label: '{n}匹 食堂で提供 {yen}', unit: dishPrice(c), disabled: !cafe },
        ],
      });
    }
    const owned = items.length ? [creatureGrid(this.previews, items, { sel: this.sel, panel })] : [];
    const note = `<p class="gs-empty">バックヤードの保持 ${ex.usedSlots}/${ex.getCapacity()}枠（展示中の生物は含みません）。${cafe ? '' : 'カフェを設置すると、食堂で料理として提供できます。'}</p>`;
    const shown = this._tanks.flatMap((t) =>
      Object.entries(t.userData.creatures ?? {}).map(
        ([id, n]) => `<div class="gs-row">${this._img(id)}<div class="gs-info"><b>${getCreature(id)?.name ?? id} ×${n}</b><small>${esc(tankLabel(this.manager, t))}</small></div><button data-act="unshow" data-id="${t.userData.uid}:${id}">戻す</button></div>`,
      ),
    );
    return `${note}${owned.join('') || '<p class="gs-empty">生物を持っていません。採取遠征で捕まえましょう。</p>'}${shown.length ? `<h4 class="gs-sub">展示中</h4>${shown.join('')}` : ''}`;
  }

  _picker() {
    const c = getCreature(this.picking);
    const q = Math.min(this.pickQty ?? 1, this.expeditions.count(c.id));
    const rows = this._tanks.map((t) => {
      const def = this.manager.defOf(t);
      const used = usedCapacity(t);
      const cap = tankCapacity(def);
      return `<div class="gs-row"><div class="gs-info"><b>${esc(tankLabel(this.manager, t))}</b><small>収容枠 ${used}/${cap}${used + c.slots * q > cap ? ' ・ <em class="gs-alert">超過すると幸福度が下がります</em>' : ''}</small></div><button data-act="show" data-id="${t.userData.uid}" class="primary">ここに展示</button></div>`;
    });
    return `<button data-act="pick-back">← 戻る</button><p class="gs-empty">${c.name}を${q}匹（${c.slots * q}枠）展示する水槽を選んでください。</p>${rows.join('') || '<p class="gs-empty">水槽がありません。</p>'}`;
  }

  /** 数のスライダー（再描画しない） */
  input(el) {
    if (el.dataset.field === 'cg-qty') this.qty = updateQty(el);
  }

  act(act, id) {
    if (act === 'cg-pick') {
      this.sel = this.sel === id ? null : id;
      this.qty = 1;
    } else if (act === 'cg-qty') this.qty = +id;
    else if (act === 'pick') {
      const [cid, n] = id.split(':');
      this.picking = cid;
      this.pickQty = Math.max(1, Number(n) || 1);
    }
    else if (act === 'pick-back') this.picking = null;
    else if (act === 'show') this._show(+id);
    else if (act === 'unshow') this._unshow(id);
    else if (act === 'release' || act === 'dish') this._letGo(act, id);
    else return false;
    return true;
  }

  /** 放流する / 食堂で料理として出す */
  _letGo(act, key) {
    const [id, want] = key.split(':');
    const c = getCreature(id);
    const n = Math.min(Number(want) || 1, this.expeditions.count(id));
    if (!c || n <= 0) return;
    if (act === 'dish' && !this.hasCafe()) return this.toast('カフェを設置すると食堂で提供できます', { error: true });
    this.expeditions.take(id, n);
    if (act === 'dish') {
      this.economy.earn(dishPrice(c) * n);
      this.toast(`${c.name}を${n}匹、食堂で提供しました（+${yen(dishPrice(c) * n)}）`);
    } else this.toast(`${c.name}を${n}匹、海へ放流しました`);
    this.onChanged();
  }

  _show(uid) {
    const tank = this.manager.objects.get(uid);
    const id = this.picking;
    const c = getCreature(id);
    if (!tank) return;
    const n = Math.min(this.pickQty ?? 1, this.expeditions.count(id));
    if (n <= 0 || !this.expeditions.take(id, n)) return;
    this.picking = null; // 展示したら一覧へ戻る
    const list = (tank.userData.creatures ??= {});
    list[id] = (list[id] ?? 0) + n;
    syncLife(tank);
    this.toast(`${c.name} を${n}匹 ${tankLabel(this.manager, tank)} に展示しました`);
    this.onChanged();
  }

  _unshow(key) {
    const [uid, id] = key.split(':');
    const tank = this.manager.objects.get(+uid);
    if (!tank?.userData.creatures?.[id]) return;
    if (this.expeditions.usedSlots + getCreature(id).slots > this.expeditions.getCapacity()) return this.toast('保持枠がいっぱいです', { error: true });
    tank.userData.creatures[id]--;
    if (!tank.userData.creatures[id]) delete tank.userData.creatures[id];
    syncLife(tank);
    this.expeditions.give(id);
    this.onChanged();
  }
}
