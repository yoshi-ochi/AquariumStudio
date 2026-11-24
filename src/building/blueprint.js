/**
 * 水族館の間取り（データのみ）。地上2階建て＋屋外イルカプール。
 * rects は [x0, z0, x1, z1]（マス番号、両端を含む）。1マス = CELL_SIZE(m)。+Z が正面。
 * エリアの id と解放条件は全間取りで共通、形と順路だけが間取りごとに変わる。
 * 大きさ：大水槽ホールは 48×38マス（43×34m）で、30×40×10m の大水槽が入る。その他の展示室は 22×22マス（約20m四方）。
 */
export const CELL_SIZE = 0.9;
/**
 * 建物の左に屋外の敷地（44マス）：海獣広場（幅20m）・屋外バックヤード、その左に売店・食堂。生け簀は本館の右の海。
 * 建物の位置（ワールド座標）を変えないよう、左右に同じだけ広げている（右側は空き地）。
 */
export const GRID_X = 180;
const SITE_X = 44;
/** 版6：イルカプールの奥（北）に別館を置くため、格子を北へ広げた行数。ワールド座標は版5と同じ */
export const NORTH_ROWS = 62;
export const GRID_Z = 86 + NORTH_ROWS;
/** ワールド座標 z = 0 になる行（版5までの格子の中央） */
export const GRID_Z0 = 43 + NORTH_ROWS;
/** 建物の版（間取りの大きさを変えたら上げる。セーブの移行に使う） */
export const BUILDING_VERSION = 6;
/** イルカプールの客席の奥行き（客席の背から水面の中心まで）と、中心からステージ奥の壁まで(m) */
export const POOL_SEAT_REACH = 10.7;
const POOL_BACK = 7.2;
export const FLOOR_COUNT = 2;
/** 地下1階のフロア番号（地上は 0, 1） */
export const BASEMENT = 2;
export const PLAN_FLOORS = [0, 1, BASEMENT];

/**
 * 別館：最大レベルの後に建てる、30m四方の独立した建物（イルカプールの奥）。中は1つの広い展示室で、周囲をバックヤードが囲む。
 * 1F・2F は本館の 1F・2F と同じ階（同じ格子に並べて同時に表示）。3F 以上は別館だけの階で、階番号は WING_BASE + 階数-1。
 */
export const WING_BASE = 10;
export const WING_MAX = 8;
/** 別館の i 番目（0 = 1F）の階のフロア番号 */
export const wingFloor = (i) => (i < FLOOR_COUNT ? i : WING_BASE + i);
export const WING_FLOORS = Array.from({ length: WING_MAX }, (_, i) => wingFloor(i));
/** 別館だけの階（3F 以上） */
export const isWing = (floor) => floor >= WING_BASE + FLOOR_COUNT && floor < WING_BASE + WING_MAX;
/** 地上からの階（1F = 0。地下は -1） */
export const floorLevel = (floor) => (floor === BASEMENT ? -1 : floor >= WING_BASE ? floor - WING_BASE : floor);
/** 別館の展示室（34マス × 0.9m ≒ 30m 四方）の周りを囲むバックヤードの幅 */
export const WING_YARD = 2;
const WING_HALL = 34;
export const floorLabel = (floor) => (floor === BASEMENT ? 'B1' : isWing(floor) ? `別館${floorLevel(floor) + 1}F` : `${floor + 1}F`);
/** 建設済みの別館の階数 */
export const wingCount = (unlocked) => WING_FLOORS.filter((_, i) => unlocked.has(`wing${i + 1}`)).length;
/** 階の並び（下から）。別館だけの階は解放済みの階だけ */
export const floorOrder = (unlocked) => [BASEMENT, 0, 1, ...WING_FLOORS.filter((f) => isWing(f) && unlocked.has(`wing${floorLevel(f) + 1}`))];
/** 展示室の壁の裏に設ける管理通路の幅（2マス = 1.8m） */
export const SERVICE_WIDTH = 2;
export const EXHIBIT_ZONES = ['coast', 'subtropical', 'deep', 'archive'];
/** 1階分の高さ(m) */
export const STORY_H = 3.6;

export const ZONE_TYPE = Object.freeze({ HALL: 'hall', YARD: 'yard', VOID: 'void', OUTDOOR: 'outdoor' });
const { HALL, YARD, OUTDOOR } = ZONE_TYPE;

