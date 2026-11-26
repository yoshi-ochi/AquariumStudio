/**
 * 管理者ツールの「モデル待ち」で制作に回された魚種の参考画像を、この PC の reference/fish/<和名>/ に取り込む（開発用）。
 *   npm run species:pull           … 依頼済み・制作中の種を取り込み、依頼済みを「制作中」にする
 *   npm run species:pull -- --list … 取り込まずに一覧だけ表示
 *
 * 保存の形は魚種追加ツール（tools/fish-intake）と同じ：横 → main.jpg、上 → ref-top.jpg、正面 → ref-front.jpg、その他 → ref-N.jpg、メモ → memo.txt
 * 管理者だけが読める画像なので、.env.local に SUPABASE_SERVICE_ROLE_KEY（Supabase の Project Settings → API の service_role キー）が必要。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'reference', 'fish');
const listOnly = process.argv.includes('--list');

const env = Object.fromEntries(
  ['.env', '.env.local']
    .map((f) => path.join(ROOT, f))
    .filter((f) => fs.existsSync(f))
    .flatMap((f) => fs.readFileSync(f, 'utf8').split(/\r?\n/))
    .map((l) => l.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('.env.local に VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const res = await sb.from('species_intake').select('*').in('status', ['requested', 'modeling']).order('updated_at');
// モデルが出来た種（ゲームに加わった種）は取り込み済みなので飛ばす
const { PLANNED } = await import('../src/expedition/speciesRoster.js');
const { isModeled } = await import('../src/expedition/speciesRelease.js');
const done = new Set(PLANNED.filter(isModeled).map((p) => p.id));
if (!res.error) res.data = res.data.filter((r) => !done.has(r.id));
if (res.error) {
  console.error(`読み込めませんでした：${res.error.message}`);
  process.exit(1);
}
if (!res.data.length) console.log('制作に回された種はありません。');

const FILE = { side: () => 'main.jpg', top: () => 'ref-top.jpg', front: () => 'ref-front.jpg' };
for (const r of res.data) {
  const label = r.status === 'requested' ? '依頼済み' : '制作中';
  console.log(`■ ${r.name}（${r.id}・${label}）画像${r.images.length}枚${r.memo ? '・メモあり' : ''}`);
  if (listOnly) continue;
  const dir = path.join(REF, r.name);
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, '.pulled.json');
  const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
  let n = Object.values(log).filter((f) => /^ref-\d+\./.test(f)).length;
  for (const img of r.images) {
    if (log[img.path]) continue;
    const name = FILE[img.kind]?.() ?? `ref-${++n}.jpg`;
    const dl = await sb.storage.from('species-ref').download(img.path);
    if (dl.error) {
      console.error(`  ${img.path} を取得できませんでした：${dl.error.message}`);
      continue;
    }
    if (img.kind === 'side') for (const f of fs.readdirSync(dir)) if (/^main\./i.test(f)) fs.renameSync(path.join(dir, f), path.join(dir, `old-${Date.now()}-${f}`));
    fs.writeFileSync(path.join(dir, name), Buffer.from(await dl.data.arrayBuffer()));
    log[img.path] = name;
    console.log(`  ${name}`);
  }
  if (r.memo.trim()) fs.writeFileSync(path.join(dir, 'memo.txt'), r.memo.trim() + '\n');
  fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
  if (r.status === 'requested') {
    const up = await sb.from('species_intake').update({ status: 'modeling', updated_at: new Date().toISOString() }).eq('id', r.id);
    if (up.error) console.error(`  状況を更新できませんでした：${up.error.message}`);
  }
}
