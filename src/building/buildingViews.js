import { creatureThumb } from '../ui/creatureThumb.js';
import { PLAN_FLOORS, WING_FLOORS, ZONES, ZONE_TYPE, MAX_ZONE_NAME, defaultZoneName, floorLabel, getZone } from './blueprint.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { EXPAND_COST, EXPAND_SLOTS } from './backyardData.js';
import { CREATURES, starLabel, getCreature } from '../expedition/creatureData.js';
import { RESEARCH, BREED_HOURS, researchCost, breedHours } from './backyardData.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;

/** 館内エリアの解放と、解放済みエリアの名前・床と壁の色 */
export class ZoneView {
  constructor({ economy, getUnlocked, onUnlock, getLook, onLook, onRename }) {
    Object.assign(this, { economy, getUnlocked, onUnlock, getLook, onLook, onRename });
    this.editing = null;
  }

  _editor(z) {
    const look = this.getLook(z.id);
    const indoor = z.type !== ZONE_TYPE.OUTDOOR;
    const color = (kind, label) => `<label class="zn-color">${label}<input type="color" data-field="zone-${kind}" data-id="${z.id}" value="${look[kind]}"></label>`;
    return `<div class="gs-row wrap zn-edit"><div class="gs-info"><b>エリアの編集</b><small>元の名前：${esc(defaultZoneName(z.id))}</small></div>
      <div class="tv-name"><input id="zn-name" value="${esc(z.name)}" maxlength="${MAX_ZONE_NAME}" aria-label="エリア名"><button data-act="zone-rename" data-id="${z.id}" class="primary">名前を変更</button></div>
      <div class="zn-colors">${indoor ? `${color('floor', '床の色')}${color('wall', '壁の色')}` : '<small>屋外エリアは色を変えられません</small>'}</div>
      <div class="gs-btns">${indoor ? `<button data-act="zone-color-reset" data-id="${z.id}">色を全体設定に戻す</button>` : ''}<button data-act="zone-edit-done">閉じる</button></div></div>`;
  }

  html() {
    const unlocked = this.getUnlocked();
    const level = this.economy.stage.level;
    // 別棟は建設済みの階と、次に増築できる階だけを並べる
    const wings = WING_FLOORS.filter((f) => ZONES.some((z) => z.floor === f && (unlocked.has(z.id) || !z.requires || unlocked.has(z.requires))));
    const rows = [...PLAN_FLOORS, ...wings].map((floor) => {
      const items = ZONES.filter((z) => z.floor === floor).map((z) => {
        if (unlocked.has(z.id)) {
          const row = `<div class="gs-row"><div class="gs-info"><b>${esc(z.name)}</b><small>${z.text}</small></div><button data-act="zone-edit" data-id="${z.id}">編集</button></div>`;
          return this.editing === z.id ? row + this._editor(z) : row;
        }
        const lack = z.stage > level ? (z.wing ? `最大レベル（Lv${z.stage}）で建設できます` : `ステージ${z.stage}で解放`) : z.requires && !unlocked.has(z.requires) ? `先に${esc(getZone(z.requires).name)}を解放` : '';
        const ok = !lack && this.economy.canAfford(z.cost);
        return `<div class="gs-row"><div class="gs-info"><b>${esc(z.name)}</b><small>${z.text}</small>${lack ? `<small>${lack}</small>` : ''}</div><button data-act="zone-open" data-id="${z.id}" class="primary" ${ok ? '' : 'disabled'}>${z.wing ? (z.requires ? '増築 ' : '建設 ') : ''}${yen(z.cost)}</button></div>`;
      });
      return `<h4 class="gs-sub">${floorLabel(floor)}</h4>${items.join('')}`;
    });
    return rows.join('');
  }

  /** 色の選択はその場で建物に反映する */
  input(el) {
    const f = el.dataset.field;
    if (f === 'zone-floor' || f === 'zone-wall') this.onLook(el.dataset.id, f.slice(5), el.value);
  }

  act(act, id, b) {
    if (act === 'zone-edit') this.editing = this.editing === id ? null : id;
    else if (act === 'zone-edit-done') this.editing = null;
    else if (act === 'zone-rename') this.onRename(id, b?.closest('.gs-list')?.querySelector('#zn-name')?.value ?? '');
    else if (act === 'zone-color-reset') this.onLook(id, null);
    if (act.startsWith('zone-') && act !== 'zone-open') return true;
    if (act !== 'zone-open') return false;
    const z = getZone(id);
    if (this.economy.spend(z.cost)) this.onUnlock(id);
    return true;
  }
}