/**
 * 増築展示室：地下の空いた敷地に、順番に増やせる展示室。レベルに関係なく、前の部屋を開けば次を増築できる。
 * rects は敷地の絶対マス（全間取り共通。版5の格子の行番号で書き、北へ広げた分は後でずらす）。
 */
const ANNEX_RECTS = [
  [28, 3, 49, 24], [50, 3, 71, 24], [72, 3, 93, 24], [94, 3, 115, 24],
  [116, 3, 137, 24], [130, 25, 151, 46], [28, 25, 49, 46], [28, 47, 49, 68],
].map(([x0, z0, x1, z1]) => [x0, z0 + NORTH_ROWS, x1, z1 + NORTH_ROWS]);
export const ANNEX_IDS = ANNEX_RECTS.map((_, i) => `annex${i + 1}`);
const ANNEX_LINKS = [['annex1', 'annex2'], ['annex2', 'annex3'], ['annex3', 'annex4'], ['annex4', 'annex5'], ['annex5', 'annex6'], ['annex1', 'annex7'], ['annex7', 'annex8']];
function ANNEX_META() {
  return ANNEX_IDS.map((id, i) => ({
    id, name: `地下展示室${i + 1}`, floor: BASEMENT, type: HALL, stage: 1,
    cost: Math.round((1200000 * 1.6 ** i) / 100000) * 100000,
    requires: i === 0 ? 'b1a' : i === 6 ? 'annex1' : ANNEX_IDS[i - 1],
    color: '#5f8fb0', text: '地下に増築する展示室。好きな生き物を展示できる', annex: true,
  }));
}

function WING_META() {
  return WING_FLOORS.map((floor, i) => ({
    id: `wing${i + 1}`, name: `別館${i + 1}F`, floor, type: HALL, stage: 4,
    cost: i === 0 ? 30000000 : Math.round((12000000 * 1.35 ** (i - 1)) / 1000000) * 1000000,
    requires: i === 0 ? null : `wing${i}`,
    color: '#5aa8a0', annex: true, wing: true,
    text: i === 0 ? '30m四方の別館を建てる。壁を自由に立てて、好きなように使える' : `別館に${i + 1}階を増築する`,
  }));
}

