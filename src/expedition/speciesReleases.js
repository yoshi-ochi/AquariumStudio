/** 最初から居る魚種（新種としては案内しない） */
export const INITIAL = [
  'mejina', 'kasago', 'hakofugu', 'ishidai', 'kakure', 'nanyouhagi', 'tsunodashi', 'maaji', 'mizukurage', 'shiira', 'manta', 'kinmedai',
  'mizuuo', 'mendako', 'ryugu', 'ainame', 'madara', 'sanma', 'mola', 'hokke', 'fuusen', 'clione', 'ookamiuo', 'tsubame', 'hagi2', 'tsumaguro',
  'napoleon', 'gingame', 'kingangel', 'galashark', 'hammer', 'seela', 'demenigisu', 'daiou', 'greenland', 'madai', 'hirame', 'madako',
  'iseebi', 'utsubo', 'tatsu', 'nekozame', 'akaei', 'maiwashi', 'katsuo', 'zuwai', 'surume', 'ankou', 'mizudako', 'chinanago', 'deba', 'hanamino',
  'otohime', 'budai', 'taraba', 'kegani', 'sake', 'nishin', 'kuromaguro', 'buri', 'jinbei', 'tamakai', 'hanahige', 'takaashi', 'ogusoku', 'sakuraebi',
  'tachiuo', 'madaraotobi', 'harisenbon', 'bashou', 'suzuki', 'nokogiri', 'chochin',
];

/**
 * 魚種の公開日（id → 'YYYY-MM-DD'）。ログイン時の「新しく追加された魚種」の並び順と表示に使う。
 * モデルを作って追加したら `npm run species:release` で今日の日付が書き足される（tools/species-release.mjs）。
 * ここに無い種も、前回ログイン時に無かったものは新種として案内される（日付は表示しない）。
 */
export const RELEASES = {
  // 2026-11-19 第1弾
  kurodai: '2026-11-19', akahata: '2026-11-19', kawahagi: '2026-11-19', umazura: '2026-11-19', torafugu: '2026-11-19',
  hatatate: '2026-11-19', misuji: '2026-11-19', nizadai: '2026-11-19', kiirohagi: '2026-11-19', kagokaki: '2026-11-19', nenbutsu: '2026-11-19',
  houbou: '2026-11-19', gonzui: '2026-11-19', oniokoze: '2026-11-19', nishikianago: '2026-11-19',
  // 2026-11-20 第2弾
  rurisuzume: '2026-11-20', kingyohana: '2026-11-20', gomamongara: '2026-11-20', murasame: '2026-11-20', mongara: '2026-11-20', yashahaze: '2026-11-20',
  akebono: '2026-11-20', shimayakko: '2026-11-20', adeyakko: '2026-11-20', tobiuo: '2026-11-20', akamanbou: '2026-11-20', shirowani: '2026-11-20',
  itachizame: '2026-11-20', rabuka: '2026-11-20', kouika: '2026-11-20', akakurage: '2026-11-20', takokurage: '2026-11-20', seanettle: '2026-11-20',
  bluejelly: '2026-11-20', kabutogani: '2026-11-20', kijihata: '2026-11-20', takanoha: '2026-11-20', akaumigame: '2026-11-20', aoumigame: '2026-11-20',
  bandou: '2026-11-20', shiroiruka: '2026-11-20', togecho: '2026-11-20', fuuraicho: '2026-11-20',
  // 2026-11-26
  shiroebi: '2026-11-26',
  hatahata: '2026-11-26',
  nodoguro: '2026-11-26',
  rouninaji: '2026-11-26',
  fueyakko: '2026-11-26',
  // 2026-11-26
  arapaima: '2026-11-26',
};
