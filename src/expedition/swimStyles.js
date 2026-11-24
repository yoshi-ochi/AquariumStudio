/**
 * 魚種ごとの泳ぎ方（ひれの動かし方・周期・向き）。泳ぎのシェーダー（creatureBuilder.js）に渡す。
 *
 * 分類は Breder・Lindsey の泳法（体と尾びれで進む BCF／ひれだけで進む MPF）に合わせる。
 *   sub  亜鯵型（タイ・ハタなど）… 体の後ろ半分をくねらせ、尾びれで進む。胸びれで微調整
 *   car  鯵型（アジ・イワシなど）… 体の後ろ1/3だけをすばやく振る
 *   thu  マグロ型（カツオ・マグロ・カジキ）… 体はほぼ動かさず、細い尾柄と三日月形の尾びれだけを振る
 *   ang  ウナギ型 … 体全体に1波長以上の波を流す
 *   shark サメ … 亜鯵型に近く、胸びれは翼のように固定。大型ほどゆっくり
 *   lab  ベラ型（チョウチョウウオ・クマノミ・ブダイなど）… 胸びれを羽ばたかせて進み、尾はあまり使わない
 *   bal  モンガラカワハギ型 … 背びれと尻びれに波を流して進み、体は動かさない
 *   ost  ハコフグ型 … 体は固く、胸びれ・背びれ・尻びれを小刻みに動かす（実物は毎秒19〜41回、見た目は抑える）
 *   amii アミア型（リュウグウノツカイ・タチウオ）… 長い背びれに細かい波を流し、体はまっすぐ
 *   mola マンボウ … 背びれと尻びれを同じ側へそろえて羽ばたく（約0.4〜0.5回/秒）
 *   coel シーラカンス … 胸びれ・腹びれを左右交互に、第2背びれと尻びれを同時に振る
 *
 * 周期：体と尾で進む魚の尾びれの振動は、ストローハル数 0.25〜0.35 から「巡航で毎秒 体長×1〜2 進む」とき
 * 小さな魚ほど速い（およそ体長の-0.4乗）。マンタの胸びれは約0.3〜1回/秒、イルカの尾びれは0.5〜2.9回/秒。
 */
const STYLES = {
  //      freq(Hz) 基準体長  体の波の始まり 体の振れ 波の数  尾  正中びれ 振り方 波  胸   胸の動き 胸の周期倍
  sub: { f: 2.0, ref: 0.25, start: 0.25, body: 0.06, waves: 0.9, caudal: 0.05, median: 0.02, mMode: 0, mWaves: 1.5, pect: 0.05, pMode: 0, pMul: 1 },
  car: { f: 3.0, ref: 0.25, start: -0.1, body: 0.06, waves: 0.8, caudal: 0.06, median: 0.01, mMode: 0, mWaves: 1.2, pect: 0.02, pMode: 0, pMul: 1 },
  thu: { f: 2.2, ref: 0.5, start: -0.3, body: 0.05, waves: 0.7, caudal: 0.08, median: 0, mMode: 0, mWaves: 1, pect: 0, pMode: 0, pMul: 1 },
  ang: { f: 1.2, ref: 0.5, start: 0.6, body: 0.06, waves: 1.6, caudal: 0.02, median: 0.02, mMode: 0, mWaves: 2, pect: 0.03, pMode: 0, pMul: 1 },
  shark: { f: 1.0, ref: 1, start: 0.1, body: 0.07, waves: 0.8, caudal: 0.06, median: 0, mMode: 0, mWaves: 1, pect: 0, pMode: 0, pMul: 1 },
  lab: { f: 2.5, ref: 0.15, start: -0.2, body: 0.015, waves: 0.8, caudal: 0.02, median: 0.02, mMode: 0, mWaves: 1.5, pect: 0.12, pMode: 1, pMul: 1 },
  bal: { f: 2.0, ref: 0.3, start: -0.4, body: 0.005, waves: 0.5, caudal: 0.01, median: 0.09, mMode: 0, mWaves: 1.5, pect: 0.03, pMode: 0, pMul: 1 },
  ost: { f: 4.0, ref: 0.15, start: -0.45, body: 0, waves: 0.5, caudal: 0.02, median: 0.05, mMode: 1, mWaves: 1, pect: 0.08, pMode: 0, pMul: 1.5 },
  amii: { f: 1.5, ref: 1, start: -0.5, body: 0.005, waves: 0.5, caudal: 0.01, median: 0.08, mMode: 0, mWaves: 4, pect: 0.03, pMode: 0, pMul: 1 },
  mola: { f: 0.45, ref: 1.8, start: -0.5, body: 0, waves: 0.5, caudal: 0.02, median: 0.18, mMode: 1, mWaves: 1, pect: 0.04, pMode: 0, pMul: 1 },
  coel: { f: 0.5, ref: 1.8, start: -0.2, body: 0.01, waves: 0.6, caudal: 0.02, median: 0.07, mMode: 1, mWaves: 1, pect: 0.08, pMode: 2, pMul: 1 },
};

const FORM_STYLE = {
  perch: 'sub', grouper: 'sub', cod: 'sub', lump: 'sub', clown: 'lab', tang: 'lab', disc: 'lab', moorish: 'lab', bat: 'lab',
  hump: 'lab', barreleye: 'lab', box: 'ost', tuna: 'car', needle: 'car', dolphin: 'car', lancet: 'ang', eel: 'ang',
  ribbon: 'amii', mola: 'mola', shark: 'shark', hammer: 'shark', coelacanth: 'coel',
};

/** 体形だけでは決まらない種 */
const ID_STYLE = {
  // マグロ型（高速の外洋魚）
  katsuo: 'thu', kuromaguro: 'thu', bashou: 'thu', shiira: 'thu',
  atlbluefin: 'thu', rouninaji: 'thu',
  // 背びれ・尻びれで進む（ヘラヤガラ）、胸びれで漕ぐ（ニシキテグリ・スズメダイの仲間）
  herayagara: 'bal', nishikiteguri: 'lab', garibaldi: 'lab', hanagoi: 'lab',
  // デンキウナギは体をまっすぐ保ち、長い尻びれの波で前後に進む
  denkiunagi: 'amii',
  // モンガラカワハギ型（背びれと尻びれで進む）
  kawahagi: 'bal', umazura: 'bal', mongara: 'bal', murasame: 'bal', gomamongara: 'bal',
  // ハコフグ・フグ型
  hakofugu: 'ost', harisenbon: 'ost', torafugu: 'ost',
  // ウナギ型
  ookamiuo: 'ang', utsubo: 'ang', hanahige: 'ang',
};

/** 魚種の泳ぎ方。シェーダーの uniform（4成分×3）にそのまま渡す値 */
export function swimOf(c) {
  const s = STYLES[ID_STYLE[c.id] ?? FORM_STYLE[c.form] ?? 'sub'];
  // 小さな魚ほど速く振る（体長の-0.4乗）。見た目のちらつきを避けて 0.25〜6 回/秒に収める
  const f = Math.min(6, Math.max(0.25, s.f * (s.ref / Math.max(0.02, c.len)) ** 0.4));
  return {
    a: [f, s.start, s.body, s.waves],
    b: [s.caudal, s.median, s.mMode, s.mWaves],
    c: [s.pect, s.pMode, s.pMul, 0],
  };
}
