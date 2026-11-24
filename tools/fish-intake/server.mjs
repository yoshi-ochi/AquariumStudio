/**
 * 魚種追加ツール（開発者用・ゲームとは別サイト）。
 * スマホ等から魚種を選んで画像を送ると reference/fish/<和名>/ に保存する。
 * Node 標準機能のみ。起動: node tools/fish-intake/server.mjs
 */
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { speciesList, GROUPS } from './species.mjs';
import { PLANNED } from '../../src/expedition/speciesRoster.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const REF = path.join(ROOT, 'reference', 'fish');
const CREATURES = path.join(ROOT, 'src', 'expedition', 'creatureData.js');
const PUBLIC = path.join(HERE, 'public');
const PORT = Number(process.env.PORT) || 5180;
const MAX_BYTES = 30 * 1024 * 1024;
const IMG = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif' };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic', 'image/heif': '.heif', 'image/avif': '.avif' };

// 合言葉（同じネットワークの他人に書き込まれないように）
const TOKEN_FILE = path.join(HERE, '.token');
if (!existsSync(TOKEN_FILE)) writeFileSync(TOKEN_FILE, crypto.randomBytes(12).toString('hex'));
const TOKEN = readFileSync(TOKEN_FILE, 'utf8').trim();

const CUSTOM = path.join(REF, '_custom.json');
const readJson = async (p, d) => JSON.parse(await fs.readFile(p, 'utf8').catch(() => JSON.stringify(d)));

