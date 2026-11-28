---
name: ios-release
description: AquariumStudio を iPhone アプリ（Capacitor）として出すときの手順。TestFlight・Codemagic・App Store 審査・App内課金（RevenueCat）・アイコンや起動画面・プライバシー申告で使う。返答は日本語。
---

# アプリ化（iOS）の手順

最初に `docs/areas/ios.md` だけ読む。外部サービスの画面での手順が要るときだけ `docs/iphone-release.md` の該当する節を読む。

## 0. 前提
- Mac は無い。ビルドは Codemagic（`codemagic.yaml` の「iOS TestFlight」）、実機確認はユーザーの iPhone の TestFlight。
- Apple Developer・App Store Connect・RevenueCat・Codemagic の画面操作はユーザーが行う。Claude は手順を示し、コードと設定ファイルを直す。
- 鍵・証明書・パスワードはチャットに書かせない（Codemagic や Supabase の Secrets に直接入れてもらう）。

## 1. コードを変えるとき
1. `git status -sb` → `git switch -c feat/ios-<短い名前> origin/main`。
2. アプリだけの分岐は `--mode app`（`vite.config.js`）と Capacitor の判定で行い、Web 版の動きを変えない。
3. 確認：`npx vite build --mode app` → `preview_start {name: "app-preview"}`（5177）で画面を確かめる。`npm run build` で Web 版も通す。
4. `ios/` の中を手で直したら、`npm run app:build`（`cap sync`）で上書きされないか確かめる。

## 2. 課金（変えてはいけない所）
- 有償ダイヤの付与はサーバーだけ（RevenueCat Webhook → `supabase/functions/revenuecat` → `iap_apply`）。端末で増やすコードを書かない。
- 商品 ID は `src/management/walletData.js` の `STORE_IDS` と App Store Connect で同じ。ID は後から種類を変えられない。
- 値段の表示は App Store が返す値段を使う。ゲーム内のお金は「コイン」。

## 3. 審査に向けた点検（出す前に毎回）
- アイコン（1024px・透過なし）と起動画面が `ios/App/App/Assets.xcassets` に入っている。
- プライバシー：App Store Connect の「Appのプライバシー」と `PrivacyInfo.xcprivacy`（集めるデータ＝メールアドレス・ゲームの進行・購入履歴）。
- アカウントを作れるアプリは、アプリの中からアカウントを消せること（`supabase/delete_account.sql` と画面の入口）。
- 審査用のデモアカウントと、課金を試す手順を審査メモに書く。
- ガチャは提供割合を表示する（卵ガチャ・内装ガチャ）。
- 外部ログインを出さない（出すと Sign in with Apple が要る）。アプリ内から外部の課金へ誘導しない。
- 審査ガイドラインは変わるので、提出の前に Apple の最新のページを確かめる（記憶で断言しない）。

## 4. ビルドが失敗したら
- Codemagic のログ（または artifacts の xcodebuild のログ）をユーザーに貼ってもらい、原因の行を特定してから直す。

## 5. 仕上げ
- `npm run docs:check` → `docs/areas/ios.md` の「いまの状態」「次にやること」を書き換える。手順が変わったら `docs/iphone-release.md` も直す。
- コミット → push → `gh pr create … --web=false`。マージはユーザーの確認後。
