import { CREATURES, DESTINATIONS, JOINT_PROJECTS, CATCH_WEIGHT, STAR_LIST, RETIRED_PLACES, recomputeDerived } from './creatureData.js';
import { SPECIES_METHODS } from './fishingData.js';
import { NOTES } from './creatureNotes.js';
import { GROWTH_RULES, XP_OVERRIDE, rebuildGrowth } from './growth.js';

/**
 * 管理者が編集する生物の設定（Supabase の game_config 表、key = 'creatures'）。
 * 起動時に読み込み、組み込みのデータ（creatureData.js など）へ上書きする。何度反映しても同じ結果になる。
 *
 * {
 *   species: { [id]: { name, stars, len, appeal, zone, seasons, methods, note, xp, removed } },
 *   added:   [{ id, name, form, len, stars, appeal, colors: { body, belly, fin }, pat, mark, zone, seasons, methods, note }],
 *   places:  { [id]: { name, text, stage, cost, lat, lon, zone, pool, removed } },
 *   addedPlaces: [{ id, name, text, stage, cost, lat, lon, zone, pool }],
 *   joint:   { [id]: { pool } },
 *   stars:   { weight, xpMul, xpMin, xpFixed, levelMul }（それぞれ星の数 { 1〜6 }）
 * }
 */
export const CONFIG_KEY = 'creatures';
const CACHE = 'aq-creature-config';
const SPECIES_KEYS = ['name', 'stars', 'len', 'appeal', 'zone', 'seasons'];
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
  rules: clone(GROWTH_RULES),
};
export const baseCreature = (id) => BASE.creatures.find((c) => c.id === id);
export const basePlace = (id) => BASE.places.find((d) => d.id === id);
export const baseMethods = (id) => BASE.methods[id] ?? [];
export const baseNote = (id) => BASE.notes[id] ?? '';
export const baseRules = () => ({ weight: { ...BASE.weight }, ...clone(BASE.rules) });

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
  for (const k of Object.keys(XP_OVERRIDE)) delete XP_OVERRIDE[k];

  // 追加した魚種
  for (const a of cfg.added ?? []) {
    if (!a?.id || CREATURES.some((c) => c.id === a.id)) continue;
    CREATURES.push({ id: a.id, name: a.name || a.id, form: a.form || 'perch', len: +a.len || 0.2, stars: +a.stars || 1, slots: 1, appeal: +a.appeal || 1, colors: { body: 0x888888, belly: 0xdddddd, fin: 0x666666, ...a.colors }, ...(a.pat ? { pat: a.pat, mark: a.mark ?? 0x222222 } : {}), added: true });
    if (a.methods?.length) SPECIES_METHODS[a.id] = [...a.methods];
    if (a.note) NOTES[a.id] = a.note;
    for (const k of ['zone', 'seasons']) if (a[k]?.length) CREATURES.at(-1)[k] = clone(a[k]);
    if (a.removed) CREATURES.at(-1).retired = true;
    if (+a.xp > 0) XP_OVERRIDE[a.id] = +a.xp;
  }
  // 魚種ごとの上書き
  for (const [id, o] of Object.entries(cfg.species ?? {})) {
    const c = CREATURES.find((x) => x.id === id);
    if (!c) continue;
    Object.assign(c, pick(o, SPECIES_KEYS));
    if (o.removed) c.retired = true;
    if (o.methods?.length) SPECIES_METHODS[id] = [...o.methods];
    if (o.note) NOTES[id] = o.note;
    if (+o.xp > 0) XP_OVERRIDE[id] = +o.xp;
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

  // 星の数ごとの規則
  const r = cfg.stars ?? {};
  resetObj(CATCH_WEIGHT, BASE.weight);
  Object.assign(CATCH_WEIGHT, nums(r.weight));
  for (const k of Object.keys(GROWTH_RULES)) GROWTH_RULES[k] = { ...BASE.rules[k], ...nums(r[k]) };

  recomputeDerived();
  rebuildGrowth();
}
const nums = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k, v]) => STAR_LIST.includes(+k) && Number.isFinite(+v) && v !== '' && v != null).map(([k, v]) => [k, +v]));

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
