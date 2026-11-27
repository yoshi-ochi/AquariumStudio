# iPhone アプリ版とApp内課金の手順

コード側（Capacitor・RevenueCat・付与のサーバー処理）は入っています。
ここに書いたのは、アカウントや外部サービスの設定など、手作業が必要なところです。

## 0. 必要なもの
- Apple Developer Program（年 $99）
- Mac と Xcode（ビルドと App Store への提出に必要。Windows ではビルドできない）。Mac が無ければ Codemagic などのクラウドビルド
- RevenueCat のアカウント（無料枠あり）

## 1. Supabase（付与のしくみ）
1. SQL Editor で `supabase/iap.sql` を実行する
   - `wallet.sql`・`gacha.sql` で作ったテーブルの読み取り権限もここで付く（付けないと、ログインした人が自分の有償ダイヤを読めない）
2. Edge Functions → 新しい関数 `revenuecat` を作り、`supabase/functions/revenuecat/index.ts` を貼り付けて Deploy する
   - 「Verify JWT」はオフにする
3. Edge Functions → Secrets に `REVENUECAT_WEBHOOK_AUTH` を追加する
   - 中身は長いランダムな文字列。手順3の RevenueCat の設定と同じ値にする

## 2. App Store Connect（商品）
1. アプリを登録する。バンドルIDは `capacitor.config.json` の `appId`（`com.aquariumstudio.akusuta`）。変えるときは両方を変える
2. App内課金の商品を作る。IDは `src/management/walletData.js` の `STORE_IDS` と同じにする

| 商品ID | 種類 | 値段 |
|---|---|---|
| aquastu.dia300 | 消耗型 | ¥160 |
| aquastu.dia900 | 消耗型 | ¥480 |
| aquastu.dia1900 | 消耗型 | ¥980 |
| aquastu.dia3200 | 消耗型 | ¥1,600 |
| aquastu.dia6200 | 消耗型 | ¥3,000 |
| aquastu.dia10500 | 消耗型 | ¥4,900 |
| aquastu.dia22000 | 消耗型 | ¥10,000 |
| aquastu.pass30 | 非更新サブスクリプション（または消耗型） | ¥720 |
| aquastu.team1 | 非消耗型 | ¥480 |
| aquastu.team2 | 非消耗型 | ¥480 |
| aquastu.bigwood | 非消耗型 | ¥480 |

3. 有料アプリ契約・銀行口座・税務情報を済ませる（これが無いと課金をテストできない）

## 3. RevenueCat
1. プロジェクトを作り、App Store のアプリをつなぐ（App Store Connect の「App内課金の共有シークレット」または In-App Purchase Key）
2. Products に手順2の商品IDを全部登録する。消耗型の残高はこのゲームのサーバーで管理するので、Entitlements と Offerings は無くてよい
3. API keys の Apple 用の公開キー（`appl_` で始まる）を `.env.local` の `VITE_REVENUECAT_IOS_KEY` に入れる
4. Integrations → Webhooks
   - URL：`https://<プロジェクト>.supabase.co/functions/v1/revenuecat`
   - Authorization header：手順1の `REVENUECAT_WEBHOOK_AUTH` と同じ値
   - 「Send test event」を押し、200 が返ることを確かめる（テストは何も付与しない）

## 4a. Windows だけの場合：Codemagic でビルドして TestFlight で試す
Mac が無くても、クラウドの Mac（Codemagic）でビルドし、iPhone の TestFlight アプリから入れて試せる。設定は `codemagic.yaml`。
Apple Developer Program の登録が「保留中」の間はできない（App Store Connect に入れるようになってから）。

1. **アプリの ID を登録**：developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → ＋ → App IDs
   - Bundle ID は `com.aquariumstudio.akusuta`（Explicit）。Capabilities の「In-App Purchase」はオンのまま
2. **App Store Connect にアプリを作る**：マイApp → ＋ → 新規App（プラットフォーム iOS・言語 日本語・Bundle ID は手順1のもの）
   - できたアプリの「App情報」にある **Apple ID（数字）** を控える → 手順4の `APP_STORE_APPLE_ID`
3. **App Store Connect の API キーを作る**：ユーザとアクセス → 統合 → App Store Connect API → チームキー → ＋
   - アクセスは「App Manager」。作ったら **Issuer ID・キーID** を控え、**.p8 ファイル** をダウンロード（1回しかダウンロードできない）
4. **Codemagic**（codemagic.io）に GitHub でサインアップし、このリポジトリ（AquariumStudio）を追加する
   - Team settings → Team integrations → Developer Portal → Manage keys → Add key
     - 名前は **`aquastu_asc`**（codemagic.yaml と同じ）。手順3の Issuer ID・キーID・.p8 を入れる
   - アプリの Environment variables に、グループ名 **`app_env`** で次を追加（Secure にチェック）
     - `VITE_SUPABASE_URL`・`VITE_SUPABASE_ANON_KEY`（`.env.local` と同じ値）
     - `VITE_REVENUECAT_IOS_KEY`（手順3の RevenueCat の公開キー。まだ無ければ空でもビルドはできる。課金だけ使えない）
     - `APP_STORE_APPLE_ID`（手順2の数字）
5. Codemagic で **Start new build** → ブランチ main・ワークフロー「iOS TestFlight」
   - 署名の証明書とプロファイルは Codemagic が API キーで自動で作る
   - 15〜25分ほどで TestFlight に届く（Apple の処理にさらに数分〜数十分）
6. **TestFlight で試す**：App Store Connect → アプリ → TestFlight → 内部テスト → グループを作って自分を追加
   - iPhone に「TestFlight」アプリを入れ、届いた招待から「アクスタ」を入れる
   - 課金は App Store Connect の Sandbox テスター（ユーザとアクセス → Sandbox）で試す

無料枠は月500分ほど（1回のビルドで約20分）。ビルドが失敗したら、Codemagic のログ（または artifacts の xcodebuild のログ）を見せてもらえれば直します。

## 4. ビルドと実機での確認（Mac がある場合）
```
npm install
npm run app:build      # dist-app を作り、ios/ へコピーする
npm run app:ios        # Xcode が開く
```
1. Xcode で Signing の Team を選び、実機かシミュレーターで起動する
2. App Store Connect の Sandbox テスターで購入を試す
   - ダイヤを買うと、数秒後に有償ダイヤが増える（Webhook → Supabase）
   - 「購入を復元」で、調査隊・大型流木が戻る
3. Supabase の `iap_events` テーブルに、受け取った知らせが記録される

## アプリ版での違い（コードで対応済み）
- ログインはメールとパスワードだけ（Google ログインは、画面遷移からアプリへ戻れないため出さない）
- 外部ログインを出さないので、「Sign in with Apple」の義務（審査ガイドライン 4.8）はかからない
- 登録確認・パスワード再設定のメールのリンクは公開版のページへ戻る。確認が済んだらアプリでログインする
- ショップは App Store の値段を表示し、「購入を復元」ボタンを出す
- 付与はすべてサーバー（RevenueCat の Webhook）で行う。端末の改造で有償ダイヤを増やすことはできない

## まだのこと
- アプリのアイコンと起動画面（`ios/App/App/Assets.xcassets`）
- プライバシーの申告（App Store Connect の「Appのプライバシー」）と、プライバシーマニフェスト（`PrivacyInfo.xcprivacy`）
- 審査用のデモアカウント
- WebGL の描画が切れたときの復帰と、画質を下げる設定（最初の評価で挙げた課題）
