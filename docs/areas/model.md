# モデル作成（魚類・ウミウシ・それ以外）

最終更新：2026-11-29

## 分け方（作り方が違うので Skill とセッションを3つに分ける）
| 分類 | 作り方 | Skill | 主なファイル |
|---|---|---|---|
| 魚類（＋ウミガメ・イルカなど輪郭をなぞる種） | 参考画像のトレース（Python の生成スクリプト） | `fish-model` | `src/expedition/creatureAnatomyPhotoNN.js` |
| ウミウシ | 三角形での組み立て（面の数を抑える） | `slug-model` | `src/expedition/creatureSlug.js` |
| それ以外（クラゲ・イカ・タコ・甲殻類・カブトガニなど） | 部品の組み立て | `creature-model` | `src/expedition/creatureSoft.js` |

## いまの状態
- 本番の生き物は161種。追加予定でモデル待ちは418種（魚類 約320、海獣20、甲殻類21、ウミガメ12、両生類・爬虫類・鳥23、頭足類12、クラゲ5）。
- トレースの最新は第25弾（`creatureAnatomyPhoto25.js`、生成は `reference/fish/_gen/gen25.py`）。次は第26弾。
- ウミウシは試作のホホベニモウミウシ（`hohobenimo`、三角形522枚）を公開済み。
- 保留（ユーザーが解くまで作らない）：キタマクラ、キハダ、シノノメサカタザメ、セミエビ（トレースは `_gen/gen25_hold_semiebi.py`）、イイダコ。
- 参考画像の差し替え待ち：クエ（青く斜め）、ソラスズメダイ（別種に見える）、サザナミヤッコ（斜め）、アカククリ（ぼやけ・緑かぶり）、ヘコアユ（2匹重なり）。
- リストに無い種は、管理者ツールの「モデル待ち」タブで和名だけで仮登録できる。`npm run species:pull` が「情報が未補完」と出すので、モデルの前に情報を調べて `npm run species:add` で追加予定種に加える（手順は `docs/species-add.md`）。
- 参考画像の貼り付け登録（PR #97 の内容）は main に入っている。

## 次にやること
- 画像が届いた未作成の種を、「追加予定（採取地あり）」から順に作る（`npm run species:pull` で取り込む）。
- 和名だけの種（`npm run species:add -- --pending`）は、情報を補ってから作る。補った値は報告に一覧で出す。

## 決まりごと（3分類に共通）
- 参考画像が届いた種だけ作る。メイン画像はユーザーが選ぶ（Claude が選び直さない）。`memo.txt` は必ず読む。
- 総称（属・科レベル）の種は作らない（和名だけの仮登録が総称なら、情報を補わずに報告して止める）。他社ゲーム・作品の絵に見える画像はトレースしない（ユーザーに確認する）。
- 形態の特徴（体形・模様・ひれ・雌雄差など）を毎回調べ、調べたことと反映したことを報告する。
- 参考画像は計測にだけ使い、アプリに組み込まない（`reference/` は git 管理外）。
- 確認は `model-viewer`（右のプレビューで全角度ドラッグ、参考画像と並べる）。ユーザーの確認をもらってから本番へ。
- 本番への流れ：`npm run build` → `npm run species:release`（公開日の記録）→ ブランチ → PR → マージで公開。
- 卵ガチャ限定種（`src/gacha/gachaSpecies.js`）も画像が届いた種だけ作る。

## ユーザーから受けた作り方の指示（次も守る）
- 細かすぎる格子は「リアルすぎる」と却下（84×36 は不可。チョウチョウウオ類は 21×9 ほど＋縞は `decals`）。
- 平たい種（アンコウ類）は上面図（`topView`）で作る。目は赤い縁取りより瞳の色（`eye.pupilHex`）で表す。
- ウミウシの背の突起は、平たい葉ではなくふっくらした紡錘形が既定。ほほの斑のような模様は浮かせず体の面に貼る。面の数はできるだけ抑える。

## 関連ファイル
- 種のデータ：`src/expedition/speciesRoster.js`（予定種）、`speciesPlannedJapan.js`・`speciesPlannedReef.js`・`speciesPlannedWorld.js`、`speciesReleases.js`（公開日）
- 組み立ての入口：`src/expedition/creatureBuilder.js`、行動は `behaviorData.js`
- 取り込み：`tools/species-pull.mjs`、`tools/fish-intake/README.md`、管理者ツールの「モデル待ち」タブ（`src/admin/adminModeling.js`・`src/admin/modelingAdd.js`）
- 和名だけの種の補完：`docs/species-add.md`、`tools/species-add.mjs`（検証と追記）、`tools/species-lib.mjs`、`src/admin/intakeNames.js`
- 確認：`tools/model-viewer/`（`npm run viewer`、起動名 `model-viewer`）
