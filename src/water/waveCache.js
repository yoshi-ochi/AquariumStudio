/**
 * ベイク済み水面データを IndexedDB に保存し、次回起動時は計算を省略する。
 * IndexedDB が使えない環境（プライベートモード等）では常に null / 何もしないで動く。
 */
const DB_NAME = 'aquarium-cache';
const STORE = 'blobs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadCached(key) {
  try {
    const buf = await withStore('readonly', (s) => s.get(key));
    return buf ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

export async function saveCached(key, data) {
  try {
    await withStore('readwrite', (s) => s.put(data.buffer, key));
  } catch {
    /* キャッシュできなくても動作には影響しない */
  }
}

/** 文字列などをまとめて読む（1回の取引で）。見つからない key は Map に入らない */
export async function loadMany(keys) {
  const out = new Map();
  if (!keys.length) return out;
  try {
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        for (const k of keys) {
          const req = store.get(k);
          req.onsuccess = () => req.result != null && out.set(k, req.result);
        }
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* 読めなくても動作には影響しない */
  }
  return out;
}

/** まとめて書く（[key, value] の配列） */
export async function saveMany(entries) {
  if (!entries.length) return;
  try {
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const [k, v] of entries) store.put(v, k);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* 保存できなくても動作には影響しない */
  }
}

/** 配信している計算済みの水面データ（public/waves/<key>.bin）。無ければ null（端末で計算する） */
export async function loadShipped(key) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}waves/${key}.bin`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
