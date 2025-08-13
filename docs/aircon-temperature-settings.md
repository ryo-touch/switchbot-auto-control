# エアコン温度設定の変更方法

## 概要

エアコンのオンオフ時の温度設定は、季節に応じて自動的に調整されるようになりました。設定は `/api/config/aircon-settings.js` ファイルで管理されています。

## 現在の設定確認

### ブラウザから確認
1. アプリの「⚙️ 設定」ボタンをクリック
2. 「🌡️ エアコン設定」セクションで現在の設定を確認
3. 「設定を更新」ボタンで最新の設定を取得

### API経由で確認
```bash
# 現在の季節の全設定を確認
curl https://your-domain.netlify.app/api/aircon-settings

# ON時の設定のみ確認
curl "https://your-domain.netlify.app/api/aircon-settings?action=on"

# OFF時の設定のみ確認
curl "https://your-domain.netlify.app/api/aircon-settings?action=off"
```

## 設定変更方法

### 1. 設定ファイルの編集

`/api/config/aircon-settings.js` の `SEASONAL_SETTINGS` オブジェクトを編集します。

#### 夏を涼しくしたい場合
```javascript
summer: {
    on: {
        temperature: 24,  // 26度 → 24度に変更
        mode: AIRCON_MODES.COOL,
        fanSpeed: FAN_SPEEDS.MEDIUM,
        power: 'on'
    },
    // ...
}
```

#### 冬を暖かくしたい場合
```javascript
winter: {
    on: {
        temperature: 25,  // 22度 → 25度に変更
        mode: AIRCON_MODES.HEAT,
        fanSpeed: FAN_SPEEDS.MEDIUM,
        power: 'on'
    },
    // ...
}
```

### 2. モードと風量の変更

#### モード設定
- `AIRCON_MODES.AUTO` (1): 自動
- `AIRCON_MODES.COOL` (2): 冷房
- `AIRCON_MODES.HEAT` (3): 暖房
- `AIRCON_MODES.FAN` (4): 送風
- `AIRCON_MODES.DEHUMIDIFY` (5): 除湿

#### 風量設定
- `FAN_SPEEDS.LOW` (1): 低
- `FAN_SPEEDS.MEDIUM` (2): 中
- `FAN_SPEEDS.HIGH` (3): 高
- `FAN_SPEEDS.AUTO` (4): 自動

### 3. 推奨温度設定

- **夏（冷房）**: 26-28度（環境に優しく、電気代も節約）
- **冬（暖房）**: 20-24度（快適で省エネ）
- **春秋（自動）**: 22-26度（自然な温度調節）

## 現在のデフォルト設定

| 季節 | ON時 | OFF時 |
|------|------|-------|
| 春 | 25度・自動・風量自動 | 25度・自動・風量低 |
| 夏 | 26度・冷房・風量中 | 26度・自動・風量低 |
| 秋 | 24度・自動・風量自動 | 24度・自動・風量低 |
| 冬 | 22度・暖房・風量中 | 22度・自動・風量低 |

## 動作確認

設定変更後は以下で動作確認できます：

1. **フロントエンド**：設定画面で新しい温度設定を確認
2. **手動テスト**：エアコンON/OFFボタンでテスト
3. **自動制御**：位置情報での自動制御をテスト

## ファイル構成

```
api/
├── config/
│   └── aircon-settings.js      # 🌡️ 温度設定ファイル（ここを編集）
├── test-aircon.js              # エアコン手動制御API
├── location-check.js           # 位置情報による自動制御API
└── aircon-settings.js          # 設定確認API
```

## 注意事項

- 温度設定は 16-30度 の範囲で設定してください
- 設定変更後はデプロイが必要です（Netlifyの場合は自動デプロイ）
- SwitchBot APIのパラメータ形式: `"温度,モード,風量,電源"`（例: `"26,2,2,on"`）

## トラブルシューティング

### 設定が反映されない
1. ファイルの記法が正しいか確認
2. Netlifyでデプロイが完了しているか確認
3. ブラウザのキャッシュをクリア

### エラーが発生する
1. `api/aircon-settings` エンドポイントでエラー詳細を確認
2. コンソールログでJavaScriptエラーを確認
3. SwitchBot APIの応答を確認

## 季節の自動判定

現在の月に基づいて自動的に季節を判定します：
- 春：3-5月
- 夏：6-8月
- 秋：9-11月
- 冬：12-2月

特定の季節設定を強制したい場合は、APIに `season` パラメータを追加できます。
