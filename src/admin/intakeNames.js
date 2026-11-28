/**
 * 和名だけの仮登録で使う、和名の整え方と確かめ方（管理者ツールの「モデル待ち」タブと tools/species-add.mjs・species-pull.mjs が共有する）。
 * ほかのファイルを読み込まないので、Node からもそのまま使える。
 */

/** 和名をそろえる：全角・半角をそろえ、空白を除き、ひらがなをカタカナにする（「まだい」と「マダイ」を同じ種として扱う） */
export const normalizeName = (s) =>
  String(s ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

/** フォルダ名（reference/fish/<和名>/）に使える和名か */
export const validName = (n) => typeof n === 'string' && n.length >= 1 && n.length <= 30 && !/[\\/:*?"<>|.\x00-\x1f]/.test(n);

/** 総称（属・科・仲間のまとまり）に見える和名か。登録は受け付けるが、情報を補う段階で「作らない」と報告して止める */
export const isGenericName = (n) => /(の仲間|のなかま|の一種|類|属|亜?科|亜?目)$/.test(n);

/** 仮登録の種の id（species_intake.id）。情報を補うまでの仮の id で、c_ で始まる */
export const isProvisionalId = (id) => /^c_/.test(id);

/** 学名が「属名 種小名（＋亜種名）」の形か。sp.・spp. や属名だけは総称なので通さない */
export const validSci = (s) => typeof s === 'string' && /^[A-Z][a-z]+ [a-z][a-z-]+( [a-z][a-z-]+)?$/.test(s) && !/ (sp|spp|cf|aff)$/.test(s);
