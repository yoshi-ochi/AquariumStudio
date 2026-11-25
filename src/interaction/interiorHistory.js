/**
 * 水槽内編集の巻き戻し（元に戻す）。操作の直前に、その水槽の水槽内オブジェ全部の状態を記録しておき、戻すときに丸ごと置き直す。
 * 記録は水槽内編集を開いている間だけ・最大 LIMIT 手。水槽内編集を閉じると消える。
 * 配置・撤去のお金も戻す（配置を戻すと代金を返し、撤去を戻すと払い戻しを取り消す）。
 * スライダーのように続けて変わる操作は、同じ key が短い間に続く限り1手にまとめる。
 */
export const LIMIT = 10;
const MERGE_MS = 1200;

export class InteriorHistory {
  constructor({ manager, economy, onChange }) {
    Object.assign(this, { manager, economy, onChange });
    this.tank = null;
    this.stack = [];
    this.last = null;
  }

  get size() {
    return this.stack.length;
  }

  /** 水槽内編集を開いた・閉じた（tank = null） */
  reset(tank = null) {
    this.tank = tank;
    this.stack = [];
    this.last = null;
    this.onChange?.(this);
  }

  /** 操作の直前に呼ぶ。label は戻したときの知らせに使う名前 */
  record(label, key = null) {
    if (!this.tank) return;
    const now = performance.now();
    if (key && this.last?.key === key && now - this.last.at < MERGE_MS) {
      this.last.at = now;
      return;
    }
    this.stack.push({ label, items: this.manager.dumpInterior(this.tank), money: 0 });
    if (this.stack.length > LIMIT) this.stack.shift();
    this.last = { key, at: now };
    this.onChange?.(this);
  }

  /** 直前に記録した操作でのお金の出入り（使った額は正、受け取った額は負） */
  charge(amount) {
    const top = this.stack.at(-1);
    if (top) top.money += amount;
  }

  /** 1手戻す。戻した操作の名前を返す（戻せなければ null） */
  undo() {
    const step = this.stack.pop();
    if (!step || !this.tank) return null;
    this.manager.restoreInterior(this.tank, step.items);
    if (step.money > 0) this.economy.earn(step.money);
    else if (step.money < 0) this.economy.pay(-step.money);
    this.last = null;
    this.onChange?.(this);
    return step.label;
  }
}
