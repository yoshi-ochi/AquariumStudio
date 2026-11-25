// オブジェクト定義（データのみ。メッシュ生成は tankBuilder.js）
// 単位はすべてメートル。size は回転0のときの幅(x)・高さ(y)・奥行(z)。

export const CATEGORY = Object.freeze({
  TANK: 'tank',
  STRUCTURE: 'structure',
  INTERIOR: 'interior',
});

export const CATEGORY_LABELS = {
  [CATEGORY.TANK]: '水槽',
  [CATEGORY.STRUCTURE]: '館内オブジェ',
  [CATEGORY.INTERIOR]: '水槽内オブジェ',
};

const withCategory = (category) => (def) => ({ requiredStage: 1, ...def, category });

export const TANK_DEFS = [
  { id: 'cube30', name: '30cmキューブ', shape: 'box', size: { w: 0.3, h: 0.3, d: 0.3 }, price: 3000, appeal: 1 },
  { id: 'tank45', name: '45cm水槽', shape: 'box', size: { w: 0.45, h: 0.3, d: 0.3 }, price: 6000, appeal: 2 },
  { id: 'tank60', name: '60cm水槽', shape: 'box', size: { w: 0.6, h: 0.36, d: 0.3 }, price: 12000, appeal: 3 },
  { id: 'tank120', name: '120cm水槽', shape: 'box', size: { w: 1.2, h: 0.45, d: 0.45 }, price: 45000, appeal: 8 },
  { id: 'tank180', name: '180cm水槽', shape: 'box', size: { w: 1.8, h: 0.6, d: 0.6 }, price: 90000, appeal: 15 },
  { id: 'round', name: '円形水槽', shape: 'cylinder', size: { w: 1.2, h: 1.2, d: 1.2 }, price: 80000, appeal: 14 },
  { id: 'tunnel', name: '大型トンネル水槽', shape: 'tunnel', size: { w: 4, h: 3, d: 5 }, price: 600000, appeal: 120, requiredStage: 2 },
  // 世界の大型水族館の主水槽の上位約5%（約12,000m³）に合わせた 幅40×奥行30×高さ10m
  { id: 'atriumTank', name: '吹き抜け大水槽', shape: 'box', size: { w: 40, h: 10, d: 30 }, price: 0, appeal: 400, hidden: true, atrium: true },
  { id: 'mammal', name: '海生哺乳類用水槽', shape: 'mammal', size: { w: 5, h: 1.6, d: 4 }, landRatio: 0.35, price: 900000, appeal: 160, requiredStage: 2 },
].map(withCategory(CATEGORY.TANK));

