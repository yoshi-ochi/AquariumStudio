# AquariumStudio（アクスタ）共通ルール

3D水族館の建設・経営シミュレーション。Three.js + Vite（ES Modules）、Supabase、iPhone 版は Capacitor。
このファイルは全セッションで毎回読まれるので、短く保つ（60行以内）。詳しいことは `docs/` に置く。

## 最初にやること（トークン節約）
1. 自分のセッションの領域を下の表から1つ選び、その「読む資料」だけを読む。ほかの領域の資料や仕様書の全文は、必要になるまで読まない。
2. 手順は Skill に書いてある（必要なときだけ読み込まれる）。同じ内容をここや資料に書き写さない。
3. 着手前に `git status -sb` でブランチを確かめる。ほかの作業の未コミットがあれば、触らずに報告する。

| 領域 | 読む資料 | Skill |
|---|---|---|
| 開発（Web本体・管理者ツール・サーバー） | `docs/areas/dev.md` | `dev-flow` |
| アプリ化（iOS） | `docs/areas/ios.md` | `ios-release` |
| モデル作成（魚類） | `docs/areas/model.md` | `fish-model` |
| モデル作成（ウミウシ） | `docs/areas/model.md` | `slug-model` |
| モデル作成（それ以外） | `docs/areas/model.md` | `creature-model` |
| SNS | `docs/areas/sns.md` | `sns-post` |

仕様書と資料の索引は `docs/README.md`（一元管理の入口）。

## 返答
- 日本語で短く。前置き・挨拶・謝罪・長い解説は書かない。
- 既存ファイルは全体を出さず、変更点だけ示す。

## コード
- ロジック・データ定義・UI・3Dシーンを別ファイルに分ける。1ファイル300行を目安に分割する。
- 指示がない限り、動いている既存のロジックやファイル構成を作り変えない。
- エラーは原因を特定してから最小限に直す（理由は1〜2行）。
- 変更後は `npm run build` を通し、画面に出る変更はプレビューで確かめる（起動名は `docs/README.md`）。

## 資料の更新（PR のたびに）
- PR を作る前に `npm run docs:check` を実行する。触った領域の `docs/areas/<領域>.md` が古ければ知らせてくれる。
- 資料は「いまの状態」「次にやること」を書き換える（書き足して履歴にしない。履歴は git と PR に残る）。
- 仕様が変わったら `docs/spec.md` の該当する節も同じ PR で直す。

## 全領域で守ること
- ゲーム内のお金は「コイン」（`src/ui/currency.js` の `coin` / `coinText`）。「¥」は実際の課金の値段だけ。
- 有償ダイヤは端末で増やさない。付与は必ずサーバー（RevenueCat Webhook → `supabase/functions/revenuecat` → `iap_apply`）。
- 卵ガチャ限定種は図鑑・目標の発見数と採取地の達成報酬に数えない（コンプガチャ規制）。
- ガラスは `THREE.DoubleSide` と `depthWrite: false`。水槽内の物は水槽のローカル座標の子にする。
- ドロップシャドウ（`box-shadow` など）は使わない。
- main へのマージで本番（GitHub Pages）に公開される。マージはユーザーの確認を取ってから。
