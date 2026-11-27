/**
 * 描画の重さの設定。スマホ（指で操作する端末）では、発熱と電池を抑えるために画質を少し下げる。
 * - 画面の細かさ（ピクセル比）：スマホ 1.5 まで／パソコン 2 まで
 * - 影：毎コマ計算し直さず、一定の間隔だけ（照明ごとに影の計算で場面を描き直すため重い）
 * - コマ数：最大 60 コマ/秒（120Hz の画面でも 60）
 */
export const isMobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const QUALITY = {
  pixelRatio: isMobile ? 1.5 : 2,
  /** 影を計算し直す間隔（秒）。物を動かしている間は毎コマ */
  shadowInterval: isMobile ? 0.5 : 0.2,
  maxFps: 60,
};

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatio);
