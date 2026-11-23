// 展示生物・採取地・合同調査の定義（データのみ）。
// len は全長(m)、rarity はレア度（1〜4）、slots は水槽の収容枠の消費量、form は体形（creatureForms.js）、pat は模様。
// レア度はカードの背景色で表す（緑→青→紫→金）。捕れやすさ・繁殖時間・料理の値段・ランキングの点数を決める。

/** レア度（1〜4）。名前はカードの背景色 */
export const RARITY_LIST = [1, 2, 3, 4];
export const RARITY_NAME = { 1: '緑', 2: '青', 3: '紫', 4: '金' };
/** 採取で選ばれる重み（レア度ごと。管理者ツールで変更可） */
export const CATCH_WEIGHT = { 1: 60, 2: 30, 3: 10, 4: 5 };
/** 新種を初めて発見したときの報酬（円。レア度ごと。管理者ツールで変更可） */
export const DISCOVERY_REWARD = { 1: 5000, 2: 30000, 3: 200000, 4: 1000000 };

const c = (id, name, form, len, rarity, slots, appeal, body, belly, fin, extra = {}) => ({
  id, name, form, len, rarity, slots, appeal, colors: { body, belly, fin }, ...extra,
});

export const CREATURES = [
  // 相模湾
  c('mejina', 'メジナ', 'perch', 0.14, 1, 1, 0.4, 0x35505c, 0x8fa3a8, 0x24363f),
  c('kasago', 'カサゴ', 'grouper', 0.12, 1, 1, 0.5, 0xa8452f, 0xe2b08c, 0x7c2f22, { pat: 'mottle', mark: 0x6e2c20 }),
  c('hakofugu', 'ハコフグ', 'box', 0.09, 2, 1, 1.2, 0xe3c23f, 0xf3e6a0, 0xc99a2e, { pat: 'spots', mark: 0x20242a }),
  c('ishidai', 'イシダイ', 'disc', 0.18, 3, 2, 3, 0xd6d8cf, 0xeeeee6, 0x2d3338, { pat: 'bands', bands: 7, mark: 0x23282d }),
  // 慶良間
  c('kakure', 'カクレクマノミ', 'clown', 0.07, 1, 1, 0.8, 0xef7a1f, 0xf59a42, 0xe2701c, { pat: 'clown', mark: 0xffffff }),
  c('nanyouhagi', 'ナンヨウハギ', 'tang', 0.1, 1, 1, 0.9, 0x1f55c9, 0x2f6fe0, 0xf2d33c, { pat: 'palette', mark: 0x10182e }),
  c('chocho', 'チョウチョウウオ', 'disc', 0.11, 2, 1, 1.6, 0xf3d54a, 0xfaf0b4, 0xe0a92c, { pat: 'mask', mark: 0x2a2a2e }),
  c('tsunodashi', 'ツノダシ', 'moorish', 0.13, 3, 2, 3.5, 0xf5efd8, 0xffffff, 0xf0cf3e, { pat: 'bands', bands: 3, mark: 0x1f2226 }),
  // 小笠原
  c('maaji', 'マアジ', 'tuna', 0.2, 1, 2, 1.2, 0xd2b24a, 0xdcd8e0, 0xdcae34, { pat: 'lateral', mark: 0xd8c36a }),
  c('mizukurage', 'ミズクラゲ', 'jelly', 0.16, 1, 2, 1.6, 0xdbe8f5, 0xf5d9e6, 0xeaf2fa),
  c('shiira', 'シイラ', 'dolphin', 1.2, 2, 8, 6, 0x2fa58c, 0xe8d34e, 0x2467b0, { pat: 'spots', mark: 0x1d6f8a }),
  c('manta', 'オニイトマキエイ', 'ray', 4.5, 3, 24, 30, 0x27323d, 0xe9edf0, 0x1d262f),
  // 駿河湾
  c('kinmedai', 'キンメダイ', 'perch', 0.3, 1, 3, 3, 0xd83a2e, 0xf0a08a, 0xb32a22, { bigEye: true, iris: 0xf0c23c }),
  c('mizuuo', 'ミズウオ', 'lancet', 0.7, 1, 6, 4, 0x6c7b86, 0xb9c4cb, 0x3f4a53),
  c('mendako', 'メンダコ', 'dumbo', 0.15, 2, 2, 8, 0xd9674a, 0xeb9a7e, 0xc55238),
  c('ryugu', 'リュウグウノツカイ', 'ribbon', 3, 4, 30, 45, 0xdfe5ea, 0xf4f6f8, 0xd8323f, { pat: 'spots', mark: 0x8b98a5 }),
  // 三陸沖
  c('ainame', 'アイナメ', 'perch', 0.25, 1, 2, 1, 0x7b5a35, 0xc9b48c, 0x5a4227, { pat: 'mottle', mark: 0x4c3620 }),
  c('madara', 'マダラ', 'cod', 0.5, 1, 6, 2.5, 0x8a7a5c, 0xe6e0d0, 0x6a5d46, { pat: 'mottle', mark: 0x5a4d38 }),
  c('sanma', 'サンマ', 'needle', 0.3, 2, 2, 2, 0x31506f, 0xdfe7ec, 0x27405a, { pat: 'lateral', mark: 0x9fb4c4 }),
  c('mola', 'マンボウ', 'mola', 1.8, 3, 18, 22, 0x8d9aa3, 0xdfe5e8, 0x76838c),
  // オホーツク海
  c('hokke', 'ホッケ', 'perch', 0.3, 1, 3, 1.5, 0x6d7450, 0xd6d4b8, 0x4f5639, { pat: 'bands', bands: 5, mark: 0x4d5338 }),
  c('fuusen', 'フウセンウオ', 'lump', 0.06, 2, 1, 4, 0xd9583f, 0xf0a184, 0xc2452f),
  c('clione', 'クリオネ', 'clione', 0.03, 2, 1, 6, 0xe8f1f6, 0xf08a7a, 0xf4f9fc),
  c('ookamiuo', 'オオカミウオ', 'eel', 0.9, 3, 12, 16, 0x5c6168, 0xa6aab0, 0x44484e, { pat: 'bands', bands: 9, mark: 0x35383d }),
  // グレートバリアリーフ
  c('tsubame', 'ツバメウオ', 'bat', 0.3, 1, 3, 3, 0xc9c6b8, 0xe6e3d8, 0x3a3a38, { pat: 'bands', bands: 2, mark: 0x2c2c2a }),
  c('hagi2', 'ニシキヤッコ', 'disc', 0.18, 1, 2, 3.5, 0xe8a12d, 0xf2c75e, 0x1f4fa8, { pat: 'bands', bands: 6, mark: 0x2a60c0 }),
  c('tsumaguro', 'ツマグロ', 'shark', 1.5, 2, 20, 18, 0x8c969e, 0xeef1f2, 0x1b1e21, { tipFins: true }),
  c('napoleon', 'メガネモチノウオ', 'hump', 1.5, 3, 20, 28, 0x2f8f80, 0x6fc1ae, 0x246f8c, { pat: 'mask', mark: 0x1d5f6e }),
  // ガラパゴス
  c('gingame', 'ギンガメアジ', 'tuna', 0.5, 1, 6, 4, 0xa9b8c2, 0xeef2f4, 0x56646e, { bigEye: true }),
  c('kingangel', 'キングエンゼルフィッシュ', 'disc', 0.3, 2, 3, 9, 0x20345e, 0x2f4a80, 0xf0b52c, { pat: 'bands', bands: 1, mark: 0xf2f2ea }),
  c('galashark', 'ガラパゴスザメ', 'shark', 3, 2, 30, 32, 0x7a858c, 0xe6eaec, 0x667077),
  c('hammer', 'アカシュモクザメ', 'hammer', 3, 4, 36, 50, 0x858f94, 0xe8ecee, 0x70797e),
  // 水族館の定番（相模湾）
  c('madai', 'マダイ', 'perch', 0.4, 1, 3, 2.5, 0xd8606a, 0xf2c8c0, 0xc24a55, { pat: 'spots', mark: 0x4fa8d8 }),
  c('hirame', 'ヒラメ', 'flat', 0.5, 2, 4, 4, 0x7a6a4c, 0xf1eee4, 0x5a4c36),
  c('madako', 'マダコ', 'octopus', 0.5, 1, 3, 3, 0x9a5a48, 0xd9a08c, 0x86493a),
  c('iseebi', 'イセエビ', 'lobster', 0.25, 2, 2, 5, 0xa3392c, 0xd98a5c, 0x7c2a22),
  c('utsubo', 'ウツボ', 'eel', 0.7, 1, 5, 3, 0x6e5a32, 0xc9b98a, 0x54462a, { pat: 'mottle', mark: 0x3a2f1c }),
  c('tatsu', 'タツノオトシゴ', 'seahorse', 0.08, 2, 1, 4, 0xc9a24a, 0xe6cf8e, 0xe8d9a8),
  c('nekozame', 'ネコザメ', 'shark', 0.7, 2, 8, 7, 0x8a7a62, 0xe6dfd0, 0x6f614c, { pat: 'bands', bands: 6, mark: 0x4d4234 }),
  c('akaei', 'アカエイ', 'ray', 1, 2, 8, 6, 0x8a5a3a, 0xf0d8c0, 0x6f4730),
  // 三陸沖
  c('maiwashi', 'マイワシ', 'tuna', 0.18, 1, 1, 0.8, 0x46618f, 0xd6dbe4, 0x7d8894, { pat: 'lateral', mark: 0x1f2f40 }),
  c('katsuo', 'カツオ', 'tuna', 0.5, 1, 6, 4, 0x22304e, 0xcdd3da, 0x2a3040, { pat: 'bands', bands: 5, mark: 0x8fa9bd }),
  c('zuwai', 'ズワイガニ', 'crab', 0.4, 2, 3, 6, 0xc2603a, 0xeac9a8, 0xa84e2e, { longLegs: true }),
  c('surume', 'スルメイカ', 'squid', 0.3, 1, 2, 3, 0xb56a58, 0xe8c4b4, 0x98523f),
  c('ankou', 'アンコウ', 'lump', 0.6, 3, 8, 15, 0x5c5340, 0xbdb39a, 0x463f30, { pat: 'mottle', mark: 0x38322a }),
  c('mizudako', 'ミズダコ', 'octopus', 3, 2, 8, 10, 0xa84f3c, 0xdfa48e, 0x8c4031),
  // 慶良間諸島
  c('chinanago', 'チンアナゴ', 'garden', 0.35, 1, 1, 2.5, 0xe8e2cc, 0xf6f2e4, 0x2a2a2a),
  c('deba', 'デバスズメダイ', 'clown', 0.07, 1, 1, 0.7, 0x5fd0c4, 0x9be6dc, 0x46b0a6),
  c('hanamino', 'ハナミノカサゴ', 'moorish', 0.28, 2, 2, 5, 0xc4583e, 0xf0dcc8, 0xa84630, { pat: 'bands', bands: 7, mark: 0xf4ece0 }),
  c('otohime', 'オトヒメエビ', 'lobster', 0.07, 2, 1, 3, 0xf0ece0, 0xffffff, 0xc23a3a),
  c('budai', 'アオブダイ', 'hump', 0.5, 2, 5, 6, 0x2f7fb0, 0x6fb6d0, 0x24648c),
  // オホーツク海
  c('taraba', 'タラバガニ', 'crab', 1, 2, 6, 9, 0xa8452f, 0xe0b090, 0x8c3724, { longLegs: true }),
  c('kegani', 'ケガニ', 'crab', 0.2, 1, 2, 3, 0xa8603c, 0xe0bc94, 0x8c4e30),
  c('sake', 'シロザケ', 'tuna', 0.7, 1, 8, 5, 0x6f8494, 0xe6ecef, 0x566878),
  c('nishin', 'ニシン', 'tuna', 0.3, 1, 3, 2, 0x3f6480, 0xe6edf1, 0x34526a),
  // 小笠原諸島
  c('kuromaguro', 'クロマグロ', 'tuna', 2, 4, 40, 80, 0x1f3350, 0xdfe6ea, 0x23364f),
  c('buri', 'ブリ', 'tuna', 0.8, 1, 10, 6, 0x4a6f8a, 0xe6edf0, 0xd8c04a, { pat: 'lateral', mark: 0xd8c04a }),
  c('jinbei', 'ジンベエザメ', 'shark', 10, 4, 60, 200, 0x3f5468, 0xe6ebee, 0x34475a, { pat: 'spots', mark: 0xeef2f4, plankton: true }),
  // グレートバリアリーフ
  c('tamakai', 'タマカイ', 'grouper', 2.3, 4, 30, 35, 0x5e6048, 0xb9b794, 0x4a4c38, { pat: 'mottle', mark: 0x2f3024 }),
  c('hanahige', 'ハナヒゲウツボ', 'eel', 0.9, 2, 6, 7, 0x2747b8, 0xf0dc4a, 0xf0dc4a),
  // 駿河湾の深海
  c('takaashi', 'タカアシガニ', 'crab', 3, 2, 15, 20, 0xc4623e, 0xefd0b0, 0xe0a070, { longLegs: true }),
  c('ogusoku', 'オオグソクムシ', 'lobster', 0.35, 2, 3, 9, 0xb9b3a2, 0xdcd6c6, 0x98927f),
  c('sakuraebi', 'サクラエビ', 'lobster', 0.05, 1, 1, 1.5, 0xf08a8a, 0xf9c4c4, 0xe06c6c),
  c('tachiuo', 'タチウオ', 'ribbon', 1, 1, 8, 5, 0xdfe6ea, 0xf4f7f8, 0xbfd0d8),
  // ガラパゴス諸島
  c('madaraotobi', 'マダラトビエイ', 'ray', 2, 2, 15, 14, 0x2a3442, 0xeef1f3, 0x1e2632),
  // 合同調査の限定種
  c('seela', 'シーラカンス', 'coelacanth', 1.8, 4, 28, 70, 0x2b4a6e, 0x6f8ba8, 0x223c5a, { pat: 'spots', mark: 0xd8e2ea }),
  c('demenigisu', 'デメニギス', 'barreleye', 0.15, 4, 3, 40, 0x2c2c33, 0x4a4a55, 0x1e1e24, { bigEye: true, iris: 0x7cf0a8 }),
  c('daiou', 'ダイオウイカ', 'squid', 10, 4, 40, 110, 0xa23d33, 0xd98a78, 0x852f28),
  c('koori', 'コオリウオ', 'cod', 0.45, 4, 8, 60, 0xd5e4ea, 0xf2f8fa, 0xbdd2da, { bigEye: true }),
  c('greenland', 'ニシオンデンザメ', 'shark', 4, 4, 50, 150, 0x4a4f50, 0x77807f, 0x3a3f40),
  c('harisenbon', 'ハリセンボン', 'box', 0.25, 2, 2, 5, 0xc9a878, 0xe0e4e8, 0xe8d878, { pat: 'spots', mark: 0x3a3428 }),
  c('bashou', 'バショウカジキ', 'tuna', 2.7, 4, 40, 90, 0x1d3568, 0xe4e8ec, 0x16254a),
  c('suzuki', 'スズキ', 'perch', 0.6, 1, 6, 3, 0x6f8062, 0xd4dae0, 0x9aa088),
  c('karei', 'カレイ', 'flat', 0.35, 1, 3, 3, 0x8a6238, 0xf3efe4, 0x6a4a30),
  c('nokogiri', 'ノコギリザメ', 'shark', 1.2, 3, 20, 30, 0x8a8274, 0xe6dcd4, 0x7a7468),
  c('chochin', 'チョウチンアンコウ', 'lump', 0.4, 4, 6, 50, 0x3a3640, 0x55505c, 0x2a2730),
  c('kurodai', 'クロダイ', 'perch', 0.4, 1, 3, 2.5, 0x4a5058, 0xc6cace, 0x2a2e34),
  c('mebaru', 'メバル', 'perch', 0.25, 1, 2, 1.8, 0x8a6a44, 0xe2d4b8, 0x6e5a40, { bigEye: true }),
  c('akahata', 'アカハタ', 'grouper', 0.3, 1, 2, 2.5, 0xd8603a, 0xf0b088, 0xe07a3a, { pat: 'bands', bands: 5, mark: 0xb8402e }),
  c('kawahagi', 'カワハギ', 'perch', 0.25, 1, 2, 2, 0x9a8a70, 0xd8ccb4, 0xd8c8b0, { pat: 'mottle', mark: 0x4a4036 }),
  c('umazura', 'ウマヅラハギ', 'perch', 0.3, 1, 2, 1.8, 0x7a8288, 0xc8ccd0, 0x7a9a98),
  c('torafugu', 'トラフグ', 'box', 0.5, 2, 4, 5, 0x2e3436, 0xeeeeea, 0x1e2226, { pat: 'spots', mark: 0x101214 }),
  c('hatatate', 'ハタタテダイ', 'moorish', 0.2, 2, 2, 3, 0xf2f0ea, 0xffffff, 0xe8c838, { pat: 'bands', bands: 2, mark: 0x141414 }),
  c('misuji', 'ミスジリュウキュウスズメダイ', 'clown', 0.08, 1, 1, 1, 0xf2f2f0, 0xffffff, 0x141414, { pat: 'bands', bands: 3, mark: 0x141414 }),
  c('nizadai', 'ニザダイ', 'disc', 0.4, 1, 3, 2.2, 0x7a6a60, 0x9a8a80, 0x4a3e3a),
  c('kiirohagi', 'キイロハギ', 'disc', 0.18, 2, 1, 3, 0xf0e030, 0xf4e848, 0xe0d82c),
  c('kagokaki', 'カゴカキダイ', 'disc', 0.15, 1, 1, 2, 0xf0e070, 0xf2e888, 0x141414, { pat: 'stripes', mark: 0x141414 }),
  c('nenbutsu', 'ネンブツダイ', 'perch', 0.1, 1, 1, 1, 0xf09a80, 0xf0d8d0, 0xf49a88),
  c('houbou', 'ホウボウ', 'perch', 0.35, 2, 3, 3, 0xc86450, 0xe8d0c8, 0xe8a090),
  c('gonzui', 'ゴンズイ', 'perch', 0.2, 1, 1, 1.5, 0x3a3226, 0xd8d0c0, 0x5a4c3c, { pat: 'stripes', mark: 0xf0e0a0 }),
  c('oniokoze', 'オニオコゼ', 'grouper', 0.2, 2, 2, 3, 0x5a4c3e, 0x8a7a68, 0x4a3e32, { pat: 'mottle', mark: 0x3a3028 }),
  c('nishikianago', 'ニシキアナゴ', 'garden', 0.35, 2, 1, 3, 0xe89a30, 0xeaa040, 0xf4f0ea, { ringBands: true }),
  c('rurisuzume', 'ルリスズメダイ', 'clown', 0.07, 1, 1, 1, 0x5ac8e8, 0x9adcf0, 0x3a8ac8),
  c('kingyohana', 'キンギョハナダイ', 'perch', 0.12, 1, 1, 1.5, 0xe8904a, 0xe8d0d8, 0xe8b8a8),
  c('gomamongara', 'ゴマモンガラ', 'perch', 0.7, 2, 5, 4, 0x6a6050, 0xb8b4ac, 0xe0dcb0),
  c('murasame', 'ムラサメモンガラ', 'perch', 0.3, 2, 2, 3, 0x8a8460, 0xe8ecf0, 0xf0e4e0),
  c('mongara', 'モンガラカワハギ', 'perch', 0.4, 3, 3, 5, 0x14182a, 0xf0e0e4, 0x2a2c40, { pat: 'spots', mark: 0xf0e0e4 }),
  c('yashahaze', 'ヤシャハゼ', 'perch', 0.06, 2, 1, 2, 0xf2f2f4, 0xf2f2f4, 0xe8ecf4, { pat: 'stripes', mark: 0xe86a28 }),
  c('akebono', 'アケボノチョウチョウウオ', 'disc', 0.15, 2, 1, 2.5, 0xeceeec, 0xf4f4f0, 0xf0c020, { pat: 'mask', mark: 0x141414 }),
  c('shimayakko', 'シマヤッコ', 'disc', 0.11, 2, 1, 2.5, 0xf2f0ec, 0xf8f4e8, 0xf0b830, { pat: 'bands', bands: 8, mark: 0x18140f }),
  c('adeyakko', 'アデヤッコ', 'disc', 0.35, 3, 3, 5, 0xe8c838, 0xe8b830, 0xf0b820),
  c('tobiuo', 'トビウオ', 'perch', 0.3, 1, 2, 2, 0x2a4a6a, 0xe0e4e8, 0x9aa8b8),
  c('akamanbou', 'アカマンボウ', 'disc', 1.2, 3, 10, 10, 0x8a9ab0, 0xc8ccd8, 0xe04a28, { pat: 'spots', mark: 0xf0f4f8 }),
  c('shirowani', 'シロワニ', 'shark', 2.5, 3, 10, 25, 0x9a9890, 0xd8d8d4, 0x8a8a88, { pat: 'spots', mark: 0x8a5a3a }),
  c('itachizame', 'イタチザメ', 'shark', 3.5, 3, 10, 30, 0xb8a080, 0xe4e6e8, 0xa89070, { pat: 'stripes', mark: 0x6a5a40 }),
  c('rabuka', 'ラブカ', 'shark', 1.5, 3, 8, 30, 0x8a8478, 0xb0a898, 0x8a8478),
  c('kouika', 'コウイカ', 'cuttle', 0.25, 1, 2, 2.5, 0x7a5a3a, 0xe8e4dc, 0xd8ccb8, { mark: 0x5a3a22 }),
  c('akakurage', 'アカクラゲ', 'jelly', 0.2, 2, 2, 2.5, 0xf0c8c0, 0xf4d8d0, 0xe8c8d0, { jelly: { height: 0.62, stripes: { n: 16, hex: 0xa82818 }, oral: { n: 4, len: 1.1, width: 0.09, hex: 0xf0dcd8 }, tents: { n: 24, len: 1.4, hex: 0xe8c8d0 } } }),
  c('takokurage', 'タコクラゲ', 'jelly', 0.15, 2, 2, 2.5, 0xe8c8a8, 0xf0dcc4, 0xd8c8a8, { jelly: { height: 0.5, spots: 0xfaf6ee, oral: { n: 8, len: 0.36, width: 0.06, hex: 0xf0e8dc, club: true }, filaments: { n: 8, len: 0.9, hex: 0xd8c8a8 }, opacity: 0.88 } }),
  c('seanettle', 'パシフィックシーネットル', 'jelly', 0.3, 2, 3, 3, 0xe0a840, 0xe8c070, 0xa04020, { jelly: { height: 0.36, stripes: { n: 16, hex: 0xc88a30 }, oral: { n: 4, len: 1.0, width: 0.12, hex: 0xf4e8cc }, tents: { n: 24, len: 1.6, hex: 0xa04020 } } }),
  c('bluejelly', 'ブルージェリー', 'jelly', 0.25, 2, 2, 2.5, 0x8ab8e8, 0xa8c8f0, 0xd8d8e0, { jelly: { height: 0.5, oral: { n: 8, len: 0.48, width: 0.07, hex: 0xd8d8e0, club: true }, opacity: 0.85 } }),
  c('kabutogani', 'カブトガニ', 'horseshoe', 0.5, 3, 3, 6, 0x6e6044, 0xa89870, 0x5a4030, { mark: 0x8e7e58 }),
  c('kijihata', 'キジハタ', 'grouper', 0.3, 2, 2, 4, 0xa23c1c, 0xcf8236, 0x8a3c1a, { pat: 'spots', mark: 0xe8402e }),
  c('takanoha', 'タカノハダイ', 'perch', 0.3, 1, 2, 1.5, 0x948e86, 0xd2cec6, 0xe8822a, { pat: 'stripes', mark: 0x7a5232 }),
  c('akaumigame', 'アカウミガメ', 'turtle', 0.9, 3, 8, 30, 0x6a3a26, 0xe6d4a0, 0x4a4630),
  c('aoumigame', 'アオウミガメ', 'turtle', 1, 4, 8, 30, 0x5a4a38, 0xe8dcae, 0x3a3028),
  c('bandou', 'バンドウイルカ', 'whale', 2.8, 4, 10, 70, 0x5a6270, 0xe8eaee, 0x4e5664),
  c('shiroiruka', 'シロイルカ', 'whale', 4, 4, 10, 90, 0xecebe3, 0xf2f1ea, 0xe4e2d8),
  c('togecho', 'トゲチョウチョウウオ', 'disc', 0.2, 2, 1, 2.4, 0xf2f0ea, 0xf4f2ee, 0xe8a030, { pat: 'mask', mark: 0x2e2a28 }),
  c('fuuraicho', 'フウライチョウチョウウオ', 'disc', 0.18, 2, 1, 2.4, 0xece8e0, 0xf2f0ea, 0xe8b830, { pat: 'mask', mark: 0x1a1a24 }),
];

