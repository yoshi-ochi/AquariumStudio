---
name: creature-model
description: 魚類とウミウシ以外の生き物（クラゲ・イカ・タコ・エビ・カニ・カブトガニ・チンアナゴ・両生類・鳥など、輪郭をなぞらない種）の3Dモデルを部品の組み立てで作るときの手順とルール。「クラゲを作って」「カニの画像が届いた」で使う。返答は日本語。
---

# 魚類・ウミウシ以外のモデル作成（組み立て）

最初に `docs/areas/model.md` を読む（共通の決まり・保留・ユーザーの指示）。

## 0. どの作り方にするか
| 生き物 | 作り方 | Skill |
|---|---|---|
| 横から見た輪郭で形が決まる種（魚・サメ・エイ・ウミガメ・イルカ・アシカなど） | トレース | `fish-model`（ウミガメは `topView`、水平な尾びれは `plates`） |
| ウミウシ | 三角形の組み立て | `slug-model` |
| クラゲ・イカ・タコ・甲殻類・カブトガニ・チンアナゴ・タツノオトシゴ、手足のある種 | 部品の組み立て | この Skill |

迷ったら、参考画像の向きで決める（真横の全身写真があればトレース、無ければ組み立て）。

## 1. 作り始めてよい条件
- 参考画像が届いた種だけ（`reference/fish/<和名>/main.*`、補助 `ref-*`、指示 `memo.txt`）。`memo.txt` は必ず読む。
- 総称の種は作らない。保留の種（`docs/areas/model.md`）はユーザーが解くまで作らない。

## 2. 形態の調査（毎回）
- 体の区分（傘と口腕・外套と腕・甲と脚）、脚や腕の本数と長さの比、色と模様、発光の有無、全長を調べ、報告に書く。

## 3. 作り方
- 体形の関数は `src/expedition/creatureSoft.js`（カニ・エビ・タコ・ヒラメ・タツノオトシゴ・チンアナゴ・コウイカ・カブトガニ）。クラゲは `src/expedition/creatureBuilder.js` の `jellyParts`。全長1に正規化。
- 使える部品（`helpers`）：`grid`（曲面）、`fin`（薄い膜）、`solid`（球や円柱などの塊）、`tint`。細い脚は `rod`、目は `eyes`。
- **まず既存の体形で作れないか見る**：種のデータ（`c`）の値で作り分ける（例：`longLegs`、`ringBands`、色、`len`）。足りない違いだけを、値で切り替える分岐として足す。
- 新しい体形が要るとき：
  1. 関数を書き、`BUILDERS` に体形名で登録する。`creatureSoft.js` が300行を超えるので、新しい体形は別ファイル（例 `creatureSoftXxx.js`）に置いて import する。
  2. 底で暮らす種は `BENTHIC_FORMS`、動かない種は `STATIONARY_FORMS` に足す。
  3. 行動は `src/expedition/behaviorData.js`（体形ごとの既定・種ごとの上書き・`GROUND`）。
- 種のデータ（`src/expedition/speciesRoster.js` と `speciesPlannedJapan.js`・`speciesPlannedReef.js`・`speciesPlannedWorld.js`）に `model: true` を付けると本番に出る。保留に戻すときは `model: true` を外す。
- 発光する種は anatomy の `glow`（`pts`・`hex`・`halo`）。水槽が暗いほど強く光る。
- 面の数は控えめに（球は分割を少なく）。水槽に群れで入る種ほど軽くする。

## 4. 確認（右のプレビュー）
1. `preview_start {name: "model-viewer"}` → `/?id=<id>`。ドラッグで全角度、参考画像と並べて比べる。「泳ぐ」で動きも見る。
2. スクリーンショットをユーザーに見せ、**確認をもらってから**本番へ。

## 5. 本番へ
1. `npm run build` → `npm run species:release`。
2. `npm run docs:check` → `docs/areas/model.md` の「いまの状態」を書き換える。
3. ブランチ → コミット（`feat(fish): ○○を追加`）→ push → PR。マージはユーザーの確認後。

## 報告の形
- 作った種：和名（id）／使った体形（既存・新規）
- 調べた特徴と反映（1行ずつ）
- 未確認のこと