export const STRUCTURE_DEFS = [
  { id: 'stand60', name: '水槽台 60cm', shape: 'stand', size: { w: 0.6, h: 0.7, d: 0.32 }, price: 5000, supportsTanks: true },
  { id: 'stand120', name: '水槽台 120cm', shape: 'stand', size: { w: 1.2, h: 0.7, d: 0.47 }, price: 12000, supportsTanks: true },
  { id: 'stand180', name: '水槽台 180cm', shape: 'stand', size: { w: 1.8, h: 0.7, d: 0.62 }, price: 20000, supportsTanks: true },
  { id: 'wall', name: '仕切り壁', shape: 'wall', size: { w: 3, h: 2.4, d: 0.12 }, price: 8000 },
  { id: 'staffDoor', name: '飼育員用ドア', shape: 'staffDoor', size: { w: 0.9, h: 2.05, d: 0.14 }, price: 20000, wallMount: true },
  { id: 'researchLab', name: '研究室', shape: 'researchLab', size: { w: 1.8, h: 2, d: 1.2 }, price: 200000, yardOnly: true },
  { id: 'breedingTank', name: '繁殖水槽', shape: 'breedingTank', size: { w: 1.6, h: 1.3, d: 0.9 }, price: 80000, yardOnly: true },
  { id: 'holdingTank', name: '予備水槽', shape: 'breedingTank', size: { w: 1.6, h: 1.3, d: 0.9 }, price: 150000, yardOnly: true, basement: true },
  { id: 'waterPlant', name: '水質管理設備', shape: 'waterPlant', size: { w: 2, h: 2.2, d: 1.4 }, price: 400000, yardOnly: true, basement: true },
  { id: 'cleanCenter', name: '清掃センター', shape: 'cleanCenter', size: { w: 1.8, h: 2, d: 1.2 }, price: 300000, yardOnly: true, basement: true },
  { id: 'freezer', name: '餌の冷凍庫', shape: 'freezer', size: { w: 1.2, h: 2, d: 0.8 }, price: 120000, yardOnly: true, text: 'エサ代 -20%・幸福度 +5%' },
  { id: 'liveFeed', name: '活き餌の培養水槽', shape: 'liveFeed', size: { w: 1.4, h: 1.6, d: 0.7 }, price: 180000, yardOnly: true, text: '幸福度 +8%（生きた餌で食いつきが良くなる）' },
  { id: 'foodPrep', name: '調餌室の作業台', shape: 'foodPrep', size: { w: 1.6, h: 2, d: 0.8 }, price: 90000, yardOnly: true, text: 'エサの間隔 1.5倍・幸福度 +4%' },
  // お土産店・カフェの置物は廃止（売店・食堂のエリアに置き換え）。以前のセーブを読むために定義だけ残す
  { id: 'souvenirShop', name: 'お土産店', shape: 'souvenirShop', size: { w: 1.5, h: 1.9, d: 1.1 }, price: 30000, hidden: true },
  { id: 'cafe', name: 'カフェ', shape: 'cafe', size: { w: 1.7, h: 1.9, d: 1.3 }, price: 50000, hidden: true },
  { id: 'entrance', name: '館内入口', shape: 'entrance', size: { w: 3, h: 2.8, d: 0.6 }, price: 30000 },
  // 階の移動用の階段：各階に1つずつ自動で置く（動かすのは自由、撤去はできない）
  { id: 'stairs', name: '階段', shape: 'stairs', size: { w: 1.4, h: 2.6, d: 3.2 }, price: 0, hidden: true, stairs: true },
].map(withCategory(CATEGORY.STRUCTURE));

// ---- 水槽内オブジェ ----------------------------------------------------------
// group: カタログのタブ。growth: ドラッグで成長できる種類（'colony' = 群体が広がる / 'driftwood' = 枝・幹）
// colony は「伸ばす」で範囲が広がり、「密度」で個体（枝・ポリプ・株・石）の数を変えられる（growth.js）
// 品ぞろえは美ら海水族館「サンゴの海」・モントレーベイ水族館「ケルプの森」・各地の公立水族館のサンゴ礁・藻場・河川展示で
// よく使われる種類（造礁サンゴ・ソフトコーラル・クマノミの宿主のイソギンチャク・海藻・水草・石）

const ROCK_SIZES = [
  { cm: 10, size: { w: 0.1, h: 0.08, d: 0.1 }, price: 500, appeal: 0.2 },
  { cm: 30, size: { w: 0.3, h: 0.22, d: 0.3 }, price: 2000, appeal: 0.6 },
  { cm: 50, size: { w: 0.5, h: 0.35, d: 0.5 }, price: 5000, appeal: 1.2 },
  { cm: 100, size: { w: 1, h: 0.6, d: 1 }, price: 15000, appeal: 3 },
];
// coralline は従来の ID（rock10 など）を維持
const ROCK_PALETTES = [
  { id: 'coralline', label: '石灰藻', suffix: '' },
  { id: 'dark', label: '黒め', suffix: '_dark' },
  { id: 'brown', label: '茶色め', suffix: '_brown' },
  { id: 'gray', label: 'グレー', suffix: '_gray' },
  // 岩の種類（名前ごと変える）
  { id: 'base', label: '', suffix: '_base', name: 'ベースロック', text: '生物の付いていない白い岩。サンゴ水槽の土台に' },
  { id: 'lava', label: '', suffix: '_lava', name: '溶岩石', text: '赤黒く穴の多い軽い石。日本の磯や水草水槽の石組みに' },
  { id: 'seiryu', label: '', suffix: '_seiryu', name: '青龍石', text: '白い筋の入った角ばった灰色の石。河川・水草水槽の石組みに' },
];
const ROCK_DEFS = ROCK_PALETTES.flatMap((p) =>
  ROCK_SIZES.map((r) => ({
    id: `rock${r.cm}${p.suffix}`,
    name: `${p.name ?? 'ライブロック'}${r.cm === 100 ? '1m' : `${r.cm}cm`}${p.label ? `・${p.label}` : ''}`,
    ...(p.text && { text: p.text }),
    shape: 'liveRock',
    palette: p.id,
    size: r.size,
    price: r.price,
    appeal: r.appeal,
    group: 'rock',
  })),
);

