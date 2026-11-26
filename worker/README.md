# 水槽の共有 URL（Cloudflare Worker）

LINE・インスタ・X などでリンクを送ったときに、水槽ごとの絵と題名を出すための小さなサーバー。

- `https://<worker>/t/<id>`：人が開くと閲覧ページ（GitHub Pages の `share.html?id=<id>`）へ移る。リンクの絵を取りに来た相手には、題名と画像（og:image）を書いた HTML を返す
- `https://<worker>/i/<id>.jpg`：共有したときに撮った画像（Supabase の公開ストレージ `share-img`）を中継してキャッシュする

## 準備（初回だけ）
1. Supabase の SQL Editor で `supabase/share.sql` を実行
2. Cloudflare の無料アカウントを作る
3. `cd worker && npx wrangler@3 login`（ブラウザで許可）

## 公開
```
npm run share:deploy
```
`.env.local` の Supabase の URL と公開キー（anon）を Worker に渡して公開する。表示された `https://aquastu-share.<名前>.workers.dev` を、GitHub のリポジトリ変数 `SHARE_BASE`（と `.env.local` の `VITE_SHARE_BASE`）に入れると、アプリの共有 URL がこちらになる。設定しないうちは閲覧ページの URL を直接共有する（リンクの絵はアプリ共通の og.png）。

## 無料枠の目安
- Cloudflare Workers：1日10万回まで（人が開く1回と、リンクの絵の取得で1〜2回）
- Supabase：共有1件は数KB〜25KB。1人3件まで・1分に1回まで・90日見られない共有は自動で消える（`supabase/share.sql`）
