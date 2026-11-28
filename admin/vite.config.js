import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * 生物設定の管理者ツール（ゲームとは別サイト）。ゲームの src/ のデータ定義を共有し、Supabase の game_config に保存する。
 *   開発・利用: npm run admin（Tailscale の URL ならスマホ・外出先からも開ける）
 *   静的ファイル: npm run admin:build → dist-admin/（任意の静的ホスティングに置ける）
 *   本番: GitHub Actions がゲームと一緒に Pages の /AquariumStudio/admin/ へ公開する（ADMIN_OUT_DIR=dist/admin）
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.ADMIN_OUT_DIR ? fileURLToPath(new URL(`../${process.env.ADMIN_OUT_DIR}/`, import.meta.url)) : `${ROOT}/dist-admin`;

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: ROOT, // ゲームと同じ .env.local（Supabase の URL・公開キー）
  base: './',
  // PORT：デスクトップアプリが、既定のポートが使用中のときに割り当てる空きポート（複数のセッションで同時に開ける）
  server: { port: Number(process.env.PORT) || 5181, strictPort: true, host: true, fs: { allow: [ROOT] } },
  preview: { port: 5181, host: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  build: { outDir: OUT, emptyOutDir: true },
});