const CORAL_DEFS = [
  { id: 'acropora', name: 'ミドリイシ', shape: 'acropora', size: { w: 0.16, h: 0.1, d: 0.16 }, price: 6000, appeal: 2 },
  { id: 'brain', name: 'ノウサンゴ', shape: 'brain', size: { w: 0.12, h: 0.06, d: 0.12 }, price: 5000, appeal: 1.6 },
  { id: 'euphyllia', name: 'ナガレハナサンゴ', shape: 'euphyllia', size: { w: 0.12, h: 0.09, d: 0.12 }, price: 5500, appeal: 1.8 },
  { id: 'gsp', name: 'スターポリプ', shape: 'gsp', size: { w: 0.14, h: 0.02, d: 0.14 }, price: 2500, appeal: 1 },
  // 造礁サンゴ（coralReef.js）
  { id: 'montipora', name: 'コモンサンゴ', shape: 'montipora', size: { w: 0.16, h: 0.06, d: 0.16 }, price: 6000, appeal: 2, text: '薄い板が渦を巻いて重なるサンゴ。縁ほど明るい' },
  { id: 'porites', name: 'ハマサンゴ', shape: 'porites', size: { w: 0.16, h: 0.08, d: 0.16 }, price: 7000, appeal: 2, text: '丸いこぶが盛り上がる塊状のサンゴ。何百年もかけて巨大になる' },
  { id: 'pocillopora', name: 'ハナヤサイサンゴ', shape: 'pocillopora', size: { w: 0.13, h: 0.07, d: 0.13 }, price: 6500, appeal: 2, text: '太く短い枝が密に分かれる。枝の間に小魚が隠れる' },
  { id: 'turbinaria', name: 'スリバチサンゴ', shape: 'turbinaria', size: { w: 0.14, h: 0.06, d: 0.14 }, price: 6000, appeal: 1.8, text: 'すり鉢・巻いた葉のような黄緑の板状サンゴ' },
  { id: 'fungia', name: 'クサビライシ', shape: 'fungia', size: { w: 0.14, h: 0.02, d: 0.14 }, price: 4000, appeal: 1.4, text: '岩に付かず砂の上で暮らす円盤形の単体サンゴ' },
  { id: 'tubastraea', name: 'イボヤギ', shape: 'tubastraea', size: { w: 0.09, h: 0.03, d: 0.09 }, price: 4500, appeal: 1.6, text: '光合成をしない橙色のサンゴ。岩の陰で黄色い触手を開く' },
].map((d) => ({ ...d, group: 'coral', growth: 'colony' }));

// ソフトコーラル・イソギンチャク（coralSoft.js）。イソギンチャクはクマノミ類の住みかになる
const SOFT_DEFS = [
  { id: 'sarcophyton', name: 'ウミキノコ', shape: 'sarcophyton', size: { w: 0.11, h: 0.07, d: 0.11 }, price: 5000, appeal: 1.8, text: '太い柄の上に波打つ傘。傘の上でポリプが開く' },
  { id: 'discosoma', name: 'イソギンチャクモドキ', shape: 'discosoma', size: { w: 0.13, h: 0.02, d: 0.13 }, price: 3000, appeal: 1.2, text: '色とりどりの円盤が岩を覆う' },
  { id: 'entacmaea', name: 'タマイタダキイソギンチャク', shape: 'entacmaea', size: { w: 0.11, h: 0.08, d: 0.11 }, price: 8000, appeal: 2.4, text: '触手の先が玉のように膨らむ。クマノミの宿主' },
  { id: 'heteractis', name: 'センジュイソギンチャク', shape: 'heteractis', size: { w: 0.15, h: 0.09, d: 0.15 }, price: 12000, appeal: 3, text: '鮮やかな体に長い触手。岩の上でカクレクマノミが暮らす' },
  { id: 'stichodactyla', name: 'ハタゴイソギンチャク', shape: 'stichodactyla', size: { w: 0.18, h: 0.03, d: 0.18 }, price: 10000, appeal: 2.6, text: '大きく波打つ平らな口盤を短い触手が覆う。砂地に広がる' },
].map((d) => ({ ...d, group: 'soft', growth: 'colony' }));

