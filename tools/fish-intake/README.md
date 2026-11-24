# 魚種追加ツール（開発者用）

ゲーム本体とは別のサイト。スマホ・タブレットから魚種を選んで参考画像を送ると、この PC の `reference/fish/<和名>/` に保存される。

```
npm run fish-intake
```

起動時に表示される `?t=` 付きの URL を開く（Tailscale の URL ならスマホから外出先でも開ける）。

## 保存される形
- `reference/fish/<和名>/main.jpg` … メインの参考画像（モデルの輪郭・体色の基準）
- `reference/fish/<和名>/ref-*.jpg` … 他の角度などの補助画像
- `reference/fish/<和名>/memo.txt` … Claude への指示メモ
- `reference/fish/_custom.json` … リスト外から追加した魚種
- 以前の形式 `reference/fish/<和名>.png` もメイン画像として扱う

## 追加予定種と本番への公開
- `src/expedition/speciesRoster.js` の追加予定種は、このツールで「追加予定（採取地あり）」として先頭に並ぶ
- モデルを作る（`ANATOMY[id]` を追加、または組み立ての体なら `model: true`）と、その種は自動で本番の魚種・採取地に加わる
- `npm run species:release` で公開日を記録して main へマージ → GitHub Pages に公開 → ログイン時に「新しく追加された生き物」として案内される
- 捕れる種が3種そろうまで、その採取地は地図に出ない（例：アマゾン川）
