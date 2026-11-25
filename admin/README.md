# 生物設定 管理者ツール（ゲームとは別サイト）

魚種のレア度・季節・生息環境・採取地・ひれと泳ぎ・行動などを編集し、Supabase の `game_config` に保存する。
プレイヤーは次にゲームを起動したときに反映される。

## 本番（スマホからも使える）

https://yoshi-ochi.github.io/AquariumApp/admin/

main へのマージで、ゲームと一緒に GitHub Actions が GitHub Pages へ公開する。
誰でもページは開けるが、読み書きは管理者アカウント（`public.admins` に登録したもの）でログインしたときだけ
（`supabase/admin_config.sql` の行レベルセキュリティ）。

## 手元で動かす

```
npm run admin
```

起動時に表示される URL を開く（`--host` 付きなので Tailscale の URL ならスマホ・外出先からも開ける）。
管理者アカウント（`public.admins` に登録したもの）のメールアドレスとパスワードでログインする。

- 静的ファイルにする場合：`npm run admin:build` → `dist-admin/`
- 必要な SQL：`supabase/admin_config.sql`
