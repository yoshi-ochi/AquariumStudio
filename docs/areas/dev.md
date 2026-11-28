# 開発（Web本体・管理者ツール・サーバー）

最終更新：2026-11-29

## いまの状態
- 本番：https://yoshi-ochi.github.io/AquariumStudio/ （管理者ツールは `/admin/`）。main へのマージで GitHub Actions が公開する。
- 未マージの PR
  - #110 水槽の壁で切った岩の切り口を断面で埋める（ビルド成功。iPhone 実機は未確認。流木・サンゴは塗りの改善だけ）
  - #108 メール一覧の要約にコインの HTML が文字で出る不具合（ビルド成功。画面は未確認）
  - #97 管理者ツール「モデル待ち」タブで参考画像を貼り付けて登録
- CI はデプロイだけ（テストやチェックは走らない）。確認は手元のビルドとプレビューで行う。
- 管理者ツール「モデル待ち」タブ：リストに無い種を和名だけで仮登録できる（入力のたびに、既存の種・追加予定種・仮登録との重複を知らせる。未マージ・Issue #114）。SQL の変更は無い。情報の補完は `docs/species-add.md`（`npm run species:add`）。

## 次にやること
- 上の3つの PR を確認してマージする（#110 のあとにリール動画を撮り直すと、岩の切り口がきれいになる）。
- 自前サーバー化は調査だけ済み（結論：Supabase を Docker で自前運用するのが現実的。着手はしていない）。

## 決まりごと
- 1つの作業は Issue → ブランチ → PR。ブランチは `feat/…`・`fix/…`・`chore/…`、コミットは Conventional Commits。
- 既存の仕組みを作り変えない。1ファイル300行を目安に分ける。
- 画面に出る変更はプレビュー（`dev`）で確かめ、確かめられなかったことは PR に書く。
- Supabase の SQL は `supabase/` に置き、本番への適用はユーザーが SQL Editor で行う（適用が要ることを PR に書く）。
- Worker を変えたら `npm run share:deploy`、閲覧ページは main へのマージで反映。

## 関連ファイル
- 入口：`index.html`、`src/main.js`、`share.html`、`admin/index.html`
- フォルダの地図と機能の決まり：`docs/spec.md`
- 通貨・課金：`docs/monetization.md`
- デプロイ：`.github/workflows/deploy.yml`、`vite.config.js`
- 開発用の道具：`tools/showcase/buildShowcase.js`（見本の水族館）、`tools/thumbs/`（サムネイルの焼き込み）

## 起動
- `dev`（Web アプリ・5173）、`dev-offline`（Supabase なし・5174）、`admin`（管理者ツール・5181）
- 本番の確認は `prod-web`・`prod-admin`
