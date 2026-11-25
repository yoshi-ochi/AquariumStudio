import { CREATURES, DESTINATIONS, JOINT_PROJECTS, CATCH_WEIGHT, DISCOVERY_REWARD, RARITY_LIST, RETIRED_PLACES, recomputeDerived } from './creatureData.js';
import { SPECIES_METHODS } from './fishingData.js';
import { NOTES } from './creatureNotes.js';
import { PIECE_FISH, BASE_PIECE_FISH, rebuildGrowth } from './growth.js';

/**
 * 管理者が編集する生物の設定（Supabase の game_config 表、key = 'creatures'）。
 * 起動時に読み込み、組み込みのデータ（creatureData.js など）へ上書きする。何度反映しても同じ結果になる。
 *
 * {
 *   species: { [id]: { name, rarity, len, appeal, zone, seasons, methods, note, removed, swim, beh } },
 *     swim … ひれ・泳ぎの上書き（swimStyles.js の style と SWIM_KEYS）、beh … 行動の上書き（behaviorData.js の BEH_KEYS）
 *   added:   [{ id, name, form, len, rarity, appeal, colors: { body, belly, fin }, pat, mark, zone, seasons, methods, note }],
 *   places:  { [id]: { name, text, stage, cost, lat, lon, zone, pool, removed } },
 *   addedPlaces: [{ id, name, text, stage, cost, lat, lon, zone, pool }],
 *   joint:   { [id]: { pool } },
 *   rarity:  { weight: { 1〜4 }, reward: { 1〜4 } }（レア度ごとの採取の重みと、新種発見の報酬）
 *   growth:  { pieceFish: [6] }（8角星形ごとの1ピースの匹数）
 * }
 */
export const CONFIG_KEY = 'creatures';
const CACHE = 'aq-creature-config';
const SPECIES_KEYS = ['name', 'rarity', 'len', 'appeal', 'zone', 'seasons', 'swim', 'beh'];
const PLACE_KEYS = ['name', 'text', 'stage', 'cost', 'lat', 'lon', 'zone', 'pool'];

// 組み込みの値（反映のたびにここから作り直す）
const clone = (v) => structuredClone(v);
const BASE = {
  creatures: CREATURES.map(clone),
  places: DESTINATIONS.map(clone),
  joint: JOINT_PROJECTS.map((p) => [...p.pool]),
  methods: clone(SPECIES_METHODS),
  notes: { ...NOTES },
  weight: { ...CATCH_WEIGHT },
  reward: { ...DISCOVERY_REWARD },
};
export const baseCreature = (id) => BASE.creatures.find((c) => c.id === id);
export const basePlace = (id) => BASE.places.find((d) => d.id === id);
export const baseMethods = (id) => BASE.methods[id] ?? [];
export const baseNote = (id) => BASE.notes[id] ?? '';
export const baseRules = () => ({ weight: { ...BASE.weight }, reward: { ...BASE.reward }, pieceFish: [...BASE_PIECE_FISH] });

const pick = (src, keys) => Object.fromEntries(keys.filter((k) => src?.[k] != null && src[k] !== '').map((k) => [k, clone(src[k])]));
const reset = (arr, base) => {
  arr.length = 0;
  arr.push(...base.map(clone));
};
const resetObj = (obj, base) => {
  for (const k of Object.keys(obj)) delete obj[k];
  Object.assign(obj, clone(base));
};

