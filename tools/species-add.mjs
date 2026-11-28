/**
 * 和名だけで仮登録した種を、調べた情報と一緒に追加予定種（モデル待ち）へ加える（開発用）。
 *   npm run species:add -- --pending         … 情報が未補完の種（reference/fish/_custom.json）を表示
 *   npm run species:add -- --ranges          … 値の相場（レア度ごとの集客力）と、使える体形・模様・漁法・採取地を表示
 *   npm run species:add -- <種.json>         … 検証して追記（配列なら複数）
 *   npm run species:add -- <種.json> --dry   … 検証だけ（書き込まない）
 *
 * 調べるのは Claude、確かめて書くのがこのスクリプト。JSON の形：
 *   { "id": "aoriika", "name": "アオリイカ", "sci": "Sepioteuthis lessoniana", "form": "squid", "len": 0.4, "rarity": 2, "appeal": 4,
 *     "colors": { "body": "#b8a890", "belly": "#e8e0d0", "fin": "#a89880" }, "methods": ["setnet", "pole"], "at": ["iso", "oki"],
 *     "seasons": [0, 1], "note": "図鑑の解説", "extra": { "pat": "spots", "mark": "#6a5a48", "school": true },
 *     "behavior": { "mode": "wander", "cruise": 0.6, "opts": { "burst": 4, "every": 35 } }, "file": "japan" }
 *   seasons（0春〜3冬。通年なら書かない）・extra・behavior（体形の既定で足りなければ）・file（japan / reef / world。無ければ採取地から決める）は省ける。
 *
 * 書き込む先：src/expedition/speciesPlannedJapan.js・speciesPlannedReef.js・speciesPlannedWorld.js の末尾（学名は項目の sci）、行動は behaviorData.js の ID_BEH。
 * モデル（ANATOMY[id] または model: true）が無いので、追記しただけでは本番に出ない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, referenceDir, readCustom, removeCustom, hasMainImage } from './species-lib.mjs';
import { normalizeName, validName, isGenericName, validSci } from '../src/admin/intakeNames.js';

const SELF = fileURLToPath(import.meta.url);
const EXP = path.join(ROOT, 'src', 'expedition');
const FILES = { japan: 'speciesPlannedJapan.js', reef: 'speciesPlannedReef.js', world: 'speciesPlannedWorld.js' };
const BEH_FILE = path.join(EXP, 'behaviorData.js');
const HEADER = '  // ---- 和名だけの仮登録から追加（npm run species:add） ----';
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);

const { CREATURES, DESTINATIONS, HIDDEN_PLACES, RARITY_NAME, SEASONS } = await import('../src/expedition/creatureData.js');
const { PLANNED } = await import('../src/expedition/speciesRoster.js');
const { PLANNED_JAPAN } = await import('../src/expedition/speciesPlannedJapan.js');
const { PLANNED_REEF } = await import('../src/expedition/speciesPlannedReef.js');
const { PLANNED_WORLD } = await import('../src/expedition/speciesPlannedWorld.js');
const { METHODS } = await import('../src/expedition/fishingData.js');
const { SCI } = await import('../src/expedition/speciesSci.js');
const { ANATOMY } = await import('../src/expedition/creatureAnatomy.js');
const { MODE_NAMES, baseBehaviorOf } = await import('../src/expedition/behaviorData.js');

const ALL = [...CREATURES, ...PLANNED.filter((p) => !CREATURES.some((c) => c.id === p.id))];
const PLACES = [...DESTINATIONS, ...HIDDEN_PLACES];
const FORMS = [...new Set(ALL.map((c) => c.form))].sort();
const PATS = [...new Set(ALL.map((c) => c.pat).filter(Boolean))].sort();
/** extra に書ける項目（既存の種が使っているもの）。model・gacha は公開や入手方法を変えるので、ここでは受け付けない */
const CORE = ['id', 'name', 'sci', 'form', 'len', 'rarity', 'slots', 'appeal', 'colors', 'methods', 'at', 'note', 'seasons', 'model', 'gacha', 'released'];
const EXTRA_KEYS = [...new Set(ALL.flatMap((c) => Object.keys(c)))].filter((k) => !CORE.includes(k)).sort();
const sciOf = (c) => c.sci ?? SCI[c.id];
const median = (a) => a[a.length >> 1];
const appealRange = (rarity) => {
  const a = ALL.filter((c) => c.rarity === rarity).map((c) => c.appeal).sort((x, y) => x - y);
  return { min: a[0], mid: median(a), max: a.at(-1), n: a.length };
};

