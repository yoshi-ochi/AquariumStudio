---
name: dev-flow
description: AquariumStudio の Web本体・管理者ツール・サーバー（Supabase・Worker）を開発するときの手順。機能追加・不具合修正・「直して」「実装して」「PRを作って」で使う。返答は日本語。
---

# 開発の手順

最初に `docs/areas/dev.md` だけ読む。仕様の確認が要るときだけ `docs/spec.md` の該当する節を読む（全文は読まない）。

## 1. 着手
1. `git status -sb` で今のブランチと未コミットを確かめる。ほかの作業の変更があれば触らずに報告する。
2. `git fetch origin main` → `git switch -c <feat|fix|chore>/<短い名前> origin/main`。
3. 対応する Issue が無ければ `gh issue create --title "…" --body "…"` で作る。作業中に見つけた別の不具合も Issue にする（その場では直さない）。

## 2. 調べ方（トークン節約）
- まず Grep / Glob で場所を絞り、必要な範囲だけ Read する。大きいファイル（`src/main.js` や `src/ui/` の各画面）は行を指定して読む。
- フォルダの役割は `docs/spec.md` の「フォルダの地図」。
- 原因を特定してから直す。推測で複数の案を試さない。

## 3. 実装
- ロジック・データ・UI・3D を別ファイルに。300行を超えそうなら分ける。既存の構成は作り変えない。
- お金の表示は `src/ui/currency.js` の `coin`（HTML）／`coinText`（文字だけ）。文字として出す所に `coin` を使わない。
- ガラスは `THREE.DoubleSide` と `depthWrite: false`。水槽内の物は水槽のローカルの子。ドロップシャドウは使わない。
- Supabase の SQL を足したら、本番への適用が要ることを PR に書く（適用はユーザー）。

## 4. 確認
1. `npm run build`（管理者ツールを触ったら `npm run admin:build` も）。
2. 画面に出る変更は `preview_start {name: "dev"}`（管理者ツールは `admin`）で開き、操作して確かめる。コンソールのエラーも見る。
3. 確かめられなかったこと（ログインが要る・実機が要るなど）は、そのまま報告と PR に書く。

## 5. 仕上げ
1. `npm run docs:check` を実行し、指摘があれば `docs/areas/dev.md`（仕様が変わったら `docs/spec.md` も）を書き換える。
2. `git commit -m "type(scope): 説明"` → `git push -u origin <branch>` → `gh pr create --title "…" --body "Resolves #<番号>" --web=false`。
3. マージはユーザーの確認を取ってから（main へのマージで本番に公開される）。

## 報告の形
- 変えたこと（ファイルと要点を1〜3行）／確認したこと／確認できなかったこと／PR のリンク。
