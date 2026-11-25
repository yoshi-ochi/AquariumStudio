import * as H from './floraHard.js';
import * as E from './floraEncrust.js';
import * as S from './floraSoft.js';
import * as W from './floraWeed.js';

/**
 * 生き物オブジェの種ごとの設定（キーは tankData.js の id）。
 * kind
 *   grow  固着点から育つ群体（1つの形が大きくなる）。size = [最小, 最大]（m）を「成長」で動かす
 *   cover 面に広がる（被覆・群生）。ブラシで岩・砂・壁をなぞった範囲に、1個体の形を gap（m）おきに繰り返す。
 *         size があれば1株の高さ（海藻は上へ伸ばせる）
 * dim   大きさの呼び名（直径・高さ・殻の長さ）
 * max   個体数の上限、maxR ソフトコーラル・イソギンチャクの群体の最大半径（m。固着点から）
 * up    生える向き（0 面の法線どおり〜1 真上）、tilt 個体ごとの傾きのばらつき（rad）、sv 大きさのばらつき
 * wall  水槽の壁・岩の側面にも付く、flat 面ごとの陰影（硬い骨格・石）、pals 色の型の数、init 置いたときの個体数
 * link  となりの個体とつなぐ匍匐枝・地下茎・共肉 { r 太さ m, color, k 近い何個とつなぐか, range 間隔の何倍まで, flat 帯 }
 *       gap は「となりと接する（重なる）」間隔にする。隣接して広がる種はブラシ・置いたときとも六角形に詰める
 *
 * 最大の大きさは実物に合わせる：
 *   ミドリイシの卓 1m（野外では2m超）、ハマサンゴ 1.5m（数m に育つ）、ハナヤサイサンゴ 35cm、シャコガイ 殻長1.2m（記録137cm）
 *   トサカ 高さ1m（Dendronephthya は野外で最大1.8m）、ウミキノコ 傘の径80cm、ムチヤギ 1.5m、ヤギの扇 60cm
 *   センジュイソギンチャク 口盤1m（普通は30〜50cm）、ハタゴイソギンチャク 50cm（これを超えるのはまれ）
 *   タマイタダキ 1個体は口盤〜40cm、小型個体のクローンの群れは径1m ほど。スターポリプ・ウミアザミ・ディスクコーラルの群体は径60cm〜1m
 *   ジャイアントケルプ 6m（野外では30m超だが水槽の高さに合わせる）、コンブ 3m、ホンダワラ 2m、アマモ 1m
 */
const grow = (unit, size, o = {}) => ({ kind: 'grow', unit, size, s0: 0.25, dim: '直径', up: 0.85, tilt: 0.08, sv: 0, flat: true, pals: 3, ...o });
const cover = (unit, gap, o = {}) => ({ kind: 'cover', unit, gap, size: null, s0: 0.3, dim: '高さ', max: 300, up: 0, tilt: 0.15, sv: 0.25, wall: true, pals: 3, init: 3, ...o });
const weed = (unit, size, gap, o = {}) => cover(unit, gap, { size, up: 1, tilt: 0.12, sv: 0.2, pals: 1, ...o });