// パーツ単位で追加・削除できるサンゴ（growth: 'modular'。tosaka / xenia は旧IDを引き継ぐ）
const MODULAR_CORAL_DEFS = [
  { id: 'tosaka', name: 'アカバナトサカ', shape: 'mod_akabana', size: { w: 0.14, h: 0.12, d: 0.14 }, price: 4500, appeal: 1.6 },
  { id: 'akayagi', name: 'アカヤギ', shape: 'mod_akayagi', size: { w: 0.22, h: 0.3, d: 0.05 }, price: 7000, appeal: 2.2 },
  { id: 'umieda', name: 'ウミエダミドリイシ', shape: 'mod_umieda', size: { w: 0.2, h: 0.12, d: 0.2 }, price: 8000, appeal: 2.4 },
  { id: 'usukami', name: 'ウスカミサンゴ', shape: 'mod_usukami', size: { w: 0.18, h: 0.08, d: 0.18 }, price: 6500, appeal: 2 },
  { id: 'kikumeishi', name: 'キクメイシ', shape: 'mod_kikumeishi', size: { w: 0.14, h: 0.07, d: 0.14 }, price: 5000, appeal: 1.6 },
  { id: 'shakogai', name: 'オオシャコガイ', shape: 'mod_shakogai', size: { w: 0.25, h: 0.11, d: 0.17 }, price: 30000, appeal: 5 },
  { id: 'tama', name: 'タマイワスナギンチャク', shape: 'mod_tama', size: { w: 0.08, h: 0.03, d: 0.08 }, price: 2500, appeal: 1 },
  { id: 'xenia', name: 'ウミアザミ', shape: 'mod_xenia', size: { w: 0.1, h: 0.06, d: 0.1 }, price: 3000, appeal: 1.2 },
  { id: 'junceella', name: 'リュウキュウミゾヤギ', shape: 'mod_junceella', size: { w: 0.12, h: 0.28, d: 0.12 }, price: 4000, appeal: 1.4 },
].map((d) => ({ ...d, group: 'coral', growth: 'modular' }));

const DECOR_DEFS = [
  { id: 'driftwood', name: '流木', shape: 'driftwood', size: { w: 0.4, h: 0.25, d: 0.15 }, price: 3000, appeal: 0.8, growth: 'driftwood' },
  { id: 'aeration', name: 'エアレーション', shape: 'airstone', size: { w: 0.05, h: 0.03, d: 0.05 }, price: 1500, appeal: 0.3, bubbles: true },
  { id: 'plants', name: '海藻・水草', shape: 'plants', size: { w: 0.3, h: 0.25, d: 0.2 }, price: 2500, appeal: 0.8, growth: 'colony' },
].map((d) => ({ ...d, group: 'decor' }));

// 海藻・海草（seaweedBuilder.js）。日本の水族館の藻場・海中林・沖縄の展示でよく見られる種類
const SEAWEED_DEFS = [
  { id: 'amamo', name: 'アマモ', shape: 'amamo', size: { w: 0.3, h: 0.45, d: 0.2 }, price: 3000, appeal: 1, text: '砂地に群落をつくる海草。稚魚のゆりかご' },
  { id: 'kajime', name: 'カジメ', shape: 'kajime', size: { w: 0.28, h: 0.4, d: 0.28 }, price: 4000, appeal: 1.4, text: '海中林をつくる褐藻' },
  { id: 'kelp', name: 'ジャイアントケルプ', shape: 'kelp', size: { w: 0.35, h: 1.2, d: 0.35 }, price: 12000, appeal: 3, text: '浮き袋で立ち上がる大型の褐藻。背の高い水槽向け' },
  { id: 'hondawara', name: 'ホンダワラ', shape: 'hondawara', size: { w: 0.26, h: 0.45, d: 0.26 }, price: 3500, appeal: 1.2, text: '丸い気胞を持つ褐藻。ガラモ場をつくる' },
  { id: 'umibudou', name: 'ウミブドウ', shape: 'umibudou', size: { w: 0.3, h: 0.1, d: 0.2 }, price: 3000, appeal: 1.2, text: '粒状の小枝がブドウのように付く緑藻（クビレズタ）' },
  { id: 'aosa', name: 'アオサ', shape: 'aosa', size: { w: 0.25, h: 0.1, d: 0.2 }, price: 1500, appeal: 0.6, text: '薄く波打つ明るい緑の緑藻' },
  { id: 'tengusa', name: 'テングサ', shape: 'tengusa', size: { w: 0.18, h: 0.16, d: 0.18 }, price: 2000, appeal: 0.9, text: '細かく枝分かれする紅藻。寒天の原料' },
  { id: 'umiuchiwa', name: 'ウミウチワ', shape: 'umiuchiwa', size: { w: 0.2, h: 0.12, d: 0.14 }, price: 2500, appeal: 1, text: '白い縞のある扇形の褐藻' },
  { id: 'konbu', name: 'コンブ', shape: 'konbu', size: { w: 0.16, h: 0.5, d: 0.16 }, price: 3500, appeal: 1.2, text: '帯のように長い葉を1枚伸ばす褐藻。北の海の藻場' },
  { id: 'miru', name: 'ミル', shape: 'miru', size: { w: 0.14, h: 0.16, d: 0.14 }, price: 2000, appeal: 0.9, text: '円柱の枝が二又に分かれる濃い緑の緑藻' },
  { id: 'saboten', name: 'サボテングサ', shape: 'saboten', size: { w: 0.13, h: 0.1, d: 0.13 }, price: 2500, appeal: 1, text: '石灰質の節が鎖のようにつながる緑藻。サンゴ礁の砂地' },
].map((d) => ({ ...d, group: 'seaweed', growth: 'colony' }));

