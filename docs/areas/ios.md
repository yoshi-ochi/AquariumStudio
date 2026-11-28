# アプリ化（iOS）

最終更新：2026-11-28

## いまの状態
- コード側は入っている：Capacitor 8（`capacitor.config.json`、appId `com.aquariumstudio.akusuta`）、RevenueCat の購入（`src/online/purchases.js`）、付与のサーバー処理（`supabase/iap.sql`、`supabase/functions/revenuecat`）。
- Windows だけでビルドできるよう、Codemagic の設定（`codemagic.yaml`、ワークフロー「iOS TestFlight」）がある。
- 外部サービスの設定（Apple Developer Program・App Store Connect・RevenueCat・Codemagic）がどこまで済んだかは未確認。着手前にユーザーに聞く。

## 次にやること（`docs/iphone-release.md` の「まだのこと」）
- アプリのアイコンと起動画面（`ios/App/App/Assets.xcassets`）
- プライバシーの申告（App Store Connect）とプライバシーマニフェスト（`PrivacyInfo.xcprivacy`）
- 審査用のデモアカウント
- WebGL の描画が切れたときの復帰と、画質を下げる設定
- TestFlight での実機確認（課金は Sandbox テスター）

## 決まりごと
- 有償ダイヤは端末で増やさない。付与は必ずサーバー（RevenueCat Webhook → Edge Function → `iap_apply`）。
- 商品 ID は `src/management/walletData.js` の `STORE_IDS` と App Store Connect で同じにする。App Store の商品 ID は種類を変えられず、消しても作り直せない。
- アプリ版のログインはメールとパスワードだけ（外部ログインを出さないので Sign in with Apple の義務がかからない）。
- 共有の閲覧ページ（`share.html`）はアプリに入れない（`vite.config.js` の `--mode app`）。
- Mac が無いので、ビルドの失敗は Codemagic のログを見て直す。鍵や証明書の値はチャットに書かない。

## 関連ファイル
- 手順書：`docs/iphone-release.md`
- 課金の設計：`docs/monetization.md`（段階7）
- ビルド：`package.json` の `app:build`・`app:ios`、`codemagic.yaml`、`ios/`

## 起動
- `npx vite build --mode app` のあと `app-preview`（5177）で、アプリ用ビルドをブラウザで確かめる。
- 実機での確認は TestFlight（ユーザーの iPhone）。