const ZONE_META = [
  { id: 'entrance', name: 'エントランス', floor: 0, type: HALL, stage: 1, cost: 0, color: '#7fc8e8', text: '来館者を迎える最初のホール' },
  { id: 'yard1', name: '1Fバックヤード', floor: 0, type: YARD, stage: 1, cost: 0, color: '#c9ccd0', text: '研究室と繁殖設備を置ける職員エリア' },
  { id: 'coast', name: '近海エリア', floor: 0, type: HALL, stage: 1, cost: 150000, theme: 'temperate', color: '#6fbf9a', text: '日本近海の生き物を展示すると集客+25%' },
  { id: 'subtropical', name: '亜熱帯エリア', floor: 0, type: HALL, stage: 1, cost: 300000, theme: 'tropical', color: '#f2b45a', text: '熱帯の生き物を展示すると集客+25%' },
  { id: 'gallery', name: '2F回廊', floor: 1, type: HALL, stage: 1, cost: 500000, color: '#8fd3e0', text: '2階の入口。お土産店やカフェに最適' },
  { id: 'yard2', name: '2Fバックヤード', floor: 1, type: YARD, stage: 1, cost: 200000, requires: 'gallery', color: '#c9ccd0', text: '2階の職員エリア' },
  { id: 'atrium', name: '大水槽ホール', floor: 0, type: HALL, stage: 2, cost: 1500000, color: '#3f8fd0', text: '2階まで吹き抜けの大水槽を備えたホール' },
  { id: 'deep', name: '深海エリア', floor: 1, type: HALL, stage: 2, cost: 2000000, requires: 'gallery', theme: 'cold', color: '#4a5a9c', text: '冷たい海の生き物を展示すると集客+25%' },
  { id: 'archive', name: '資料エリア', floor: 1, type: HALL, stage: 2, cost: 1000000, requires: 'gallery', color: '#b79bd8', text: '研究の進み方が1.5倍になる' },
  { id: 'marine', name: '海獣広場', floor: 0, type: OUTDOOR, open: true, stage: 1, cost: 400000, color: '#8aa6b8', text: '建物の左の屋外の更地（幅20m）。海獣用水槽など、好きな水槽を自由に置ける' },
  { id: 'yard0', name: '屋外バックヤード', floor: 0, type: YARD, stage: 1, cost: 300000, requires: 'marine', color: '#c9ccd0', text: '海獣広場の周りを囲む、屋根のない職員エリア。設備や予備の水槽を置ける' },
  { id: 'store', name: '売店', floor: 0, type: HALL, stage: 1, cost: 300000, requires: 'marine', color: '#e6a15c', facility: 'store', text: '棚に商品が並ぶお土産の売店。タップで商品を補充できる' },
  { id: 'diner', name: '食堂', floor: 0, type: HALL, stage: 1, cost: 500000, requires: 'marine', color: '#e0c46c', facility: 'diner', text: '提供口とテーブルのある食堂。タップで料理を提供できる' },
  { id: 'b1a', name: '地下機械室', floor: BASEMENT, type: YARD, stage: 1, cost: 0, color: '#9aa4ad', text: '水質管理と予備水槽の基本エリア' },
  { id: 'b1b', name: '地下西ブロック', floor: BASEMENT, type: YARD, stage: 2, cost: 800000, requires: 'b1a', color: '#9aa4ad', text: '設備を増やせる地下の拡張区画' },
  { id: 'b1c', name: '地下東ブロック', floor: BASEMENT, type: YARD, stage: 3, cost: 2500000, requires: 'b1a', color: '#9aa4ad', text: '設備を増やせる地下の拡張区画' },
  { id: 'b1d', name: '地下南ブロック', floor: BASEMENT, type: YARD, stage: 4, cost: 8000000, requires: 'b1c', color: '#9aa4ad', text: '大規模な保持設備を置ける最大の区画' },
  ...ANNEX_META(),
  ...WING_META(),
  { id: 'pool', name: 'イルカプール', floor: 0, type: OUTDOOR, stage: 3, cost: 8000000, color: '#54c0d8', text: '2階建ての観客席を備えたショープール' },
  // 別館を建てると一緒にできる（auto：そのエリアの解放に連動）
  { id: 'corridor', name: '連絡通路', floor: 0, type: HALL, stage: 4, cost: 0, auto: 'wing1', annex: true, color: '#9fd0df', text: '本館と別館をつなぐ屋根付きの通路。イルカプールを迂回して本館の東側を通る' },
  { id: 'poolyard', name: 'プールバックヤード', floor: 0, type: YARD, stage: 3, cost: 600000, requires: 'pool', color: '#c9ccd0', text: 'イルカプールのステージ裏の、屋根のない職員エリア' },
];

/** 吹き抜けを囲む2階の回廊 */
const ring = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0 + 1, x0, z1 - 1], [x1, z0 + 1, x1, z1 - 1]];

