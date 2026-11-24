/**
 * 追加予定の魚種と採取地（データのみ）。
 *
 * 魚種はモデルが出来た時点で本番に出る（speciesRelease.js）：
 *   - 写真をトレースした体（creatureAnatomy*.js の ANATOMY[id]）を追加する、または
 *   - 体形の組み立てで作った種は model: true を付ける
 * main へマージすると GitHub Actions が GitHub Pages に公開し、ログイン時に「新しく追加された魚種」として案内される。
 * 公開日は `npm run species:release` で speciesReleases.js に記録する（tools/species-release.mjs）。
 *
 * 採取地は、捕れる魚種（モデルのある種）が MIN_POOL 種そろうまで地図に出さない。
 * 項目は creatureData.js の c() と同じ（len は全長 m、rarity 1〜4、appeal は集客力、colors は体・腹・ひれの色）。
 * methods は漁法（fishingData.js）、note は図鑑の解説、seasons は捕れる季節（0春〜3冬）。
 */
const p = (id, name, form, len, rarity, appeal, body, belly, fin, extra = {}) => ({ id, name, form, len, rarity, slots: 1, appeal, colors: { body, belly, fin }, ...extra });

export const PLANNED = [
  // ---- 日本海 ----
  p('hotaruika', 'ホタルイカ', 'squid', 0.07, 2, 4, 0x3b3f7a, 0x8790c0, 0x2c2f5c, { seasons: [0], methods: ['setnet'], note: '昼は水深200m以深にすみ、夜に浅場へ上がる。腕先と腹の発光器で青白く光る。春の富山湾で産卵のため岸に寄る。' }),
  p('shiroebi', 'シロエビ', 'lobster', 0.07, 2, 3, 0xf2d6cc, 0xfbeae4, 0xe8b8ac, { school: true, methods: ['trawl'], note: '富山湾の「あいがめ」と呼ばれる海底谷に群れる半透明のエビ。死ぬと白くなる。' }),
  p('benizuwai', 'ベニズワイガニ', 'crab', 0.3, 2, 6, 0xc83a24, 0xeeb090, 0xb02e1e, { longLegs: true, methods: ['pots'], note: '水深500〜2700mの日本海の深海にすむ。生きているときから全身が紅色。' }),
  p('norogenge', 'ノロゲンゲ', 'eel', 0.3, 2, 4, 0x5c4f58, 0x8a7c84, 0x4a3f48, { methods: ['trawl', 'pots'], note: '日本海の深海の底でじっとしている。体はぶよぶよのゼラチン質で、動きはとてもゆっくり。' }),
  p('hatahata', 'ハタハタ', 'perch', 0.2, 1, 2, 0xb8a27a, 0xf0eadc, 0x9a8460, { pat: 'mottle', mark: 0x6a5238, seasons: [3], methods: ['setnet', 'trawl'], note: '昼は砂に潜って目だけを出し、夜に餌を探す。冬の雷の頃に産卵のため岸へ押し寄せる。' }),
  p('nodoguro', 'アカムツ', 'perch', 0.35, 3, 8, 0xe0503a, 0xf4c0b0, 0xd04030, { bigEye: true, methods: ['longline', 'trawl'], note: '口の中が黒いことから「ノドグロ」と呼ばれる。水深100〜200mの岩場の近くにすむ。' }),
  p('kobudai', 'コブダイ', 'hump', 0.8, 2, 7, 0xa8574a, 0xe0b0a0, 0x8a4438, { methods: ['setnet', 'diving'], note: '大きなオスは額がこぶのように張り出す。夜は岩の割れ目で眠り、硬い貝やウニを噛み砕く。' }),
  p('kyusen', 'キュウセン', 'perch', 0.2, 1, 1.5, 0x9ab47a, 0xe8e0c0, 0xd8a050, { pat: 'stripes', mark: 0x5a4030, methods: ['setnet', 'diving'], note: 'ベラの仲間。夜や冬は砂に潜って眠る。オスは青緑、メスは黄褐色の縦じま。' }),
  p('kurosoi', 'クロソイ', 'grouper', 0.4, 1, 2, 0x3e3c3a, 0x8a8680, 0x2e2c2a, { methods: ['setnet', 'gill'], note: '岩礁の陰でじっと待ち伏せる。卵ではなく子どもを産む「卵胎生」の魚。' }),
  // ---- 熱帯の海（パラオ・モルディブ・紅海・ハワイ・カリブ海） ----
  p('nanyoumanta', 'ナンヨウマンタ', 'ray', 3.5, 3, 28, 0x262e38, 0xf0f2f2, 0x1c242c, { methods: ['setnet', 'diving'], note: 'サンゴ礁の近くにすむマンタ。クリーニングステーションで小魚に体を掃除してもらい、後ろ向きに宙返りしながらプランクトンを食べる。' }),
  p('nemuribuka', 'ネムリブカ', 'shark', 1.6, 2, 12, 0x7b8188, 0xe8eaec, 0x6c7278, { methods: ['longline', 'diving'], note: '昼は洞窟や岩棚の底でじっと休み、夜に獲物を探す。泳がなくてもえらに水を送って呼吸できる。' }),
  p('rouninaji', 'ロウニンアジ', 'tuna', 1.2, 2, 10, 0x6a7680, 0xd8dde0, 0x3e4850, { methods: ['pole', 'troll'], note: 'アジの仲間の最大種。単独で礁の外縁を巡回し、高速で小魚の群れに突っ込む。' }),
  p('kumanomi', 'クマノミ', 'clown', 0.12, 1, 1.5, 0x3a2416, 0xf0902e, 0xf0a030, { pat: 'clown', mark: 0xffffff, methods: ['diving'], note: '住みかのイソギンチャクから離れずに暮らす。尾びれが黄色い。' }),
  p('hanagoi', 'ハナゴイ', 'perch', 0.1, 2, 2.5, 0xb07ad0, 0xd8b8e8, 0xe8a0c8, { school: true, methods: ['diving'], note: '紫色のハナダイの仲間。礁の斜面の上で群れてプランクトンをついばみ、驚くとサンゴへ逃げ込む。' }),
  p('nishikiteguri', 'ニシキテグリ', 'perch', 0.06, 3, 8, 0x2a6ab8, 0x3a8ad0, 0xe87a28, { pat: 'stripes', mark: 0xf08a30, methods: ['diving'], note: 'サンゴのがれ場の底すれすれを、胸びれでホバリングするように動く。夕暮れにペアで産卵する。' }),
  p('hirenagahagi', 'ヒレナガハギ', 'tang', 0.4, 2, 4, 0x6a5240, 0xc8b8a0, 0x3a3028, { pat: 'bands', bands: 6, mark: 0xf0e0a0, methods: ['diving'], note: '背びれと尻びれが大きく帆のように広がるハギ。紅海の礁で藻をついばむ。' }),
  p('herayagara', 'ヘラヤガラ', 'needle', 0.8, 2, 5, 0xc8a04a, 0xe8d8a8, 0x8a6a30, { methods: ['diving'], note: '頭を下にした縦の姿勢でヤギ類に紛れ、筒形の口で小魚を吸い込む。大きな魚の陰に隠れて忍び寄る。' }),
  p('fueyakko', 'フエヤッコダイ', 'disc', 0.22, 2, 3.5, 0xf2d22c, 0xf8f0c0, 0xf2d22c, { pat: 'mask', mark: 0x141414, methods: ['diving'], note: '長い口先で岩のすき間の小さな生き物をつまみ出すチョウチョウウオ。' }),
  p('hashinagairuka', 'ハシナガイルカ', 'whale', 2.0, 4, 60, 0x4e5866, 0xe8eaee, 0x40485a, { methods: ['setnet'], note: '水面から跳び上がり、体をきりもみ状に何回転もさせる「スピナー」。昼は湾で休み、夜に沖で狩りをする。' }),
  p('queenangel', 'クイーンエンゼルフィッシュ', 'disc', 0.45, 3, 10, 0x2f7ac8, 0xe8d040, 0xf0c828, { pat: 'spots', mark: 0x1a3a8a, methods: ['diving'], note: '額に青い王冠のような斑紋をもつカリブ海のキンチャクダイ。主に海綿を食べる。' }),
  p('komorizame', 'コモリザメ', 'shark', 2.5, 2, 16, 0x9a8462, 0xe0d4bc, 0x86704e, { methods: ['longline', 'gill'], note: '昼は岩棚の下で何匹も重なって休む。頬の筋肉でえらに水を送り、海底に止まったまま呼吸する。' }),
  p('oomejirozame', 'オオメジロザメ', 'shark', 3, 3, 30, 0x7a8288, 0xeceeee, 0x6a7278, { methods: ['longline'], note: '海だけでなく川をさかのぼって淡水でも暮らせる珍しいサメ。浅く濁った水域を好む。' }),
  // ---- 温帯の海（モントレー湾・地中海） ----
  p('rakko', 'ラッコ', 'whale', 1.3, 4, 80, 0x5a4232, 0xb8a08a, 0x4a3626, { methods: ['diving'], note: '水面に仰向けで浮かび、お腹の上で貝を石で割って食べる。眠るときは流されないようケルプを体に巻き付ける。' }),
  p('ashika', 'カリフォルニアアシカ', 'whale', 2.0, 3, 50, 0x4a3a2e, 0x8a7460, 0x3a2e24, { methods: ['diving'], note: '大きな前ひれで水をかいて速く泳ぎ、イルカのように水面を跳ねながら進む。' }),
  p('garibaldi', 'ガリバルディ', 'perch', 0.3, 2, 5, 0xf26a14, 0xf48a3a, 0xf06010, { methods: ['diving'], note: 'ケルプの森にすむ鮮やかな橙色のスズメダイ。オスは巣の周りの縄張りを激しく守る。' }),
  p('leopardshark', 'レオパードシャーク', 'shark', 1.5, 2, 10, 0x9a9286, 0xece6dc, 0x8a8276, { pat: 'bands', bands: 10, mark: 0x3a3430, methods: ['gill', 'longline'], note: '背中に鞍形の黒い斑紋が並ぶ。浅い湾の海底近くを群れで泳ぎ回る。' }),
  p('atlbluefin', 'タイセイヨウクロマグロ', 'tuna', 2.5, 4, 85, 0x1c2c4c, 0xe0e6ea, 0x223450, { methods: ['longline', 'purse'], note: '大西洋と地中海を回遊する巨大なマグロ。体温を海水より高く保ち、冷たい海でも速く泳ぐ。' }),
  // ---- アマゾン川（淡水） ----
  p('arapaima', 'ピラルク', 'cod', 2.5, 4, 70, 0x55604a, 0xc8b8a0, 0xb8402a, { methods: ['gill', 'diving'], note: '世界最大級の淡水魚。えらだけでは呼吸が足りず、10〜20分ごとに水面で空気を吸う。' }),
  p('arowana', 'シルバーアロワナ', 'needle', 0.9, 3, 20, 0xd8dcd8, 0xeef0ee, 0xb8c0bc, { methods: ['gill'], note: '水面のすぐ下をゆったり泳ぎ、水面から跳び上がって枝の上の虫やトカゲを捕らえる。' }),
  p('piranha', 'ピラニア・ナッテリー', 'disc', 0.3, 2, 8, 0x8a96a0, 0xd8462c, 0x6a7680, { pat: 'spots', mark: 0x4a5058, methods: ['gill'], note: '群れで暮らし、ふだんは臆病。獲物を見つけると一気に突進して鋭い歯でかじり取る。' }),
  p('redtail', 'レッドテールキャットフィッシュ', 'cod', 1.3, 3, 18, 0x2e2e30, 0xf0ece4, 0xd84a2a, { methods: ['longline'], note: '赤い尾びれの大型ナマズ。昼は川底でじっとし、夜に長いひげで獲物を探す。' }),
  p('polkadot', 'ポルカドットスティングレイ', 'ray', 0.6, 4, 25, 0x1a1a1e, 0xe8e4dc, 0x141418, { pat: 'spots', mark: 0xf4f4f0, methods: ['diving'], note: '黒地に白い水玉模様の淡水エイ。川底の砂に潜って身を隠す。' }),
  p('denkiunagi', 'デンキウナギ', 'eel', 2.0, 4, 40, 0x4a4a3a, 0xd88a3a, 0x3a3a2e, { methods: ['gill'], note: '最大860ボルトの電気を出す。口から空気を吸う呼吸が必要で、数分ごとに水面へ上がる。長い尻びれを波打たせて前後に泳ぐ。' }),
];

