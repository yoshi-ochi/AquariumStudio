import { ANATOMY } from '../expedition/creatureAnatomy.js';
import { CREATURES } from '../expedition/creatureData.js';
import { ALL_DEFS } from '../tanks/tankData.js';
import { loadMany, saveMany } from '../water/waveCache.js';

/**
 * 配信サムネイル（GitHub Pages の public/thumbs/ に置いた WebP）。
 * 起動時は manifest.json と照らし合わせ、形のデータが変わっていない物は配信画像の URL を使う。
 * 無い物・データが変わった物だけ端末で撮影する（追加直後でも表示が欠けない）。
 * 画像の作り直し：開発中に tools/thumbs/bakeThumbs.js を実行する。
 */
export const THUMB_REV = 1; // 撮り方や形を作るコードを変えたら上げる（全部の画像を作り直す合図）

const base = `${import.meta.env.BASE_URL}thumbs/`;

/** 文字列の短いハッシュ（FNV-1a） */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// 形のデータは組み立て時に展開・追記されることがあるので、読み込んだ直後の内容で版を決める
const anatomyAtLoad = new Map(Object.entries(ANATOMY).map(([id, v]) => [id, JSON.stringify(v)]));
const defAtLoad = new Map([...ALL_DEFS.map((d) => [`d:${d.id}`, JSON.stringify(d)]), ...CREATURES.map((c) => [`c:${c.id}`, JSON.stringify(c)])]);

/** 定義の中身から作る版。kind: 'd'（水槽・オブジェ）/ 'c'（生き物） */
export const thumbKey = (kind, def) => {
  const body = defAtLoad.get(`${kind}:${def.id}`) ?? JSON.stringify(def);
  // 生き物は背景を透明にして撮る（版に含める）
  return hash(`${THUMB_REV}|${body}|${kind === 'c' ? `alpha|${anatomyAtLoad.get(def.id) ?? 'null'}` : ''}`);
};
export const thumbFile = (kind, id) => `${kind}_${id}.webp`;

export async function loadThumbManifest() {
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** 端末で撮った画像の保存先の key（形のデータが変われば key も変わるので、古い画像は使われない） */
const shotKey = (kind, def) => `thumb:${kind}:${def.id}:${thumbKey(kind, def)}`;

/** 端末に保存してある撮影済みの画像を使い、まだ無い物だけを返す { cached: Map(id → dataURL), rest: [def] } */
export async function takeCachedShots(kind, defs) {
  const found = await loadMany(defs.map((d) => shotKey(kind, d)));
  const cached = new Map();
  const rest = [];
  for (const d of defs) {
    const url = found.get(shotKey(kind, d));
    if (typeof url === 'string') cached.set(d.id, url);
    else rest.push(d);
  }
  return { cached, rest };
}

/** 撮った画像を端末に保存する（次の起動から撮り直さない） */
export const keepShots = (kind, defs, shots) => saveMany(defs.filter((d) => shots.has(d.id)).map((d) => [shotKey(kind, d), shots.get(d.id)]));

/** 配信画像を使える物（URL）と、端末で撮影する物に分ける */
export function splitThumbs(kind, defs, manifest) {
  const urls = new Map();
  const missing = [];
  for (const def of defs) {
    const key = thumbKey(kind, def);
    if (manifest?.[kind]?.[def.id] === key) urls.set(def.id, `${base}${thumbFile(kind, def.id)}?v=${key}`);
    else missing.push(def);
  }
  return { urls, missing };
}