/**
 * 水槽の収容枠の消費量（1〜10）。体長から決め、群れで泳ぐ小魚は1枠。
 * 最小の30cm水槽（10枠）にクリオネが10匹、大水槽にはイワシが数百匹入る目安。
 */
const SCHOOLING = new Set(['maiwashi', 'sanma', 'nishin', 'maaji', 'sakuraebi', 'deba', 'kakure', 'clione', 'mizukurage', 'chinanago']);
export const slotFor = (c) => (SCHOOLING.has(c.id) || c.school ? 1 : Math.min(10, Math.max(1, Math.round((c.len / 0.2) ** 1.3))));

/** 収容枠を計算し直し、レア度を 1〜4 に収める（管理者の設定で体長・レア度が変わったとき） */
export function recomputeDerived() {
  for (const c of CREATURES) {
    c.slots = slotFor(c);
    c.rarity = Math.min(4, Math.max(1, Math.round(c.rarity) || 1));
  }
}
recomputeDerived();

export const getCreature = (id) => CREATURES.find((x) => x.id === id);
/** 図鑑・採取の対象になっている魚種（管理者が削除した魚種を除く） */
export const activeCreatures = () => CREATURES.filter((c) => !c.retired);

// ---- 季節（日本の暦：春3〜5月・夏6〜8月・秋9〜11月・冬12〜2月） ------------------
export const SEASONS = ['春', '夏', '秋', '冬'];
export const seasonOf = (time = Date.now()) => Math.floor(((new Date(time).getMonth() + 10) % 12) / 3);
/** c.seasons（0〜3 の配列）が無ければ一年中捕れる */
export const inSeason = (c, time = Date.now()) => !c?.seasons?.length || c.seasons.includes(seasonOf(time));

