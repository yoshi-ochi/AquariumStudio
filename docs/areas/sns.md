# SNS

最終更新：2026-11-28

## いまの状態
- 使う SNS は Instagram と Threads の2つだけ（X・TikTok・YouTube は使わない）。
- 表示名「アクスタ｜水族館づくりゲーム」。アイコンは夜の紺の円形水槽（`docs/sns/headers/profile_icon_1024.png`）。設定の文面は `docs/sns/profiles.md`。
- 最初のリール「空っぽの水槽に、3匹がやってくる」は台本（`docs/sns/reel-01.md`）と動画・表紙（`docs/sns/reel-01/`、git 管理外）まで出来ている。投稿したかどうかは未確認。
- リールのコマは `tools/reel/reel01.js` で作る（開発サーバーのブラウザで撮り、ffmpeg で MP4 にする）。

## 次にやること
- PR #110（岩の切り口）がマージされたら、リールを撮り直す（岩の切り口がきれいになる）。
- リールの投稿と、同じ日の Threads の投稿（文面は `docs/sns/reel-01.md`）。
- 2本目以降のリールの企画（新種の紹介・癒しの水槽）。

## 決まりごと
- 出すもの：Instagram はリール（毎日1本）とストーリーズ、Threads は開発日記・お知らせ・`#マイ水槽` の紹介（1日1〜3回）。
- ハッシュタグ：`#アクスタ` `#マイ水槽` `#水族館` `#アクアリウム` `#個人開発` `#indiegame`。
- リールは縦 9:16（1080×1920）。文字は中央寄り（上220px・下420px は隠れるので置かない）。声は入れない。
- リンクには SNS ごとの `utm_source` を付ける（`docs/sns/profiles.md`）。
- 投稿・アカウントの設定変更は Claude が行わない。文面と素材を用意し、投稿はユーザーが行う。
- ゲームの画面にない機能や、未公開の生き物を「遊べる」と書かない。
- iPhone 版が出たら、リンクと自己紹介を変える（`docs/sns/profiles.md` の末尾）。

## 関連ファイル
- 設定と台本：`docs/sns/profiles.md`、`docs/sns/reel-01.md`
- 素材：`docs/sns/headers/`、`docs/sns/icon-candidates/`（動画と音は git 管理外）
- 撮影の道具：`tools/reel/reel01.js`、`tools/adVideo/recordAd.js`、`tools/showcase/buildShowcase.js`

## 起動
- `dev`（5173）を開き、ブラウザのコンソールから撮影の道具を読み込む（使い方は各ファイルの先頭）。
