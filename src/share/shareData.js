import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * 水槽の共有：共有した時点の水槽の写し（形・見た目・水槽内のレイアウト・展示中の生き物）と、その詰め方。
 * 写しは gzip する。小さければ base64 の文字列で Supabase の shared_tanks.data に入れ（64KB まで）、
 * 大きければ（岩を削った水槽など）公開ストレージ share-img にファイル（<owner>/<id>.dat、2MB まで）で置く。
 */
export const SHARE_VERSION = 1;
export const MAX_BYTES = 65536; // 表に入れる大きさの上限（base64 の文字数）
export const MAX_FILE = 2 * 1024 * 1024; // ファイルに置く大きさの上限

/** 共有ページの URL。Cloudflare Worker があればそちら（リンクの絵が水槽ごとに出る）、無ければ閲覧ページを直接 */
export function shareUrl(id) {
  const base = import.meta.env.VITE_SHARE_BASE;
  if (base) return `${base.replace(/\/$/, '')}/t/${id}`;
  return new URL(`share.html?id=${id}`, location.origin + import.meta.env.BASE_URL).href;
}

/** 推測されにくい10文字の id（英数字） */
export function newShareId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map((n) => abc[n % abc.length]).join('');
}

export function snapshotTank(manager, tank) {
  const u = tank.userData;
  return {
    v: SHARE_VERSION,
    defId: u.defId,
    ...(u.name && { name: u.name }),
    ...(u.look && { look: u.look }),
    creatures: Object.fromEntries(Object.entries(u.creatures ?? {}).filter(([, n]) => n > 0)),
    contents: manager.dumpInterior(tank),
  };
}

const toB64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

export const gzipSnapshot = (snap) => gzipSync(strToU8(JSON.stringify(snap)), { level: 9 });
export const packSnapshot = (snap) => toB64(gzipSnapshot(snap));
export const gzToB64 = toB64;
export const unpackSnapshot = (data) => JSON.parse(strFromU8(gunzipSync(fromB64(data))));
export const unpackBytes = (bytes) => JSON.parse(strFromU8(gunzipSync(new Uint8Array(bytes))));