export const DESTINATIONS = [
  { id: 'iso', name: '相模湾', text: '黒潮が寄せる、はじめての採取地', stage: 1, cost: 3000, seconds: 60, lat: 35.1, lon: 139.4, pool: ['akaumigame', 'takanoha', 'kijihata', 'kabutogani', 'akakurage', 'kouika', 'oniokoze', 'gonzui', 'houbou', 'nenbutsu', 'kagokaki', 'nizadai', 'torafugu', 'kawahagi', 'mebaru', 'kurodai', 'suzuki', 'mejina', 'kasago', 'hakofugu', 'ishidai', 'madai', 'hirame', 'madako', 'iseebi', 'utsubo', 'tatsu', 'nekozame', 'akaei'] },
  { id: 'sanriku', name: '三陸沖', text: '親潮と黒潮がぶつかる豊かな漁場', stage: 1, cost: 8000, seconds: 120, lat: 39.4, lon: 142.6, pool: ['umazura', 'karei', 'ainame', 'madara', 'sanma', 'mola', 'maiwashi', 'katsuo', 'zuwai', 'surume', 'ankou', 'mizudako'] },
  { id: 'reef', name: '慶良間諸島', text: '色あざやかな熱帯魚が暮らすサンゴ礁', stage: 1, cost: 12000, seconds: 180, lat: 26.2, lon: 127.3, pool: ['fuuraicho', 'togecho', 'takokurage', 'shimayakko', 'akebono', 'yashahaze', 'mongara', 'murasame', 'kingyohana', 'rurisuzume', 'nishikianago', 'kiirohagi', 'misuji', 'hatatate', 'akahata', 'harisenbon', 'kakure', 'nanyouhagi', 'chocho', 'tsunodashi', 'chinanago', 'deba', 'hanamino', 'otohime', 'budai'] },
  { id: 'okhotsk', name: 'オホーツク海', text: '流氷の下で暮らす冷たい海の生き物', stage: 2, cost: 30000, seconds: 300, lat: 44.7, lon: 145.6, pool: ['shiroiruka', 'hokke', 'fuusen', 'clione', 'ookamiuo', 'taraba', 'kegani', 'sake', 'nishin'] },
  { id: 'ocean', name: '小笠原諸島', text: '大型の回遊魚に出会える外洋', stage: 2, cost: 60000, seconds: 600, lat: 27.1, lon: 142.2, pool: ['bandou', 'aoumigame', 'seanettle', 'bluejelly', 'shirowani', 'akamanbou', 'tobiuo', 'bashou', 'maaji', 'mizukurage', 'shiira', 'manta', 'kuromaguro', 'buri', 'jinbei'] },
  { id: 'gbr', name: 'グレートバリアリーフ', text: '世界最大のサンゴ礁', stage: 2, cost: 80000, seconds: 900, lat: -18.3, lon: 147.7, pool: ['adeyakko', 'gomamongara', 'tsubame', 'hagi2', 'tsumaguro', 'napoleon', 'tamakai', 'hanahige'] },
  { id: 'deep', name: '駿河湾の深海', text: '日本一深い湾に潜む珍しい生き物', stage: 3, cost: 300000, seconds: 1800, lat: 33.9, lon: 137.9, pool: ['rabuka', 'chochin', 'nokogiri', 'kinmedai', 'mizuuo', 'mendako', 'ryugu', 'takaashi', 'ogusoku', 'sakuraebi', 'tachiuo'] },
  { id: 'galapagos', name: 'ガラパゴス諸島', text: '大型のサメが群れる絶海の孤島', stage: 3, cost: 500000, seconds: 2400, lat: -0.7, lon: -90.6, pool: ['itachizame', 'gingame', 'kingangel', 'galashark', 'hammer', 'madaraotobi'] },
];

