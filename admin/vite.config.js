import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * 生物設定の管理者ツール（ゲームとは別サイト）。ゲームの src/ のデータ定義を共有し、Supabase の game_config に保存する。
 *   開発・利用: npm run admin（Tailscale の URL ならスマホ・外出先からも開ける）
 *   静的ファイル: npm run admin:build → dist-admin/（任意の静的ホスティングに置ける）
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: ROOT, // ゲームと同じ .env.local（Supabase の URL・公開キー）
  base: './',
  server: { port: 5181, strictPort: true, host: true, fs: { allow: [ROOT] } },
  preview: { port: 5181, host: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  build: { outDir: `${ROOT}/dist-admin`, emptyOutDir: true },
});
