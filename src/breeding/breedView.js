import { CREATURES, RARITY_NAME, getCreature } from '../expedition/creatureData.js';
import { creatureThumb } from '../ui/creatureThumb.js';
import { pickBoost, pickNurse } from '../ui/boostPicker.js';
import { fmtLeft } from '../management/buildTimes.js';
import { dia } from '../ui/currency.js';
import { stageNames, stageNote, stageSeconds, hasPair, sexLabel, isDeepSea, broodOf, SUCCESS_RATIO, DEEP_DEVICE_PRICE, morphChance } from './breedData.js';

const left = (t) => `<span data-until="${t}">${fmtLeft((t - Date.now()) / 1000)}</span>`;
const pct = (x) => `${Math.round(x * 1000) / 10}%`;

/** 種ごとの繁殖ロードマップ（図鑑の種の詳細・バックヤードの繁殖で見る） */
export function roadmapHtml(breeding, expeditions, id) {
  const c = getCreature(id);
  if (!c) return '';
  const r = breeding.record(id);
  const names = stageNames(id);
  const steps = [
    [hasPair(id, expeditions.count(id)), `オスとメスをそろえる（在庫 ${sexLabel(id, expeditions.count(id))}）`],
    [r.spawn > 0, `${names[0]}させる${r.spawn ? `（${r.spawn}回）` : ''}`],
    [r.hatch > 0, `${names[1]}させる${r.hatch ? `（${r.hatch}回）` : ''}`],
    [r.raised > 0, `保育を成功させる${r.raised ? `（${r.raised}回）` : ''}`],
    [r.raised >= 5, `保育を5回成功させる（繁殖の名人）`],
    [r.albino + r.morph > 0, `アルビノ・変色個体を誕生させる${r.albino + r.morph ? `（アルビノ${r.albino}・変色${r.morph}）` : ''}`],
  ];
  const need = [isDeepSea(id) ? '深海繁殖装置' : '', !breeding.backyard.canBreed(c) ? '繁殖技術 Lv2' : ''].filter(Boolean);
  const done = steps.filter(([ok]) => ok).length;
  return `<div class="br-road"><b>繁殖ロードマップ ${done}/${steps.length}</b>${need.length ? `<small>必要：${need.join('・')}</small>` : ''}${stageNote(id) ? `<small>${stageNote(id)}</small>` : ''}
    <ol>${steps.map(([ok, text]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '・'} ${text}</li>`).join('')}</ol></div>`;
}

/** バックヤードの「繁殖」：繁殖水槽ごとの状態・世話・加速・保育管理・深海繁殖装置 */
export class BreedView {
  constructor({ backyard, expeditions, previews, items, wallet, toast, onChange }) {
    Object.assign(this, { backyard, expeditions, previews, items, wallet, toast, onChange });
    this.road = null; // ロードマップを開いている種
  }

  get breeding() {
    return this.backyard.breeding;
  }

  html() {
    const slots = this.backyard.breeders.map((uid, i) => this._slot(uid, i));
    const chance = pct(morphChance(this.backyard.level('breeding')));
    return `<h4 class="gs-sub">繁殖</h4>${slots.length ? `<p class="gs-empty">オスとメスを入れると、${'産卵（妊娠）→ふ化（出産）→保育'}と進みます。段階ごとに期限つきの世話があり、逃すと子が死んでしまいます（全部死ぬこともあります）。保育成功は世話を${SUCCESS_RATIO * 100}%以上期限内に済ませたときだけ。アルビノ・変色個体の確率 ${chance}</p>` : ''}${slots.join('') || '<p class="gs-empty">レイアウトでバックヤードに繁殖水槽を設置すると、オスとメスのペアから赤ちゃんを増やせます。親は減りません。</p>'}`;
  }

  _slot(uid, i) {
    const br = this.breeding;
    const deep = br.isDeepTank(uid);
    const title = `繁殖水槽${i + 1}${deep ? '（深海繁殖装置）' : ''}`;
    const job = br.jobs[uid];
    if (job) return this._job(uid, title, job);
    const ex = this.expeditions;
    const have = CREATURES.filter((c) => ex.count(c.id) > 0);
    const ok = have.filter((c) => !br.blocker(uid, c.id));
    const noPair = have.filter((c) => !hasPair(c.id, ex.count(c.id))).length;
    const rows = ok.map((c) => `<button data-act="br-start" data-id="${uid}:${c.id}">${c.name}（${RARITY_NAME[c.rarity]}・${sexLabel(c.id, ex.count(c.id))}）</button>`);
    const upgrade = deep ? '' : `<button data-act="br-deep" data-id="${uid}" ${this.wallet.canAfford(DEEP_DEVICE_PRICE) ? '' : 'disabled'}>深海繁殖装置に改造 ${dia(DEEP_DEVICE_PRICE)}</button>`;
    return `<div class="gs-row wrap"><div class="gs-info"><b>${title}：空き</b><small>ペアのそろった生き物を選びます${noPair ? ` ・ オスとメスがそろわない種 ${noPair}` : ''}${deep ? '' : ' ・ 深海の種には深海繁殖装置が必要'}</small></div>
      <div class="gs-btns">${rows.join('') || '<small>繁殖できる生き物がいません</small>'}${upgrade}</div></div>`;
  }

  _job(uid, title, job) {
    const br = this.breeding;
    const c = getCreature(job.id);
    const names = stageNames(job.id);
    const now = Date.now();
    const steps = names.map((n, k) => `<span class="${k < job.stage ? 'done' : k === job.stage ? 'cur' : ''}">${n}</span>`).join('→');
    const count = job.stage === 0 ? `生まれる予定 ${broodOf(job.id)}匹` : `生き残り ${job.alive}/${broodOf(job.id)}匹`;
    const t = br.pendingTask(job, now);
    const next = job.tasks.find((x) => !x.done && x.at > now);
    const auto = job.autoUntil > now ? `<small class="br-auto">保育管理中 あと${left(job.autoUntil)}</small>` : '';
    const care = t
      ? `<div class="br-care"><b>🔔 世話：${br.careText(job)}</b><small>期限まで ${left(t.until)}</small><button data-act="br-care" data-id="${uid}" class="primary">世話をする</button></div>`
      : `<small>${next ? `次の世話まで ${left(next.at)}` : '世話は済んでいます'}</small>`;
    const ratio = job.total ? `<small>期限内の世話 ${job.onTime}/${job.total}回（保育成功には${SUCCESS_RATIO * 100}%以上）</small>` : '';
    const btns = [
      job.stage < 2 ? `<button data-act="br-boost" data-id="${uid}">⚡加速</button>` : `<button data-act="br-nurse" data-id="${uid}">保育管理</button>`,
      `<button data-act="br-road" data-id="${job.id}">${this.road === job.id ? 'ロードマップを閉じる' : 'ロードマップ'}</button>`,
    ].join('');
    const road = this.road === job.id ? roadmapHtml(br, this.expeditions, job.id) : '';
    return `<div class="gs-row wrap br-job">${creatureThumb(this.previews, job.id)}<div class="gs-info"><b>${title}：${c.name}</b>
      <small class="br-steps">${steps} ・ ${names[job.stage]}の残り ${left(job.end)}</small><small>${count}</small>${ratio}${auto}${care}</div>
      <div class="gs-btns">${btns}</div>${road}</div>`;
  }

  act(act, id) {
    const br = this.breeding;
    if (act === 'br-start') {
      const [uid, cid] = id.split(':');
      if (br.start(+uid, cid)) this.toast(`${getCreature(cid).name}のペアを繁殖水槽に入れました`);
    } else if (act === 'br-care') {
      if (br.care(+id)) this.toast('世話をしました');
    } else if (act === 'br-deep') {
      if (br.upgradeDeep(+id)) this.toast('深海繁殖装置に改造しました');
      else this.toast('ダイヤが足りません', { error: true });
    } else if (act === 'br-road') this.road = this.road === id ? null : id;
    else if (act === 'br-boost') {
      const job = br.jobs[id];
      if (job) pickBoost({ items: this.items, wallet: this.wallet, toast: this.toast, left: (job.end - Date.now()) / 1000, title: `${stageNames(job.id)[job.stage]}の加速` }).then((sec) => {
        if (sec) br.boost(+id, sec);
        this.onChange?.();
      });
    } else if (act === 'br-nurse') {
      const job = br.jobs[id];
      if (job) pickNurse({ items: this.items, wallet: this.wallet, toast: this.toast, text: `保育の残り ${fmtLeft((job.end - Date.now()) / 1000)}。` }).then((sec) => {
        if (sec) br.autoCare(+id, sec);
        this.onChange?.();
      });
    } else return false;
    return true;
  }
}

/** 段階の時間の目安（種の詳細用） */
export const stageHoursText = (id, level) => {
  const c = getCreature(id);
  return stageNames(id).map((n, k) => `${n} ${fmtLeft(stageSeconds(k, c.rarity, level))}`).join(' → ');
};