export const LAYOUTS = [
  {
    id: 'spiral',
    name: '回遊らせん型',
    inspired: '大阪・海遊館の、中央の大水槽を巡りながら見る構成に着想',
    summary: '中央の大水槽をぐるりと囲む王道の間取り。どの展示室からも大水槽へ戻れます。',
    style: 'spiral',
    leftLink: 'coast',
    rects: {
      entrance: [[35, 58, 56, 79]], yard1: [[13, 14, 78, 19]], coast: [[13, 58, 34, 79]], subtropical: [[57, 58, 78, 79]],
      atrium: [[22, 20, 69, 57]], pool: [[29, 0, 62, 13]],
      gallery: [[35, 58, 56, 79], ...ring(22, 20, 69, 57)], yard2: [[13, 14, 78, 19]], deep: [[13, 58, 34, 79]], archive: [[57, 58, 78, 79]],
    },
    voidRect: [23, 21, 68, 56],
    // 大水槽ホールの両脇を通る管理通路で、手前の展示室を裏のバックヤードへつなぐ
    serviceLinks: [[13, 20, 14, 57], [77, 20, 78, 57]],
    links: [['entrance', 'atrium'], ['atrium', 'coast'], ['atrium', 'subtropical'], ['entrance', 'coast'], ['entrance', 'subtropical'], ['gallery', 'deep'], ['gallery', 'archive']],
  },
  {
    id: 'descent',
    name: '海の旅路型',
    inspired: '沖縄美ら海水族館の、サンゴ礁から黒潮、深海へ進む順路に着想',
    summary: '展示室を一本道でたどる物語型。奥へ進むほど海が深くなり、最後に大水槽が現れます。',
    style: 'descent',
    rects: {
      entrance: [[44, 52, 65, 73]], coast: [[22, 52, 43, 73]], subtropical: [[0, 52, 21, 73]], atrium: [[0, 14, 47, 51]],
      yard1: [[48, 14, 65, 51]], pool: [[15, 0, 50, 13]],
      gallery: [[44, 52, 65, 73]], archive: [[22, 52, 43, 73]], deep: [[0, 52, 21, 73]], yard2: [[48, 14, 65, 51]],
    },
    voidRect: [1, 15, 46, 50],
    links: [['entrance', 'coast'], ['coast', 'subtropical'], ['subtropical', 'atrium'], ['gallery', 'archive'], ['archive', 'deep']],
    requires: { subtropical: 'coast', atrium: 'subtropical', deep: 'archive' },
    leftLink: 'subtropical',
  },
  {
    id: 'radial',
    name: '放射ギャラリー型',
    inspired: 'ジョージア水族館の、中央ホールから各展示棟へ分かれる構成に着想',
    summary: '十字に広がる展示棟の中心が大ホール。好きな順に回れて、来館者が滞りにくい間取りです。',
    style: 'radial',
    leftLink: 'coast',
    rects: {
      atrium: [[22, 18, 69, 55]], entrance: [[35, 56, 56, 77]], coast: [[0, 18, 21, 39]], subtropical: [[70, 18, 91, 39]],
      yard1: [[0, 40, 21, 61], [70, 40, 91, 61]], pool: [[32, 0, 59, 16]],
      gallery: [[35, 56, 56, 77], ...ring(22, 18, 69, 55)], deep: [[0, 18, 21, 39]], archive: [[70, 18, 91, 39]], yard2: [[0, 40, 21, 61], [70, 40, 91, 61]],
    },
    voidRect: [23, 19, 68, 54],
    links: [['entrance', 'atrium'], ['atrium', 'coast'], ['atrium', 'subtropical'], ['gallery', 'deep'], ['gallery', 'archive']],
    // 大ホールの裏で東西の管理通路をつなぐ
    serviceLinks: [[0, 17, 91, 17]],
  },
  {
    id: 'pavilion',
    name: '分棟パビリオン型',
    inspired: 'バレンシア・オセアノグラフィックの、海域ごとに建物を分ける構成に着想',
    summary: '海域ごとの独立した棟を渡り廊下でつなぎます。棟ごとに世界観をはっきり分けられます。',
    style: 'pavilion',
    leftLink: 'coast',
    rects: {
      entrance: [[35, 62, 56, 83], [45, 52, 46, 61], [22, 66, 34, 67], [57, 66, 69, 67]], coast: [[0, 56, 21, 77]], subtropical: [[70, 56, 91, 77]],
      atrium: [[22, 14, 69, 51]], yard1: [[0, 14, 21, 35]], pool: [[28, 0, 63, 12]],
      gallery: [[35, 62, 56, 83], [45, 52, 46, 61], [22, 66, 34, 67], [57, 66, 69, 67], ...ring(22, 14, 69, 51)], deep: [[0, 56, 21, 77]], archive: [[70, 56, 91, 77]], yard2: [[0, 14, 21, 35]],
    },
    voidRect: [23, 15, 68, 50],
    links: [['entrance', 'coast'], ['entrance', 'subtropical'], ['entrance', 'atrium'], ['gallery', 'deep'], ['gallery', 'archive']],
    // 離れた棟の管理通路をメインバックヤードへつなぐ渡り通路
    serviceLinks: [[4, 36, 5, 55], [88, 13, 89, 55], [0, 13, 89, 13]],
  },
];