/** 管理者が削除した採取地（航海中の隊が帰れるように残す） */
export const RETIRED_PLACES = [];
export const getDestination = (id) => DESTINATIONS.find((d) => d.id === id) ?? RETIRED_PLACES.find((d) => d.id === id);

/** 立地を指定していないときの基準地（東京） */
export const DEFAULT_HOME = { lat: 35.7, lon: 139.8 };

/** 2地点の距離(km) */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** 立地の移転費用（最初の設定は無料）。水族館の規模（Lv）の2乗で増える：Lv1 2000万円〜Lv4 3.2億円 */
export const relocateCost = (level) => 20_000_000 * level ** 2;

/**
 * 遠征の所要時間（秒）は立地からの距離だけで決まる（採取地・漁法によらない）。
 * 100km で5分、5000km で2時間、10000km で3時間。その間は直線で補い、10000km より先も同じ傾きで伸ばす。
 */
const TIME_BY_KM = [[0, 120], [100, 300], [5000, 7200], [10000, 10800]];
export function travelSeconds(km) {
  const pts = TIME_BY_KM;
  let i = 1;
  while (i < pts.length - 1 && km > pts[i][0]) i++;
  const [k0, t0] = pts[i - 1];
  const [k1, t1] = pts[i];
  return Math.round(t0 + ((t1 - t0) * (km - k0)) / (k1 - k0));
}