/** behaviorData.js で使われている行動の項目と events の名前（書き間違いを見つけるため） */
function behaviorVocab() {
  const src = fs.readFileSync(BEH_FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const body = src.slice(src.indexOf('const FORM_BEH'), src.indexOf('export const MODE_NAMES'));
  const keys = new Set([...body.matchAll(/[{,]\s*(\w+):(?! B\()/g)].map((m) => m[1]));
  const events = new Set([...body.matchAll(/events: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((e) => e[1])));
  return { keys, events };
}

const toHex = (v) => {
  const n = typeof v === 'string' && /^(#|0x)[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace(/^(#|0x)/i, ''), 16) : v;
  return Number.isInteger(n) && n >= 0 && n <= 0xffffff ? n : null;
};
const hexLit = (n) => `0x${n.toString(16).padStart(6, '0')}`;
const str = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
/** 値を JS の書き方にする（"#rrggbb" は 0x の色にする） */
const lit = (v) => {
  if (typeof v === 'string') return toHex(v) != null && /^(#|0x)/i.test(v) ? hexLit(toHex(v)) : str(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')} }`;
  return String(v);
};

/** 1種を確かめる。{ errors, warns, file } を返す */
function validate(e, batch) {
  const errors = [];
  const warns = [];
  const others = [...ALL, ...batch.filter((b) => b !== e)];
  const isList = (v, ok) => Array.isArray(v) && v.length > 0 && v.every(ok);

  if (typeof e.name !== 'string' || !validName(e.name) || normalizeName(e.name) !== e.name) errors.push('name：和名はカタカナ・30文字以内（空白や記号 \\ / : * ? " < > | . は不可）');
  else if (isGenericName(e.name)) errors.push(`name：「${e.name}」は総称（属・科のまとまり）に見える。総称のモデルは作らない`);
  else if (others.some((c) => normalizeName(c.name) === e.name)) errors.push(`name：「${e.name}」はすでにいる（id ${others.find((c) => normalizeName(c.name) === e.name).id}）`);

  if (typeof e.id !== 'string' || !/^[a-z][a-z0-9]{2,19}$/.test(e.id)) errors.push('id：英小文字で始まる英数字3〜20文字（ローマ字の短い名前）');
  else if (others.some((c) => c.id === e.id) || PLACES.some((d) => d.id === e.id) || ANATOMY[e.id]) errors.push(`id：「${e.id}」は使われている`);

  if (!validSci(e.sci)) errors.push('sci：学名は「属名 種小名」（sp.・属名だけは総称なので作らない）');
  else if (others.some((c) => sciOf(c) === e.sci)) errors.push(`sci：同じ学名の種がすでにいる（${others.find((c) => sciOf(c) === e.sci).name}）。別名の同じ種ではないか確かめる`);

  if (!FORMS.includes(e.form)) errors.push(`form：体形は ${FORMS.join(' / ')} のどれか`);
  if (typeof e.len !== 'number' || !(e.len >= 0.005 && e.len <= 35)) errors.push('len：全長は m で 0.005〜35（cm で書いていないか確かめる）');
  if (![1, 2, 3, 4].includes(e.rarity)) errors.push('rarity：レア度は 1（緑）〜4（金）');
  if (typeof e.appeal !== 'number' || !(e.appeal > 0 && e.appeal <= 200)) errors.push('appeal：集客力は 0 より大きく 200 以下');
  else if ([1, 2, 3, 4].includes(e.rarity)) {
    const r = appealRange(e.rarity);
    if (e.appeal < r.min || e.appeal > r.max) warns.push(`appeal：レア度${RARITY_NAME[e.rarity]}の相場（${r.min}〜${r.max}、中央 ${r.mid}）から外れている`);
  }
  for (const k of ['body', 'belly', 'fin']) if (toHex(e.colors?.[k]) == null) errors.push(`colors.${k}：色は "#rrggbb"`);

  if (!isList(e.methods, (m) => METHODS.some((x) => x.id === m))) errors.push(`methods：漁法は ${METHODS.map((m) => m.id).join(' / ')} から1つ以上`);
  if (!isList(e.at, (p) => PLACES.some((d) => d.id === p))) errors.push(`at：採取地は ${PLACES.map((d) => d.id).join(' / ')} から1つ以上`);
  if (e.seasons != null && !isList(e.seasons, (s) => [0, 1, 2, 3].includes(s))) errors.push('seasons：季節は 0春・1夏・2秋・3冬 の配列（通年なら書かない）');
  if (typeof e.note !== 'string' || e.note.trim().length < 10) errors.push('note：図鑑の解説を10文字以上で書く');
  else if (e.note.length > 80) warns.push(`note：解説が長い（${e.note.length}文字。既存は長くても60文字ほど）`);

  for (const [k, v] of Object.entries(e.extra ?? {})) {
    if (!EXTRA_KEYS.includes(k)) errors.push(`extra.${k}：使えない項目（使えるのは ${EXTRA_KEYS.join(' / ')}）`);
    if (k === 'pat' && !PATS.includes(v)) errors.push(`extra.pat：模様は ${PATS.join(' / ')} のどれか`);
    if (k === 'mark' && toHex(v) == null) errors.push('extra.mark：模様の色は "#rrggbb"');
  }
  if (e.behavior) {
    const { keys, events } = behaviorVocab();
    if (!MODE_NAMES[e.behavior.mode]) errors.push(`behavior.mode：${Object.keys(MODE_NAMES).join(' / ')} のどれか`);
    if (typeof e.behavior.cruise !== 'number' || !(e.behavior.cruise >= 0 && e.behavior.cruise <= 12)) errors.push('behavior.cruise：巡航速度は 0〜12（体長/秒）');
    for (const [k, v] of Object.entries(e.behavior.opts ?? {})) {
      if (!keys.has(k)) errors.push(`behavior.opts.${k}：behaviorData.js に無い項目`);
      if (k === 'events' && !(Array.isArray(v) && v.every((x) => events.has(x)))) errors.push(`behavior.opts.events：${[...events].join(' / ')} から選ぶ`);
    }
  }

  // 書き込む先：指定が無ければ、同じ採取地の種がいちばん多いファイル
  const count = (list) => list.filter((p) => p.at?.includes(e.at?.[0])).length;
  const tally = { japan: count(PLANNED_JAPAN), reef: count(PLANNED_REEF), world: count(PLANNED_WORLD) };
  const file = e.file ?? Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
  if (!FILES[file]) errors.push('file：japan / reef / world のどれか');
  return { errors, warns, file };
}

/** q('id', '和名', '学名', '体形', 全長, レア度, 集客力, 体, 腹, ひれ, '漁法', '採取地', '解説', { その他 }) の1行 */
function line(e) {
  const extra = { ...(e.extra ?? {}), ...(e.seasons ? { seasons: e.seasons } : {}) };
  const c = ['body', 'belly', 'fin'].map((k) => hexLit(toHex(e.colors[k])));
  const head = [str(e.id), str(e.name), str(e.sci), str(e.form), e.len, e.rarity, e.appeal, ...c, str(e.methods.join(' ')), str(e.at.join(' ')), str(e.note.trim())];
  return `  q(${head.join(', ')}${Object.keys(extra).length ? `, ${lit(extra)}` : ''}),`;
}

function insertSpecies(src, e) {
  const end = src.lastIndexOf('\n];');
  if (end < 0) throw new Error('配列の終わり（];）が見つからない');
  return `${src.slice(0, end)}${src.includes(HEADER) ? '' : `\n${HEADER}`}\n${line(e)}${src.slice(end)}`;
}

function insertBehavior(src, e) {
  const start = src.indexOf('const ID_BEH = {');
  const end = src.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('ID_BEH が見つからない');
  const o = e.behavior.opts && Object.keys(e.behavior.opts).length ? `, ${lit(e.behavior.opts)}` : '';
  return `${src.slice(0, end)}\n  ${e.id}: B(${str(e.behavior.mode)}, ${e.behavior.cruise}${o}), // ${e.name}${src.slice(end)}`;
}

function report(e, file) {
  const place = (id) => PLACES.find((d) => d.id === id)?.name ?? id;
  const method = (id) => METHODS.find((m) => m.id === id)?.name ?? id;
  const beh = e.behavior ? `${MODE_NAMES[e.behavior.mode]}・巡航 ${e.behavior.cruise}` : `体形の既定（${MODE_NAMES[baseBehaviorOf(e).mode]}）`;
  const rows = [
    ['id', e.id, '×'], ['学名', e.sci, '×'], ['体形', e.form, '×'], ['全長', `${e.len}m`, '○'], ['レア度', `${e.rarity}（${RARITY_NAME[e.rarity]}）`, '○'], ['集客力', e.appeal, '○'],
    ['色（体・腹・ひれ）', ['body', 'belly', 'fin'].map((k) => `#${hexLit(toHex(e.colors[k])).slice(2)}`).join(' '), '×'],
    ['模様など', Object.keys(e.extra ?? {}).length ? lit(e.extra) : 'なし', '×'], ['漁法', e.methods.map(method).join('・'), '○'], ['採取地', e.at.map(place).join('・'), '○'],
    ['季節', e.seasons ? e.seasons.map((s) => SEASONS[s]).join('・') : '通年', '○'], ['行動', beh, '○'], ['解説', e.note.trim(), '○'],
  ];
  console.log(`\n■ ${e.name} → src/expedition/${FILES[file]}`);
  for (const [k, v, admin] of rows) console.log(`  ${admin} ${k}：${v}`);
}

// ---- 表示だけの使い方 ----
if (flag('--verify')) {
  // 追記のあと、別のプロセスで読み込めるか・モデル待ちのままかを確かめる（内部用）
  const bad = args.filter((a) => !a.startsWith('--')).filter((id) => !PLANNED.some((p) => p.id === id) || CREATURES.some((c) => c.id === id));
  if (bad.length) console.error(`追記を確かめられなかった：${bad.join(' ')}`);
  process.exit(bad.length ? 1 : 0);
}
if (flag('--pending')) {
  const ref = referenceDir();
  const list = readCustom(ref).filter((s) => !ALL.some((c) => normalizeName(c.name) === normalizeName(s.name)));
  if (!ref) console.log('reference/fish が見つかりません（本体のフォルダで npm run species:pull を実行してください）。');
  else if (!list.length) console.log('情報が未補完の種はありません。');
  for (const s of list) console.log(`■ ${s.name}${s.intake ? `（${s.intake}）` : ''}・${hasMainImage(ref, s.name) ? '画像あり' : '画像なし'}${isGenericName(s.name) ? '・総称に見える（作らない）' : ''}`);
  process.exit(0);
}
if (flag('--ranges')) {
  console.log('■ 集客力の相場（既存の種と追加予定種）');
  for (const r of [1, 2, 3, 4]) {
    const a = appealRange(r);
    console.log(`  レア度${r}（${RARITY_NAME[r]}）${a.n}種：${a.min}〜${a.max}、中央 ${a.mid}`);
  }
  console.log(`■ 体形：${FORMS.join(' ')}\n■ 模様（extra.pat）：${PATS.join(' ')}\n■ extra に書ける項目：${EXTRA_KEYS.join(' ')}`);
  console.log(`■ 漁法：${METHODS.map((m) => `${m.id}（${m.name}）`).join(' ')}\n■ 採取地：${PLACES.map((d) => `${d.id}（${d.name}）`).join(' ')}`);
  console.log(`■ 行動の mode：${Object.entries(MODE_NAMES).map(([k, v]) => `${k}（${v}）`).join(' ')}`);
  process.exit(0);
}

// ---- 検証して追記 ----
const input = args.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('使い方：npm run species:add -- <種.json> [--dry]｜--pending｜--ranges');
  process.exit(1);
}
let batch;
try {
  batch = [JSON.parse(fs.readFileSync(path.resolve(input), 'utf8').replace(/^﻿/, ''))].flat();
} catch (err) {
  console.error(`JSON を読めませんでした：${err.message}`);
  process.exit(1);
}
const checked = batch.map((e) => ({ e, ...validate(e, batch) }));
for (const { e, errors, warns } of checked) {
  for (const w of warns) console.log(`注意 ${e.name ?? '?'}  ${w}`);
  for (const x of errors) console.error(`誤り ${e.name ?? '?'}  ${x}`);
}
if (checked.some((c) => c.errors.length)) {
  console.error('\n誤りがあるので書き込みません。');
  process.exit(1);
}
for (const { e, file } of checked) report(e, file);
console.log('\n○＝公開後に管理者ツールの「魚種」タブで直せる／×＝データのファイルを直す');
if (flag('--dry')) {
  console.log('検証だけ行いました（--dry）。');
  process.exit(0);
}

const before = new Map();
const edit = (file, fn) => {
  if (!before.has(file)) before.set(file, fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
};
for (const { e, file } of checked) {
  edit(path.join(EXP, FILES[file]), (src) => insertSpecies(src, e));
  if (e.behavior) edit(BEH_FILE, (src) => insertBehavior(src, e));
}
const verify = spawnSync(process.execPath, [SELF, '--verify', ...batch.map((e) => e.id)], { stdio: 'inherit' });
if (verify.status !== 0) {
  for (const [file, src] of before) fs.writeFileSync(file, src);
  console.error('追記したデータを読み込めなかったので、元に戻しました。');
  process.exit(1);
}
const ref = referenceDir();
for (const e of batch) if (ref) removeCustom(ref, e.name);
console.log(`\n${batch.length}種を追加予定種（モデル待ち）に加えました。モデルが出来るまで本番には出ません。`);