export const SPECS = {
  // 造礁サンゴ
  acropora: grow(H.acropora, [0.08, 1.0]),
  umieda: grow(H.umieda, [0.08, 0.7], { dim: '高さ' }),
  montipora: grow(H.montipora, [0.08, 0.9]),
  porites: grow(H.porites, [0.1, 1.5]),
  pocillopora: grow(H.pocillopora, [0.06, 0.35]),
  turbinaria: grow(H.turbinaria, [0.1, 0.8]),
  brain: grow(H.brain, [0.08, 0.8]),
  shakogai: grow(H.shakogai, [0.12, 1.2], { dim: '殻の長さ', up: 1, tilt: 0.05, flat: false }),
  kikumeishi: cover(E.kikumeishi, 0.055, { flat: true, init: 4 }), // 塊どうしが接して岩を覆う
  usukami: cover(E.usukami, 0.05, { flat: true, tilt: 0.25 }),
  tubastraea: cover(E.tubastraea, 0.026, { init: 5, flat: true }),
  fungia: cover(E.fungia, 0.11, { wall: false, init: 2, sv: 0.35, flat: true }),
  euphyllia: cover(E.euphyllia, 0.05, { up: 0.5 }),
  // ソフトコーラル・イソギンチャク
  tosaka: grow(S.tosaka, [0.06, 1.0], { dim: '高さ', flat: true }),
  akayagi: grow(S.akayagi, [0.1, 0.6], { dim: '高さ', up: 1, tilt: 0.04 }),
  junceella: grow(S.junceella, [0.25, 1.5], { dim: '高さ', flat: false }),
  sarcophyton: grow(S.sarcophyton, [0.06, 0.8], { flat: false }),
  heteractis: grow(S.heteractis, [0.1, 1.0], { s0: 0.2, flat: false, up: 0.6 }),
  stichodactyla: grow(S.stichodactyla, [0.1, 0.5], { flat: false, up: 0.3 }),
  gsp: cover(S.gsp, 0.05, { init: 5, maxR: 0.5, link: { r: 0.022, color: 0x6a3f8a, k: 3, range: 1.3, flat: true, lift: 0.002 } }), // 紫の走根のマットでつながる
  xenia: cover(S.xenia, 0.04, { init: 4, up: 0.3, maxR: 0.3 }),
  discosoma: cover(S.discosoma, 0.05, { init: 6, tilt: 0.3, maxR: 0.3, pals: 4 }), // 円盤が縁を重ねて岩を覆う
  tama: cover(S.tama, 0.03, { init: 7, maxR: 0.25, pals: 4, link: { r: 0.012, color: 0x7a6a4a, k: 3, range: 1.3, flat: true, lift: 0.0015 } }), // 共肉でつながり、ポリプがすき間なく並ぶ
  entacmaea: cover(S.entacmaea, 0.075, { init: 2, up: 0.5, maxR: 0.5 }),
  // 海藻・海草
  amamo: weed(W.amamo, [0.2, 1.0], 0.04, { wall: false, init: 7, max: 400, link: { r: 0.0025, color: 0x9a8a5a, k: 1, range: 1.7 } }), // 砂の中の地下茎でつながる
  kajime: weed(W.kajime, [0.2, 1.5], 0.18, { init: 2 }),
  kelp: weed(W.kelp, [0.3, 6], 0.22, { init: 2, max: 200, s0: 0.15 }),
  hondawara: weed(W.hondawara, [0.2, 2.0], 0.12),
  konbu: weed(W.konbu, [0.3, 3.0], 0.1, { s0: 0.2 }),
  miru: weed(W.miru, [0.1, 0.4], 0.07),
  saboten: weed(W.saboten, [0.06, 0.25], 0.05),
  umibudou: weed(W.umibudou, [0.05, 0.15], 0.032, { wall: false, init: 6, max: 400, link: { r: 0.0023, color: 0x5a9a40, k: 2, range: 1.7, lift: 0.002 } }), // 匍匐枝で網のようにつながる
  aosa: weed(W.aosa, [0.05, 0.2], 0.05, { init: 4 }),
  tengusa: weed(W.tengusa, [0.08, 0.3], 0.05),
  umiuchiwa: weed(W.umiuchiwa, [0.06, 0.2], 0.05, { init: 4 }),
  // 水草・川原の石
  plants: weed(W.plants, [0.1, 0.5], 0.035, { wall: false, init: 7, max: 400 }),
  amazonSword: weed(W.amazonSword, [0.15, 0.6], 0.16, { wall: false, init: 1 }),
  vallisneria: weed(W.vallisneria, [0.2, 1.5], 0.035, { wall: false, init: 6, max: 400, link: { r: 0.0018, color: 0x7a9a50, k: 1, range: 1.7 } }), // ランナーで子株がつながる
  cobble: cover(W.cobble, 0.045, { wall: false, init: 6, max: 400, tilt: 0.1, pals: 1 }), // 石どうしが接して川底になる
};