/** 設定を組み込みのデータへ反映する（cfg が空なら組み込みに戻す） */
export function applyConfig(cfg = {}) {
  reset(CREATURES, BASE.creatures);
  reset(DESTINATIONS, BASE.places);
  RETIRED_PLACES.length = 0;
  JOINT_PROJECTS.forEach((p, i) => (p.pool = [...BASE.joint[i]]));
  resetObj(SPECIES_METHODS, BASE.methods);
  resetObj(NOTES, BASE.notes);

  // 追加した魚種
  for (const a of cfg.added ?? []) {
    if (!a?.id || CREATURES.some((c) => c.id === a.id)) continue;
    CREATURES.push({ id: a.id, name: a.name || a.id, form: a.form || 'perch', len: +a.len || 0.2, rarity: +a.rarity || 1, slots: 1, appeal: +a.appeal || 1, colors: { body: 0x888888, belly: 0xdddddd, fin: 0x666666, ...a.colors }, ...(a.pat ? { pat: a.pat, mark: a.mark ?? 0x222222 } : {}), added: true });
    if (a.methods?.length) SPECIES_METHODS[a.id] = [...a.methods];
    if (a.note) NOTES[a.id] = a.note;
    for (const k of ['zone', 'seasons']) if (a[k]?.length) CREATURES.at(-1)[k] = clone(a[k]);
    for (const k of ['swim', 'beh']) if (a[k] && typeof a[k] === 'object') CREATURES.at(-1)[k] = clone(a[k]);
    if (a.removed) CREATURES.at(-1).retired = true;
  }
  // 魚種ごとの上書き
  for (const [id, o] of Object.entries(cfg.species ?? {})) {
    const c = CREATURES.find((x) => x.id === id);
    if (!c) continue;
    Object.assign(c, pick(o, SPECIES_KEYS));
    if (o.removed) c.retired = true;
    if (o.methods?.length) SPECIES_METHODS[id] = [...o.methods];
    if (o.note) NOTES[id] = o.note;
  }
  // 採取地
  for (const a of cfg.addedPlaces ?? []) {
    if (!a?.id || DESTINATIONS.some((d) => d.id === a.id)) continue;
    DESTINATIONS.push({ id: a.id, name: a.name || a.id, text: a.text ?? '', stage: +a.stage || 1, cost: +a.cost || 10000, seconds: 600, lat: +a.lat || 0, lon: +a.lon || 0, zone: a.zone, pool: [...(a.pool ?? [])], added: true });
  }
  for (const [id, o] of Object.entries(cfg.places ?? {})) {
    const d = DESTINATIONS.find((x) => x.id === id);
    if (d) Object.assign(d, pick(o, PLACE_KEYS), o.removed ? { retired: true } : {});
  }
  for (let i = DESTINATIONS.length - 1; i >= 0; i--) if (DESTINATIONS[i].retired) RETIRED_PLACES.push(...DESTINATIONS.splice(i, 1));
  for (const p of JOINT_PROJECTS) if (cfg.joint?.[p.id]?.pool?.length) p.pool = [...cfg.joint[p.id].pool];

  // 存在しない・削除した魚種は捕れないようにする（在庫・展示中の個体はそのまま残る）
  const alive = new Set(CREATURES.filter((c) => !c.retired).map((c) => c.id));
  for (const d of [...DESTINATIONS, ...JOINT_PROJECTS]) d.pool = [...new Set(d.pool.filter((id) => alive.has(id)))];

  // レア度ごとの採取の重み
  const r = cfg.rarity ?? {};
  resetObj(CATCH_WEIGHT, BASE.weight);
  Object.assign(CATCH_WEIGHT, nums(r.weight));
  resetObj(DISCOVERY_REWARD, BASE.reward);
  Object.assign(DISCOVERY_REWARD, nums(r.reward));
  // 8角星形ごとの1ピースの匹数
  const fish = cfg.growth?.pieceFish ?? [];
  BASE_PIECE_FISH.forEach((n, i) => (PIECE_FISH[i] = Number.isFinite(+fish[i]) && +fish[i] >= 1 ? Math.round(+fish[i]) : n));

  recomputeDerived();
  rebuildGrowth();
}
const nums = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k, v]) => RARITY_LIST.includes(+k) && Number.isFinite(+v) && v !== '' && v != null).map(([k, v]) => [k, +v]));

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? 'null');
  } catch {
    return null;
  }
};
const writeCache = (cfg) => {
  try {
    localStorage.setItem(CACHE, JSON.stringify(cfg));
  } catch {
    /* 保存できない環境では毎回読み込む */
  }
};

/**
 * 起動時：サーバーの最新の設定を読み、反映する。通信できなければ前回の控えを使う。
 * 未ログインでも読めるよう、公開キーで REST を直接呼ぶ（書き込みは管理者だけ。supabase/admin_config.sql）
 */
export async function loadCreatureConfig({ timeout = 4000 } = {}) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let cfg = null;
  if (url && key) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout);
      const res = await fetch(`${url}/rest/v1/game_config?key=eq.${CONFIG_KEY}&select=data`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) {
        cfg = (await res.json())[0]?.data ?? {};
        writeCache(cfg);
      }
    } catch {
      /* 通信できない */
    }
  }
  cfg ??= readCache();
  try {
    applyConfig(cfg ?? {});
  } catch (err) {
    console.warn('生物の設定を反映できませんでした', err);
    applyConfig({});
  }
  return cfg;
}