/** 新しい採取地（日本海側と世界各地）。pool にはモデルのある種だけが残る */
export const NEW_PLACES = [
  { id: 'oki', name: '隠岐諸島', text: '対馬暖流が洗う日本海の島々。コブダイが岩礁に暮らす', stage: 1, cost: 15000, seconds: 600, lat: 36.2, lon: 133.2, opened: '2026-11-25', zone: 'temperate', pool: ['kobudai', 'kyusen', 'kurosoi', 'nodoguro', 'mejina', 'ishidai', 'madai', 'kurodai', 'kijihata', 'kasago', 'mebaru', 'kawahagi', 'umazura', 'tobiuo', 'buri', 'surume', 'hirame'] },
  { id: 'toyama', name: '富山湾', text: '春にホタルイカが群れ、深い冷水にシロエビやベニズワイガニがすむ日本海の湾', stage: 2, cost: 40000, seconds: 600, lat: 36.85, lon: 137.25, opened: '2026-11-25', zone: 'cold', pool: ['hotaruika', 'shiroebi', 'benizuwai', 'norogenge', 'nodoguro', 'buri', 'zuwai', 'surume', 'madara', 'mizudako', 'hirame', 'ankou'] },
  { id: 'oga', name: '男鹿半島', text: '冬の雷とともにハタハタが押し寄せる秋田の海', stage: 2, cost: 30000, seconds: 600, lat: 39.9, lon: 139.7, opened: '2026-11-25', zone: 'cold', pool: ['hatahata', 'kurosoi', 'madara', 'hokke', 'ainame', 'mebaru', 'zuwai', 'surume', 'buri', 'sake', 'mizudako', 'karei'] },
  { id: 'palau', name: 'パラオ', text: '外洋の潮が当たるドロップオフと、タコクラゲの湖がある南の島', stage: 2, cost: 70000, seconds: 900, lat: 7.3, lon: 134.4, opened: '2026-11-25', zone: 'tropical', pool: ['nanyoumanta', 'nemuribuka', 'rouninaji', 'nishikiteguri', 'hanagoi', 'takokurage', 'gingame', 'tsumaguro', 'napoleon', 'kakure', 'hanahige', 'gomamongara', 'tsubame', 'hagi2', 'budai', 'mongara', 'nanyouhagi', 'harisenbon'] },
  { id: 'hawaii', name: 'ハワイ諸島', text: '太平洋のまんなかにある、固有種の多い火山島', stage: 3, cost: 150000, seconds: 1800, lat: 20.8, lon: -156.6, opened: '2026-11-25', zone: 'tropical', pool: ['hashinagairuka', 'fueyakko', 'nanyoumanta', 'kiirohagi', 'tsunodashi', 'aoumigame', 'itachizame', 'harisenbon', 'fuuraicho', 'togecho', 'hatatate'] },
  { id: 'maldives', name: 'モルディブ', text: 'ジンベエザメとマンタが集まるインド洋の環礁', stage: 3, cost: 200000, seconds: 1800, lat: 3.2, lon: 73.2, opened: '2026-11-25', zone: 'tropical', pool: ['nanyoumanta', 'nemuribuka', 'rouninaji', 'kumanomi', 'jinbei', 'tsumaguro', 'nanyouhagi', 'napoleon', 'hanahige', 'mongara', 'gomamongara', 'tsunodashi', 'kingyohana', 'aoumigame', 'hatatate'] },
  { id: 'redsea', name: '紅海', text: '砂漠の海岸に沿ってサンゴ礁が続く、塩分の濃い海', stage: 3, cost: 250000, seconds: 2400, lat: 27.2, lon: 34.0, opened: '2026-11-25', zone: 'tropical', pool: ['hirenagahagi', 'herayagara', 'hanamino', 'kingyohana', 'napoleon', 'tsunodashi', 'hammer', 'jinbei', 'manta', 'harisenbon', 'gomamongara', 'tsumaguro', 'deba', 'misuji', 'aoumigame'] },
  { id: 'mediterranean', name: '地中海', text: 'ヨーロッパとアフリカに囲まれた紺碧の内海', stage: 3, cost: 220000, seconds: 2400, lat: 37.5, lon: 15.3, opened: '2026-11-25', zone: 'temperate', pool: ['atlbluefin', 'madako', 'mola', 'akaumigame', 'bandou', 'mizukurage'] },
  { id: 'monterey', name: 'モントレー湾', text: 'ケルプの森とラッコが暮らすカリフォルニアの海', stage: 3, cost: 180000, seconds: 2400, lat: 36.8, lon: -121.9, opened: '2026-11-25', zone: 'temperate', pool: ['rakko', 'ashika', 'garibaldi', 'leopardshark', 'seanettle', 'mizukurage', 'mola', 'mizudako', 'kuromaguro'] },
  { id: 'caribbean', name: 'カリブ海', text: 'ブルーホールとマングローブが広がる暖かい海', stage: 3, cost: 300000, seconds: 3000, lat: 24.0, lon: -77.0, opened: '2026-11-25', zone: 'tropical', pool: ['queenangel', 'komorizame', 'oomejirozame', 'itachizame', 'hammer', 'madaraotobi', 'hanamino', 'aoumigame', 'akaumigame', 'bandou', 'bashou', 'shiira', 'harisenbon', 'jinbei'] },
  { id: 'amazon', name: 'アマゾン川', text: '世界最大の流域をもつ熱帯の大河。巨大な淡水魚が暮らす', stage: 3, cost: 350000, seconds: 3000, lat: -3.1, lon: -60.0, opened: '2026-11-25', zone: 'tropical', pool: ['arapaima', 'arowana', 'piranha', 'redtail', 'polkadot', 'denkiunagi'] },
];

/** 地図に出すのに必要な、捕れる魚種の数 */
export const MIN_POOL = 3;
