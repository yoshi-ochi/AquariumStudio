/**
 * 操作の案内（チュートリアル・目標の進め方）。押す場所だけを明るく残して周りを暗くし、指のマークで示す。
 * 実際にそこをタップすると次へ進む。
 *
 * steps: [{
 *   title?, text,
 *   target?: CSS セレクタ | () => DOMRect | Element | null（3D の水槽や地図のピンなど）
 *   tap?: true … 目標をタップしたら次へ（既定 true。target があるとき）
 *   done?: (ctx) => boolean … 条件を満たしたら次へ（操作の結果で進む手順）
 *   wait?: 目標が見つからない間に出す説明
 *   next?: '次へ' … ボタンで進める手順（target なし・説明だけ）
 * }]
 * 暗い所をタップしても操作は通らない（間違いを防ぐ）。カードの「やめる」でいつでも終われる。
 */
const PAD = 6;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class Guide {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'guide';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="gd-dim" data-d="t"></div><div class="gd-dim" data-d="b"></div><div class="gd-dim" data-d="l"></div><div class="gd-dim" data-d="r"></div>
      <div class="gd-ring" hidden></div><div class="gd-finger" hidden aria-hidden="true">👆</div><div class="gd-card" role="dialog" aria-live="polite"></div>`;
    document.body.append(this.el);
    this.dims = [...this.el.querySelectorAll('.gd-dim')];
    this.ring = this.el.querySelector('.gd-ring');
    this.finger = this.el.querySelector('.gd-finger');
    this.card = this.el.querySelector('.gd-card');
    this.card.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-gd]');
      if (!b) return;
      if (b.dataset.gd === 'next') this._advance();
      else if (b.dataset.gd === 'stop') this.stop(false);
    });
    // 暗い所のタップは止める（カードを揺らして知らせる）
    for (const d of this.dims) {
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.card.classList.remove('gd-shake');
        void this.card.offsetWidth;
        this.card.classList.add('gd-shake');
      });
    }
    // 目標をタップしたら次へ（タップそのものは目標に届く）
    this._onTap = (e) => {
      const st = this.steps?.[this.i];
      // 結果で進む手順（done あり）はタップでは進めない（押しても効かなかったときに先へ行かないように）
      if (!st || !this.rect || st.tap === false || st.done || !st.target) return;
      const { clientX: x, clientY: y } = e;
      const r = this.rect;
      // タップした手順のまま（done で先に進んでいなければ）次へ。done と重なって2つ進まないよう、タップした時の手順を覚えておく
      const at = this.i;
      const steps = this.steps;
      if (x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD) setTimeout(() => this.steps === steps && this.i === at && this._advance(), 250);
    };
    addEventListener('pointerup', this._onTap, true);
    this.steps = null;
  }

  get active() {
    return !!this.steps;
  }

  /** 案内を始める。onEnd(completed) は最後まで進んだら true、やめたら false */
  start(steps, { label = '', onEnd = null, onStep = null, from = 0 } = {}) {
    this.steps = steps;
    this.label = label;
    this.onEnd = onEnd;
    this.onStep = onStep;
    this.i = Math.min(from, steps.length - 1);
    this._key = null;
    this.el.hidden = false;
  }

  stop(completed) {
    if (!this.steps) return;
    const end = this.onEnd;
    this.steps = null;
    this.el.hidden = true;
    end?.(completed);
  }

  _advance() {
    if (!this.steps) return;
    this.i++;
    this._key = null;
    if (this.i >= this.steps.length) return this.stop(true);
    this.onStep?.(this.i);
  }

  _targetRect(st) {
    const t = st.target;
    if (!t) return null;
    let v = typeof t === 'function' ? t() : document.querySelector(t);
    if (v instanceof Element) {
      if (v.offsetParent === null && getComputedStyle(v).position !== 'fixed') return null;
      const el = v;
      v = v.getBoundingClientRect();
      // 画面（シートのスクロール）の外にあれば、手順ごとに1回だけ見える所へスクロールする
      if ((v.bottom > innerHeight || v.top < 0) && this._scrolled !== this.i) {
        this._scrolled = this.i;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    if (!v || v.width <= 0 || v.height <= 0 || v.bottom < 0 || v.top > innerHeight || v.right < 0 || v.left > innerWidth) return null;
    return v;
  }

  /** 毎フレーム呼ぶ。ctx は done(ctx) に渡す（統計など）。visible=false の間（訪問中など）は隠す */
  update(ctx, visible = true) {
    if (!this.steps) return;
    // 新種のお知らせ・確認の画面などが開いている間は待つ
    if (document.querySelector('#new-species, .sh-back, #layout-picker:not([hidden]), #fishing-scene:not([hidden])')) visible = false;
    this.el.hidden = !visible;
    if (!visible) return;
    const st = this.steps[this.i];
    if (st.done?.(ctx)) return this._advance();
    const r = this._targetRect(st);
    this.rect = r;
    if (this._key !== this.i) {
      this._key = this.i;
      this._tapStep = this.i;
      const n = this.steps.length;
      const btn = st.next ? `<button data-gd="next" class="primary">${esc(st.next)}</button>` : '';
      this.card.innerHTML = `<small>${esc(this.label)}${n > 1 ? ` ${this.i + 1}/${n}` : ''}</small>${st.title ? `<b>${esc(st.title)}</b>` : ''}<p class="gd-text"></p>
        <div class="gd-acts"><button data-gd="stop" class="gd-stop">やめる</button>${btn}</div>`;
    }
    const text = r || !st.wait ? st.text : st.wait;
    const p = this.card.querySelector('.gd-text');
    if (p.textContent !== text) p.textContent = text;
    // 目標の周りだけ明るく残す。目標が見つからない間・説明だけの手順・自由に操作する手順（free）は暗くしない
    const show = !!r;
    const dim = show && !st.next && !st.free;
    this.ring.hidden = !show;
    this.finger.hidden = !show;
    for (const d of this.dims) d.hidden = !dim;
    if (show) {
      const L = r.left - PAD;
      const T = r.top - PAD;
      const R = r.right + PAD;
      const B = r.bottom + PAD;
      const set = (el, x, y, w, h) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
      set(this.dims[0], 0, 0, innerWidth, T);
      set(this.dims[1], 0, B, innerWidth, innerHeight - B);
      set(this.dims[2], 0, T, L, B - T);
      set(this.dims[3], R, T, innerWidth - R, B - T);
      set(this.ring, L, T, R - L, B - T);
      // 指は目標の下から指す（下の端に近ければ上から）
      const up = B + 56 < innerHeight;
      this.finger.textContent = up ? '👆' : '👇';
      this.finger.classList.toggle('down', !up);
      Object.assign(this.finger.style, { left: `${(L + R) / 2 - 18}px`, top: `${up ? B + 2 : T - 46}px` });
    }
    // カードは目標と重ならない側（目標が下半分なら上、上半分なら下）
    // 目標が無いとき（画面を操作して目標を出してもらう間）は、真ん中をふさがないよう上に出す
    // 自由に操作する手順（free）は、下のカタログなどをふさがないよう上に出す
    const low = !r || !!st.free || (r.top + r.bottom) / 2 > innerHeight / 2;
    this.card.classList.toggle('top', low && !st.next);
    this.card.classList.toggle('bottom', !!r && !low);
  }
}
