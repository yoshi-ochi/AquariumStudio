# 生物設定 管理者ツール（ゲームとは別サイト）

魚種のレア度・季節・生息環境・採取地・経験値などを編集し、Supabase の `game_config` に保存する。
プレイヤーは次にゲームを起動したときに反映される。ゲーム本体（GitHub Pages）には含まれない。

```
npm run admin
```

起動時に表示される URL を開く（`--host` 付きなので Tailscale の URL ならスマホ・外出先からも開ける）。
管理者アカウント（`public.admins` に登録したもの）のメールアドレスとパスワードでログインする。

- 静的ファイルにする場合：`npm run admin:build` → `dist-admin/`
- 必要な SQL：`supabase/admin_config.sql`
