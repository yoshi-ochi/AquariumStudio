import { BOOSTS, NURSES, ITEMS } from '../management/walletData.js';
import { fmtLeft } from '../management/buildTimes.js';
import { choose } from './dialog.js';

const CATCH_ITEMS = ITEMS.filter((i) => i.kind === 'catch');

/**
 * 加速アイテムを選んで使う。持っていなければダイヤで買って使う。
 * 使ったら縮めた秒数を返す（やめたら 0）。left: 残り秒
 */
export async function pickBoost({ items, wallet, toast, left, title = '加速' }) {
  const buttons = BOOSTS.map((b) => {
    const n = items.count(b.id);
    return { key: b.id, label: n ? `${b.name}を使う（所持${n}）` : `${b.name}を${b.price}ダイヤで買って使う`, kind: n ? 'primary' : '' };
  });
  const id = await choose({ title, text: `残り ${fmtLeft(left)} ・ ダイヤ ${wallet.total.toLocaleString('ja-JP')}`, buttons });
  if (!id) return 0;
  const b = BOOSTS.find((x) => x.id === id);
  if (!items.use(id, { buy: true })) {
    toast('ダイヤが足りません', { error: true });
    return 0;
  }
  return b.sec;
}

/**
 * 遠征の成果を見せて、採取倍のアイテムを使うか選ぶ。倍数（1・2・4）を返す。やめたら 0。
 * caught: 成果の生き物 id の一覧、label: 一覧を文字にする関数
 */
export async function pickCatchMult({ items, toast, caught, label }) {
  const opt = (id, mult) => {
    const it = CATCH_ITEMS.find((x) => x.id === id);
    const n = items.count(id);
    return { key: id, label: n ? `${it.name}（×${mult}）を使う（所持${n}）` : `${it.name}（×${mult}）を${it.price}ダイヤで買って使う` };
  };
  const key = await choose({
    title: '調査隊の成果',
    text: `${label(caught) || '持ち帰れる生き物はいませんでした'}\n採取倍を使うと、受け取る数が増えます。`,
    buttons: [{ key: 'x1', label: 'そのまま受け取る', kind: 'primary' }, ...(caught.length ? [opt('catchX2', 2), opt('catchX4', 4)] : [])],
    cancel: 'あとで',
  });
  if (!key) return 0;
  if (key === 'x1') return 1;
  if (!items.use(key, { buy: true })) {
    toast('ダイヤが足りません', { error: true });
    return 0;
  }
  return CATCH_ITEMS.find((x) => x.id === key).mult;
}

/** 保育管理アイテムを選んで使う。持っていなければダイヤで買って使う。使った秒数を返す（やめたら 0） */
export async function pickNurse({ items, wallet, toast, text = '' }) {
  const buttons = NURSES.map((b) => {
    const n = items.count(b.id);
    return { key: b.id, label: n ? `${b.name}を使う（所持${n}）` : `${b.name}を${b.price}ダイヤで買って使う`, kind: n ? 'primary' : '' };
  });
  const id = await choose({ title: '保育管理', text: `${text}その間の世話を自動で済ませます。ダイヤ ${wallet.total.toLocaleString('ja-JP')}`, buttons });
  if (!id) return 0;
  if (!items.use(id, { buy: true })) {
    toast('ダイヤが足りません', { error: true });
    return 0;
  }
  return NURSES.find((x) => x.id === id).sec;
}