const validName = (n) => typeof n === 'string' && n.length >= 1 && n.length <= 30 && !/[\\/:*?"<>|.\x00-\x1f]/.test(n) && n.trim() === n;
const validFile = (f) => typeof f === 'string' && /^[\w-]+\.[a-z0-9]+$/i.test(f) && IMG.test(f);

async function allSpecies() {
  const custom = await readJson(CUSTOM, []);
  const map = new Map(speciesList().map((s) => [s.name, s]));
  for (const s of custom) if (!map.has(s.name)) map.set(s.name, { ...s, custom: true });
  return map;
}

/** ゲームに実装済みの和名：creatureData.js の種と、モデルが出来た追加予定種（speciesRoster.js） */
async function inGame() {
  const src = await fs.readFile(CREATURES, 'utf8').catch(() => '');
  const names = new Set([...src.matchAll(/c\('[\w]+', '([^']+)'/g)].map((m) => m[1]));
  const dir = path.dirname(CREATURES);
  const anatomy = (await fs.readdir(dir)).filter((f) => /^creatureAnatomy.*\.js$/.test(f));
  const keys = new Set();
  for (const f of anatomy) for (const m of (await fs.readFile(path.join(dir, f), 'utf8')).matchAll(/^ {2}(\w+): \{/gm)) keys.add(m[1]);
  for (const p of PLANNED) if (p.model === true || keys.has(p.id)) names.add(p.name);
  return names;
}

async function speciesState(name) {
  const dir = path.join(REF, name);
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => IMG.test(f)).sort();
  const images = files.map((f) => ({ file: f, main: /^main\./i.test(f) }));
  const legacy = (await fs.readdir(REF).catch(() => [])).find((f) => IMG.test(f) && path.parse(f).name === name) ?? null;
  const memo = await fs.readFile(path.join(dir, 'memo.txt'), 'utf8').catch(() => '');
  return { images, legacy, memo };
}

async function listAll() {
  const [map, game] = await Promise.all([allSpecies(), inGame()]);
  const out = [];
  for (const s of map.values()) out.push({ ...s, inGame: game.has(s.name), ...(await speciesState(s.name)) });
  // リスト外でもゲームに居る種は表示する
  for (const n of game) if (!map.has(n)) out.push({ name: n, group: 'ゲーム実装済み（リスト外）', inGame: true, ...(await speciesState(n)) });
  return { groups: GROUPS, species: out };
}

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) { reject(Object.assign(new Error('画像が大きすぎます（30MBまで）'), { code: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function requireSpecies(name) {
  if (!validName(name)) throw Object.assign(new Error('魚種名が正しくありません'), { code: 400 });
  const map = await allSpecies();
  if (!map.has(name) && !(await inGame()).has(name)) throw Object.assign(new Error('リストにない魚種です'), { code: 404 });
  return path.join(REF, name);
}

/** 既存の main を参考画像へ降格する */
async function demoteMain(dir) {
  for (const f of await fs.readdir(dir).catch(() => [])) {
    if (/^main\./i.test(f)) await fs.rename(path.join(dir, f), path.join(dir, `ref-${Date.now()}${path.extname(f).toLowerCase()}`));
  }
}

async function api(req, res, url) {
  const q = Object.fromEntries(url.searchParams);
  const route = `${req.method} ${url.pathname}`;
  if (route === 'GET /api/species') return send(res, 200, await listAll());

  if (route === 'GET /api/image') {
    const file = q.legacy ? path.join(REF, path.basename(q.legacy)) : path.join(await requireSpecies(q.name), path.basename(q.file ?? ''));
    if (!IMG.test(file)) return send(res, 400, { error: '画像ではありません' });
    const buf = await fs.readFile(file).catch(() => null);
    return buf ? send(res, 200, buf, MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream') : send(res, 404, { error: 'ありません' });
  }

  if (route === 'PUT /api/upload') {
    const dir = await requireSpecies(q.name);
    const ext = EXT[(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()];
    if (!ext) return send(res, 415, { error: '対応していない画像形式です' });
    const buf = await readBody(req);
    if (!buf.length) return send(res, 400, { error: '空のファイルです' });
    await fs.mkdir(dir, { recursive: true });
    const hasMain = (await fs.readdir(dir)).some((f) => /^main\./i.test(f));
    const asMain = q.main === '1' || !hasMain; // 最初の1枚はメイン
    if (asMain) await demoteMain(dir);
    const file = asMain ? `main${ext}` : `ref-${Date.now()}-${crypto.randomBytes(2).toString('hex')}${ext}`;
    await fs.writeFile(path.join(dir, file), buf);
    console.log(`保存: ${q.name}/${file} (${Math.round(buf.length / 1024)}KB)`);
    return send(res, 200, { ok: true, file });
  }

  if (route === 'POST /api/main') {
    const dir = await requireSpecies(q.name);
    if (!validFile(q.file) || !existsSync(path.join(dir, q.file))) return send(res, 404, { error: '画像がありません' });
    if (/^main\./i.test(q.file)) return send(res, 200, { ok: true });
    const tmp = path.join(dir, `_${q.file}`);
    await fs.rename(path.join(dir, q.file), tmp);
    await demoteMain(dir);
    await fs.rename(tmp, path.join(dir, `main${path.extname(q.file).toLowerCase()}`));
    return send(res, 200, { ok: true });
  }

  if (route === 'DELETE /api/image') {
    const dir = await requireSpecies(q.name);
    if (!validFile(q.file)) return send(res, 400, { error: 'ファイル名が正しくありません' });
    await fs.unlink(path.join(dir, q.file)).catch(() => {});
    return send(res, 200, { ok: true });
  }

  if (route === 'PUT /api/memo') {
    const dir = await requireSpecies(q.name);
    const text = (await readBody(req)).toString('utf8').slice(0, 4000);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'memo.txt'), text);
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/species') {
    const { name, group } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (!validName(name)) return send(res, 400, { error: '魚種名に使えない文字があります' });
    if ((await allSpecies()).has(name)) return send(res, 409, { error: 'すでにリストにあります' });
    const custom = await readJson(CUSTOM, []);
    custom.push({ name, group: GROUPS.includes(group) ? group : '追加した魚種' });
    await fs.mkdir(REF, { recursive: true });
    await fs.writeFile(CUSTOM, JSON.stringify(custom, null, 2));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: '不明な操作です' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      const t = req.headers['x-token'] ?? url.searchParams.get('t');
      if (t !== TOKEN) return send(res, 401, { error: '合言葉が違います。起動時に表示されたURLから開いてください' });
      return await api(req, res, url);
    }
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^([\\/]|\.\.)+/, ''));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
    const buf = await fs.readFile(file).catch(() => null);
    return buf ? send(res, 200, buf, MIME[path.extname(file)] ?? 'application/octet-stream') : send(res, 404, 'not found', 'text/plain');
  } catch (err) {
    send(res, err.code >= 400 && err.code < 600 ? err.code : 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  console.log('魚種追加ツール 起動しました。保存先:', REF);
  console.log(`  この PC:   http://localhost:${PORT}/?t=${TOKEN}`);
  for (const a of addrs) console.log(`  ${a.startsWith('100.') ? 'Tailscale' : '同じWi-Fi'}: http://${a}:${PORT}/?t=${TOKEN}`);
});