// 建物の区画を敷地の中央へ寄せ、北へ広げた分だけ行をずらす（ワールド座標は変わらない）
const shift = ([x0, z0, x1, z1]) => [x0 + SITE_X, z0 + NORTH_ROWS, x1 + SITE_X, z1 + NORTH_ROWS];
const N = NORTH_ROWS;
for (const l of LAYOUTS) {
  for (const id of Object.keys(l.rects)) l.rects[id] = l.rects[id].map(shift);
  // 本館の東端の列と、そこに面する1階の展示室（連絡通路の本館側の出入口）
  const R = Math.max(...Object.entries(l.rects).filter(([id]) => id !== 'pool').flatMap(([, rs]) => rs.map((r) => r[2])));
  const east = Object.entries(l.rects).find(([id, rs]) => ZONE_META.find((z) => z.id === id && z.floor === 0 && z.type === HALL) && rs.some((r) => r[2] === R));
  l.voidRect = shift(l.voidRect);
  // 建物の左端から、海獣広場（22マス≒20m）、その左に売店・食堂（各22マス四方）。
  // 屋外バックヤードは海獣広場の北・西・南の縁（幅2マス）を囲む。売店・食堂への出入口の前は空ける
  const L = Math.min(...Object.entries(l.rects).filter(([id]) => id !== 'pool').flatMap(([, rs]) => rs.map((r) => r[0])));
  Object.assign(l.rects, {
    marine: [[L - 22, 2 + N, L - 1, 85 + N]],
    yard0: [[L - 22, 2 + N, L - 1, 3 + N], [L - 22, 4 + N, L - 21, 38 + N], [L - 22, 43 + N, L - 21, 60 + N], [L - 22, 65 + N, L - 21, 83 + N], [L - 22, 84 + N, L - 1, 85 + N]],
    store: [[L - 44, 30 + N, L - 23, 51 + N]], diner: [[L - 44, 52 + N, L - 23, 73 + N]],
  });
  // プールのステージ奥の壁より北に、プールバックヤード（24×10マス）。その北に4マス空けて別館（展示室34マス＋周りのバックヤード）
  const [px0, , px1, pz1] = l.rects.pool[0];
  const pcx = Math.round((px0 + px1 + 1) / 2);
  const back = (pz1 + 1 - GRID_Z0) * CELL_SIZE - POOL_SEAT_REACH - POOL_BACK;
  const yz1 = Math.floor(back / CELL_SIZE + GRID_Z0) - 1;
  l.rects.poolyard = [[pcx - 12, yz1 - 9, pcx + 11, yz1]];
  const W = WING_HALL + WING_YARD * 2;
  l.wingRect = [pcx - W / 2, yz1 - 13 - W, pcx + W / 2 - 1, yz1 - 14];
  // 連絡通路（幅4マス）：別館の東面の中央から東へ出て、プールを避けて本館の東側を南へ下り、東端の展示室の脇へつなぐ
  const wc = Math.floor((l.wingRect[1] + l.wingRect[3] + 1) / 2);
  const [, ez0, , ez1] = east[1].find((r) => r[2] === R);
  const end = Math.floor((ez0 + ez1) / 2) + 2;
  l.rects.corridor = [[l.wingRect[2] + 1, wc - 2, R + 4, wc + 1], [R + 1, wc + 2, R + 4, end]];
  l.links = [...l.links, ['corridor', 'wing1'], ['corridor', east[0]]];
  l.links = [...l.links, ['marine', l.leftLink], ['marine', 'store'], ['marine', 'diner']];
  l.serviceLinks = (l.serviceLinks ?? []).map(shift);
  Object.assign(l.rects, { b1a: [[72, 25 + N, 107, 46 + N]], b1b: [[50, 25 + N, 71, 46 + N]], b1c: [[108, 25 + N, 129, 46 + N]], b1d: [[50, 47 + N, 129, 58 + N]] });
  ANNEX_RECTS.forEach((r, i) => (l.rects[ANNEX_IDS[i]] = [r]));
  WING_FLOORS.forEach((_, i) => (l.rects[`wing${i + 1}`] = [l.wingRect]));
  l.links = [...l.links, ...ANNEX_LINKS];
}

/** 作り付けの景観が占める区画（区画の内側に余白をとる） */
function sceneryRect(id, [x0, z0, x1, z1]) {
  return null;
}

export const DEFAULT_LAYOUT = LAYOUTS[0].id;
export const START_ZONES = ZONE_META.filter((z) => z.cost === 0 && !z.auto).map((z) => z.id);
export const inRect = ([x0, z0, x1, z1], i, j) => i >= x0 && i <= x1 && j >= z0 && j <= z1;
const rectCenter = ([x0, z0, x1, z1]) => ({ x: ((x0 + x1 + 1) / 2 - GRID_X / 2) * CELL_SIZE, z: ((z0 + z1 + 1) / 2 - GRID_Z0) * CELL_SIZE });

