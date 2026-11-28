# 開発（Web本体・管理者ツール・サーバー）

最終更新：2026-11-28

## いまの状態
- 本番：https://yoshi-ochi.github.io/AquariumStudio/ （管理者ツールは `/admin/`）。main へのマージで GitHub Actions が公開する。
- 未マージの PR
  - #97 管理者ツール「モデル待ち」タブで参考画像を貼り付けて登録（同じ機能は #105 で main に入っている。マージしても差分は出ないので、閉じるだけでよい）
- 岩の切り口の断面（#110）は本番に入った。iPhone 実機は未確認。流木・サンゴなど閉じていない形は塗りの改善だけで、両方のガラスを突き抜けるほど大きく置くと穴が残る。
- CI はデプロイだけ（テストやチェックは走らない）。確認は手元のビルドとプレビューで行う。
- `dev-offline`（5174）がほかのセッションで使われているときは `dev-offline-alt`（5176）で起動する。

## 次にやること
- #97 を閉じる（ユーザーの確認を取ってから）。
- #110 を iPhone 実機で確かめる。リール動画を撮り直すと、岩の切り口がきれいになる。
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
