import { tutorialSteps, goalSteps } from './guideSteps.js';

/**
 * はじめての人向けのチュートリアルと、目標の進め方の案内。どちらも guide.js（押す場所を指のマークで示す）で出す。
 * チュートリアルの進み具合は state.flags.tutorial に保存する（undefined: 未開始 / 数字: 進行中の手順 / 'done': 終了）
 */
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const REWARD = 20000;

export class Tutorial {
  constructor({ guide, env, getState, getStats, economy, toast }) {
    Object.assign(this, { guide, env, getState, getStats, economy, toast });
    this.kind = null; // 'tutorial' | 'goal'
  }

  get flags() {
    return this.getState().flags;
  }

  /** 読み込み後に呼ぶ：はじめての水族館なら開始、すでに遊んでいる人は案内しない */
  check() {
    const f = this.flags;
    if (f.tutorial === undefined) {
      const s = this.getStats();
      const fresh = !this.getState().goals.length && s.species === 0 && s.creatures === 0;
      f.tutorial = fresh ? 0 : 'done';
    }
    if (typeof f.tutorial === 'number' && !this.guide.active) this._startTutorial(f.tutorial);
  }

  /** メニューから最初からやり直す */
  restart() {
    this.flags.tutorial = 0;
    this.guide.stop(false);
    this._startTutorial(0);
  }

  _startTutorial(from) {
    this.kind = 'tutorial';
    this.guide.start(tutorialSteps(this.env), {
      label: 'チュートリアル',
      from,
      onStep: (i) => (this.flags.tutorial = i),
      onEnd: (completed) => this._finish(completed),
    });
  }

  _finish(completed) {
    this.kind = null;
    const first = !this.flags.tutorialPaid;
    this.flags.tutorial = 'done';
    if (completed && first) {
      this.flags.tutorialPaid = true;
      this.economy.earn(REWARD);
      this.toast(`チュートリアル完了！ ${yen(REWARD)} を獲得しました`);
    }
  }

  /** 目標カードをタップしたとき：その目標の進め方を案内する（チュートリアル中は案内しない） */
  guideGoal(goal) {
    if (this.kind === 'tutorial') return this.toast('チュートリアルを終えてから案内します');
    this.guide.stop(false);
    this.kind = 'goal';
    this.guide.start(goalSteps(goal, this.env), {
      label: `目標：${goal.text.replace(/（.*$/, '')}`,
      onEnd: (completed) => {
        this.kind = null;
        if (completed) this.toast('目標を達成したら、目標カードの「報酬」をタップしましょう');
      },
    });
  }
}