/** バックヤード：研究と繁殖 */
export class BackyardView {
  constructor({ backyard, expeditions, economy, previews, toast }) {
    Object.assign(this, { backyard, expeditions, economy, previews, toast });
  }

  html() {
    const b = this.backyard;
    const research = RESEARCH.map((r) => {
      const lv = b.level(r.id);
      const cost = researchCost(lv);
      const max = cost == null;
      return `<div class="gs-row"><div class="gs-info"><b>${r.name} Lv${lv}</b><small>${r.text}</small></div>${max ? '<span class="zn-open">最大</span>' : `<button data-act="lab-up" data-id="${r.id}" class="primary" ${b.points >= cost ? '' : 'disabled'}>${cost}pt</button>`}</div>`;
    });
    const slots = b.breeders.map((uid, i) => this._slot(uid, i));
    const hold = this.expeditions;
    const holding = `<div class="st-sum"><div class="st-head"><b>魚の保持 ${hold.usedSlots}/${b.capacity}枠</b><small>拡張 ${b.expansions}回</small></div>
        <div class="st-bar"><i style="width:${Math.min(100, (hold.usedSlots / b.capacity) * 100)}%"></i></div>
        <small>建物のレベル、地下の予備水槽、拡張工事で増えます。満杯だと捕れた魚を放流します。</small>
        <button data-act="hold-expand" class="primary" ${this.economy.canAfford(EXPAND_COST) ? '' : 'disabled'}>拡張工事 +${EXPAND_SLOTS}枠 ${yen(EXPAND_COST)}</button></div>`;
    return `${holding}<div class="st-sum"><div class="st-head"><b>研究ポイント ${Math.floor(b.points)}pt</b><small>${b.ratePerMin.toFixed(1)}pt/分</small></div>
        <small>研究室 ${b.labCount}室 ・ 研究員 ${b.researchers}人</small>
        ${b.labCount ? '' : '<em class="gs-alert">レイアウトでバックヤードに研究室を設置してください</em>'}
        ${b.labCount > b.researchers ? '<em class="gs-alert">スタッフから研究員を配置してください</em>' : ''}</div>
      <h4 class="gs-sub">研究</h4>${research.join('')}
      <h4 class="gs-sub">繁殖</h4>${slots.join('') || '<p class="gs-empty">レイアウトでバックヤードに繁殖水槽を設置すると、在庫の親2匹から赤ちゃんを増やせます。親は減りません。</p>'}`;
  }

  _slot(uid, i) {
    const b = this.backyard;
    const job = b.jobs[uid];
    if (job) {
      const c = getCreature(job.id);
      return `<div class="gs-row">${creatureThumb(this.previews, job.id)}<div class="gs-info"><b>繁殖水槽${i + 1}：${c.name}</b><small>誕生まで <span data-until="${job.until}"></span></small></div></div>`;
    }
    const opts = CREATURES.filter((c) => this.expeditions.count(c.id) >= 2 && b.canBreed(c));
    const rows = opts.map((c) => `<button data-act="breed" data-id="${uid}:${c.id}">${c.name}（${starLabel(c.stars)}・${breedHours(c.stars, b.level('breeding'))}時間）</button>`);
    return `<div class="gs-row wrap"><div class="gs-info"><b>繁殖水槽${i + 1}：空き</b><small>同じ種類を2匹以上持っている生き物を選びます（基本${BREED_HOURS[1]}〜${BREED_HOURS[3]}時間）</small></div><div class="gs-btns">${rows.join('') || '<small>繁殖できる生き物がいません</small>'}</div></div>`;
  }

  act(act, id) {
    const b = this.backyard;
    if (act === 'hold-expand') {
      if (this.economy.spend(EXPAND_COST)) b.expand();
    } else if (act === 'lab-up') b.upgrade(id);
    else if (act === 'breed') {
      const [uid, cid] = id.split(':');
      if (b.startBreeding(+uid, cid)) this.toast(`${getCreature(cid).name} の繁殖を始めました`);
    } else return false;
    return true;
  }
}