/** 立地からの距離で費用（地球の反対側で最大3倍）と時間が増える */
export function travelPlan(dest, home) {
  const km = distanceKm(home ?? DEFAULT_HOME, dest);
  const k = 1 + Math.min(km, 12000) / 6000;
  return { km: Math.round(km), cost: Math.round(dest.cost * k), seconds: travelSeconds(km) };
}

// ---- 同盟の合同調査（費用・必要レベルは supabase/alliance.sql と同じ値） ----------
export const JOINT_PROJECTS = [
  { id: 'ship', name: '調査船の共同運航', text: '調査船を共同で運航し、外洋の深みを調べます', cost: 5000000, level: 1, hours: 1, pool: ['seela', 'demenigisu'] },
  { id: 'rov', name: 'ROV深海調査', text: '無人潜水機 ROV を共同所有し、超深海へ潜ります', cost: 20000000, level: 2, hours: 3, pool: ['demenigisu', 'daiou', 'seela'] },
  { id: 'polar', name: '極地探検', text: '砕氷船で北極と南極の海へ遠征します', cost: 80000000, level: 3, hours: 12, pool: ['koori', 'greenland', 'daiou'] },
];

/** 同盟レベル（最大10）。各レベルに必要な累計の貢献（xp）。データベースの alliance_level と同じ値 */
export const ALLIANCE_XP = [0, 100, 500, 2000, 5000, 12000, 25000, 50000, 100000, 200000];
export const ALLIANCE_MAX = ALLIANCE_XP.length;
export const allianceLevel = (xp) => ALLIANCE_XP.filter((need) => xp >= need).length;
/** 次のレベルに必要な累計の貢献（最大レベルでは無し） */
export const ALLIANCE_NEXT_XP = Object.fromEntries(ALLIANCE_XP.slice(1).map((need, i) => [i + 1, need]));
/** 同盟に入っている間の来館者ボーナス（Lv1で+5%、1Lvごとに+3%） */
export const allianceBonus = (level) => 1.02 + level * 0.03;
