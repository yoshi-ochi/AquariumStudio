/**
 * 水槽の共有 URL の Cloudflare Worker（worker/）を公開する（開発用）。
 *   初回だけ：npx wrangler login（ブラウザで Cloudflare にログインして許可）
 *   npm run share:deploy … .env.local の VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を Worker に渡して公開する
 * 公開キー（anon）はブラウザにも配っている値なので Worker に渡してよい。管理用のキー（service_role）は渡さない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('.env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY が必要です');
  process.exit(1);
}
const r = spawnSync('npx', ['--yes', 'wrangler@3', 'deploy', '--var', `SUPABASE_URL:${url}`, '--var', `SUPABASE_ANON_KEY:${key}`], { cwd: path.join(ROOT, 'worker'), stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