// 選択中の間取り（setLayout で切り替わる）
export let LAYOUT = LAYOUTS[0];
export let ZONES = [];
export let ATRIUM_VOID = null;
export let ATRIUM_TANK_POS = null;
/** 別館の区画（周りのバックヤードを含む。マス番号）と、その中心（ワールド座標） */
export let WING_RECT = null;
export const WING_GRID_CENTER = { x: 0, z: 0 };
/** 自由に編集した壁。{ 階: { add: [境目キー], remove: [境目キー] } } */
export let WALL_EDITS = {};
export const setWallEdits = (edits) => (WALL_EDITS = JSON.parse(JSON.stringify(edits ?? {})));

/** プレイヤーが付けたエリア名 { id: 名前 } */
let ZONE_NAMES = {};
export const MAX_ZONE_NAME = 16;
export const defaultZoneName = (id) => ZONE_META.find((z) => z.id === id)?.name ?? id;
/** エリア名を設定する（空なら元の名前に戻す） */
export function setZoneNames(names) {
  ZONE_NAMES = {};
  for (const [id, n] of Object.entries(names ?? {})) {
    const name = String(n ?? '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, MAX_ZONE_NAME);
    if (name && ZONE_META.some((z) => z.id === id)) ZONE_NAMES[id] = name;
  }
  for (const z of ZONES) z.name = ZONE_NAMES[z.id] ?? defaultZoneName(z.id);
  return { ...ZONE_NAMES };
}

export function setLayout(id) {
  LAYOUT = LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
  ZONES = ZONE_META.map((z) => ({ ...z, name: ZONE_NAMES[z.id] ?? z.name, rects: LAYOUT.rects[z.id], requires: LAYOUT.requires?.[z.id] ?? z.requires, scenery: z.open ? sceneryRect(z.id, LAYOUT.rects[z.id][0]) : null }));
  ATRIUM_VOID = { floor: 1, rect: LAYOUT.voidRect, zone: 'atrium' };
  ATRIUM_TANK_POS = rectCenter(LAYOUT.voidRect);
  WING_RECT = LAYOUT.wingRect;
  Object.assign(WING_GRID_CENTER, rectCenter(WING_RECT));
}
setLayout(DEFAULT_LAYOUT);

export const getZone = (id) => ZONES.find((z) => z.id === id);
/** レベル2以降は、そのレベルまでのエリアがレベルアップで解放される（レベル1は購入のみ） */
export const zonesUpToLevel = (level) => (level >= 2 ? ZONES.filter((z) => z.stage <= level && !z.annex).map((z) => z.id) : []);
export const zoneHas = (zone, i, j) => zone.rects.some((r) => inRect(r, i, j));

/** ワールド座標 → マス番号 */
export const cellAt = (x, z) => [Math.floor(x / CELL_SIZE + GRID_X / 2), Math.floor(z / CELL_SIZE + GRID_Z0)];

/** その位置のエリア */
export function zoneAt(floor, x, z) {
  const [i, j] = cellAt(x, z);
  return ZONES.find((a) => a.floor === floor && zoneHas(a, i, j)) ?? null;
}

/** 区画 [x0, z0, x1, z1] の中心（ワールド座標） */
export const zoneRectCenter = (rect) => rectCenter(rect);
/** エリアの中心（最初の区画の中心。ワールド座標） */
export const zoneCenter = (zone) => rectCenter(zone.rects[0]);

/** 間取りを選ぶ前の建物（旧セーブの移行に使う） */
const OLD_RECTS = {
  entrance: [14, 33, 25, 45], yard1: [2, 16, 37, 20], coast: [2, 21, 13, 45], subtropical: [26, 21, 37, 45], gallery: [14, 33, 25, 45],
  yard2: [2, 16, 37, 20], atrium: [14, 21, 25, 32], deep: [2, 21, 13, 45], archive: [26, 21, 37, 45],
};
/** 旧建物でのエリアと、その中心からのずれ */
export function oldZoneOffset(floor, x, z) {
  const [i, j] = cellAt(x, z);
  const hit = ZONE_META.find((m) => m.floor === floor && OLD_RECTS[m.id] && inRect(shift(OLD_RECTS[m.id]), i, j));
  if (!hit) return null;
  const c = rectCenter(shift(OLD_RECTS[hit.id]));
  return { id: hit.id, dx: x - c.x, dz: z - c.z };
}