// 淡水の水草・川原の石（アマゾン・河川の展示）
const FRESH_DEFS = [
  { id: 'amazonSword', name: 'アマゾンソード', shape: 'amazonSword', size: { w: 0.16, h: 0.3, d: 0.16 }, price: 2500, appeal: 1, text: '長い葉柄の葉がロゼット状に広がるアマゾン川の水草' },
  { id: 'vallisneria', name: 'バリスネリア', shape: 'vallisneria', size: { w: 0.16, h: 0.4, d: 0.16 }, price: 2000, appeal: 0.9, text: 'リボン状の葉が密生する水草。ランナーで増える' },
  { id: 'cobble', name: '玉石', shape: 'cobble', size: { w: 0.18, h: 0.03, d: 0.18 }, price: 1500, appeal: 0.4, text: '川原の丸い石。広げると川底になる' },
].map((d) => ({ ...d, group: 'decor', growth: 'colony' }));

export const INTERIOR_DEFS = [...ROCK_DEFS, ...CORAL_DEFS, ...MODULAR_CORAL_DEFS, ...SOFT_DEFS, ...SEAWEED_DEFS, ...DECOR_DEFS, ...FRESH_DEFS].map(withCategory(CATEGORY.INTERIOR));

/** カタログのタブ */
export const GROUP_LABELS = {
  tank: '水槽',
  structure: '館内オブジェ',
  rock: 'ライブロック',
  coral: 'サンゴ',
  soft: 'ソフトコーラル・イソギンチャク',
  seaweed: '海藻',
  decor: '流木・水草',
};
export const groupOf = (def) => def.group ?? def.category;

/** 館内モードで配置できる定義 */
export const PLACEABLE_TANKS = TANK_DEFS.filter((d) => !d.hidden);
export const HALL_DEFS = [...PLACEABLE_TANKS, ...STRUCTURE_DEFS.filter((d) => !d.hidden)];
export const ALL_DEFS = [...TANK_DEFS, ...STRUCTURE_DEFS, ...INTERIOR_DEFS];

const defMap = new Map(ALL_DEFS.map((d) => [d.id, d]));

export function getDef(id) {
  const def = defMap.get(id);
  if (!def) throw new Error(`Unknown object definition: ${id}`);
  return def;
}

export function hasDef(id) {
  return defMap.has(id);
}

/** 建造した水槽などを、後から定義に加える */
export function addDef(def) {
  if (defMap.has(def.id)) return defMap.get(def.id);
  const d = withCategory(CATEGORY.TANK)(def);
  TANK_DEFS.push(d);
  PLACEABLE_TANKS.push(d);
  HALL_DEFS.splice(PLACEABLE_TANKS.length - 1, 0, d); // 水槽の並びの最後へ
  ALL_DEFS.push(d);
  defMap.set(d.id, d);
  return d;
}
