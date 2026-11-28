import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export default defineConfig(({ command, mode }) => {
  // iPhone アプリ（Capacitor）用：`npm run app:build`（--mode app）。アプリの中から相対パスで読み込み、dist-app に出す
  const app = mode === 'app';
  return {
    // GitHub Pages（https://yoshi-ochi.github.io/AquariumStudio/）で配信するため、本番ビルドはサブパスに置く
    base: app ? './' : command === 'build' ? '/AquariumStudio/' : '/',
    // 一部の環境（サンドボックス等）ではキャッシュへの書き込みが拒否されるため、
    // 依存の事前バンドルを行わない。three は ESM なのでそのまま読み込める。
    optimizeDeps: { noDiscovery: true, include: [] },
    // PORT：デスクトップアプリが、既定のポートが使用中のときに割り当てる空きポート（複数のセッションで同時に開ける）
    server: { port: Number(process.env.PORT) || 5173, strictPort: true },
    // ゲーム本体と、共有された水槽の閲覧ページ（share.html。ログインなしで1つの水槽を見る。アプリには入れない）
    build: {
      outDir: app ? 'dist-app' : 'dist',
      rollupOptions: { input: app ? { main: page('index.html') } : { main: page('index.html'), share: page('share.html') } },
    },
  };
});
