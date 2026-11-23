import { getCreature } from '../expedition/creatureData.js';
import { progressOf, fishToNext, xpPerFish, sizeOf, MAX_LEVEL } from '../expedition/growth.js';
import { syncLife } from '../expedition/tankLife.js';
import { qtyPanel, creatureInfo } from './creatureGrid.js';

const num = (n) => Math.round(n).toLocaleString('ja-JP');

/** 展示している匹数（全水槽） */
export const shownCount = (manager, id) => manager.tanks.reduce((s, t) => s + (t.userData.creatures?.[id] ?? 0), 0);

/** レベルと次のレベルまでのバー */
export function growBar(expeditions, id) {
  const p = progressOf(expeditions.xp[id] ?? 0, id);
  const size = Math.round(sizeOf(p.lv) * 100);
  const rest = p.need ? `次まで ${num(p.need - p.have)}（あと${num(fishToNext(id, expeditions.xp[id] ?? 0))}匹） ・ 1匹 +${num(xpPerFish(id))}` : '最大レベル';
  return `<div class="cg-grow"><b>Lv ${p.lv}</b><div class="mo-bar"><span style="width:${p.need ? (p.have / p.need) * 100 : 100}%"></span></div><small>体の大きさ ${size}% ・ ${rest}</small></div>`;
}

/**
 * 図鑑の育成カードの中身：レベル・在庫と展示数・数の選択・「成長させる」。
 * 素材は在庫の同じ魚種だけ（展示中の魚は使わない）。展示していない魚種は在庫に1匹残す。
 * 使える数が無ければ選択の代わりに案内を出す。
 */
export function growPanel({ expeditions, manager, id, qty, note = '' }) {
  const c = getCreature(id);
  const have = expeditions.count(id);
  const shown = shownCount(manager, id);
  const usable = expeditions.usable(id, shown);
  const info = creatureInfo(id, `在庫 ${have} ・ 展示中 ${shown} ・ 成長に使える ${usable}`);
  const extra = `${note}${growBar(expeditions, id)}`;
  const maxed = expeditions.level(id) >= MAX_LEVEL;
  if (!usable || maxed) {
    const msg = maxed
      ? '最大レベルに達しました。'
      : have
        ? '展示していない魚種は、手元に1匹残すため在庫が2匹以上で使えます（展示中があれば在庫をすべて使えます）。'
        : '在庫がありません。採取すると成長に使えます（展示中の魚は使いません）。';
    return `<div class="cg-head"><b>${c.name}</b><small>${info}</small></div>${extra}<p class="gs-empty">${msg}</p>`;
  }
  return qtyPanel({
    title: c.name, info, extra, max: usable, qty,
    buttons: [{ act: 'zk-grow', id: `${id}:{n}`, label: '{n}匹で成長させる', primary: true }],
  });
}

/** 在庫の n 匹を成長に使い、展示中の同じ魚種を大きくする。結果を通知する */
export function growSpecies({ expeditions, manager, toast }, key) {
  const [id, n] = key.split(':');
  const shown = shownCount(manager, id);
  const r = expeditions.grow(id, Math.min(Number(n) || 1, expeditions.usable(id, shown)), shown);
  if (!r) return false;
  for (const t of manager.tanks) if (t.userData.creatures?.[id]) syncLife(t);
  const name = getCreature(id).name;
  const left = fishToNext(id, expeditions.xp[id] ?? 0);
  toast(r.to > r.from ? `${name} が Lv${r.to} に成長しました！` : `${name} に経験値 +${num(r.gained)}（あと${num(left)}匹で Lv${r.to + 1}）`);
  return true;
}
