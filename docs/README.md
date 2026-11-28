# 資料の索引（一元管理の入口）

仕様書・領域ごとの資料・手順書は、すべてこの `docs/` に置く。新しい資料を作ったら、この表に1行足す。

## 仕様書
| 資料 | 中身 |
|---|---|
| `docs/spec.md` | メインの仕様書（ゲームの機能・画面・フォルダの地図） |
| `docs/monetization.md` | 通貨と課金の設計（コイン・ダイヤ・ガチャ・繁殖・保護区・段階） |
| `docs/iphone-release.md` | iPhone アプリ版と App内課金の手順（外部サービスの設定） |

## 領域ごとの資料（セッションはこの1つだけ読む）
| 領域 | 資料 | Skill |
|---|---|---|
| 開発 | `docs/areas/dev.md` | `dev-flow` |
| アプリ化（iOS） | `docs/areas/ios.md` | `ios-release` |
| モデル作成 | `docs/areas/model.md` | `fish-model`（魚類）・`slug-model`（ウミウシ）・`creature-model`（それ以外） |
| SNS | `docs/areas/sns.md` | `sns-post` |

そのほか：`admin/README.md`（管理者ツール）、`tools/fish-intake/README.md`（魚種追加ツール）、`worker/README.md`（共有 URL の Worker）、`docs/sns/`（SNS の素材と台本）。

## セッション構成
| セッション | 作業フォルダ | 主に使うプレビュー |
|---|---|---|
| 開発 | ワークツリー（作業ごと） | `dev`・`admin` |
| アプリ化（iOS） | ワークツリー | `app-preview` |
| モデル作成（魚類） | 本体のフォルダ（`reference/` があるため） | `model-viewer` |
| モデル作成（ウミウシ） | ワークツリー | `model-viewer` |
| モデル作成（それ以外） | ワークツリー | `model-viewer` |
| SNS | ワークツリー | `dev` |

- 本体のフォルダ（`D:\claude_app\AquariumApp`）を使うのは「モデル作成（魚類）」だけにする。同じフォルダで2つのセッションが別のブランチを使うと、作業が混ざる。
- ワークツリーには `.env.local` が無いので、Web アプリはオフライン（ログインなし）で動く。ログインが要る確認は本体のフォルダか本番で行う。
- 参考画像（`reference/`）は git 管理外。ワークツリーからは本体のフォルダのものを読む（`model-viewer` は自動で探す）。

## デスクトップアプリから開く（`.claude/launch.json`）
| 起動名 | 開くもの | ポート |
|---|---|---|
| `dev` | Web アプリ（ゲーム本体） | 5173 |
| `dev-offline` | Web アプリ（Supabase なし） | 5174 |
| `admin` | 管理者ツール（要：管理者アカウントでログイン） | 5181 |
| `model-viewer` | 生成モデルの確認（全角度ドラッグ・参考画像と並べる） | 5182 |
| `fish-intake` | 魚種追加ツール（参考画像の登録） | 5180 |
| `app-preview` | iPhone アプリ用ビルドの確認（先に `npx vite build --mode app`） | 5177 |
| `prod-web` / `prod-admin` | 本番の Web アプリ / 管理者ツール | — |

Claude に「`dev` を開いて」「`model-viewer` で ○○ を見せて」と頼むと、右のプレビューに出る。

## 資料を新しく保つ仕組み
1. **置き場所を1つにする**：状況は `docs/areas/<領域>.md` の「いまの状態」「次にやること」だけに書く（メモリやセッションの会話に持たない）。
2. **書き換える**：書き足して履歴にしない。各資料は80行以内（`CLAUDE.md` は60行以内）。
3. **PR と一緒に直す**：`npm run docs:check` が、触ったファイルから領域を割り出し、その領域の資料が同じブランチで更新されていなければ知らせる。資料に書いたファイルが無くなっていないか、行数が上限を超えていないかも見る。
4. **自動で思い出す**：`gh pr create` の直前に、フック（`.claude/settings.json`）が同じ確認を走らせ、足りないものを Claude に伝える（止めはしない）。
