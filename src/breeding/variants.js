/**
 * 水槽に展示しているアルビノ・変色個体の数。tank.userData.variants = { 種id: { albino, morph } }（展示数の内数）
 * 在庫側は expeditions.variants。出し入れは「ふつうの個体から先に」動かす。
 */
const KINDS = ['albino', 'morph'];

export const tankVariants = (t, id) => ({ albino: 0, morph: 0, ...t.userData.variants?.[id] });
const total = (v) => v.albino + v.morph;

function save(t, id, v) {
  if (total(v) > 0) (t.userData.variants ??= {})[id] = v;
  else if (t.userData.variants) {
    delete t.userData.variants[id];
    if (!Object.keys(t.userData.variants).length) delete t.userData.variants;
  }
}

/** 水槽にアルビノなどを加える（展示数はすでに増えていること） */
export function addTankVariants(t, id, moved) {
  if (!moved) return;
  const v = tankVariants(t, id);
  for (const k of KINDS) v[k] += moved[k] ?? 0;
  save(t, id, v);
}

/** 水槽から n 匹戻すとき、一緒に戻るアルビノなど（ふつうの個体から先に戻す）。水槽側の記録も減らす */
export function takeTankVariants(t, id, n) {
  const have = t.userData.creatures?.[id] ?? 0;
  const v = tankVariants(t, id);
  let extra = Math.max(0, n - (have - total(v)));
  const moved = { albino: 0, morph: 0 };
  for (const k of ['morph', 'albino']) {
    const d = Math.min(extra, v[k]);
    v[k] -= d;
    moved[k] = d;
    extra -= d;
  }
  save(t, id, v);
  return moved;
}

/** 水槽から1匹だけ、指定のアルビノなどを戻す。戻せたら true（展示数も1減らす） */
export function takeOneVariant(t, id, kind) {
  const v = tankVariants(t, id);
  if (!(v[kind] > 0) || !(t.userData.creatures?.[id] > 0)) return false;
  v[kind]--;
  save(t, id, v);
  t.userData.creatures[id]--;
  if (!t.userData.creatures[id]) delete t.userData.creatures[id];
  return true;
}

/** 水槽を撤去するとき：中の生き物をアルビノなどごと在庫へ戻す */
export function returnTankToStock(t, expeditions) {
  for (const [id, n] of Object.entries(t.userData.creatures ?? {})) {
    expeditions.give(id, n);
    const v = tankVariants(t, id);
    for (const k of KINDS) if (v[k]) expeditions.addVariant(id, k, v[k]);
  }
}

/** 描画用：その種の個体ごとの見た目（先頭からアルビノ・変色、残りはふつう） */
export function variantList(t, id) {
  const v = tankVariants(t, id);
  return [...Array(v.albino).fill('albino'), ...Array(v.morph).fill('morph')];
}
