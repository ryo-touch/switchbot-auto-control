# PWA実装仕様書 - SwitchBot位置情報自動制御システム

## 🎯 プロジェクト概要

**目的:** iPhoneが自宅から100m離れた時に、SwitchBot Hub2経由でエアコンを自動停止するPWAアプリケーション
**モチベーション:** ちょっとした数分程度の外出ではエアコンのオンオフはしないほうが電気代に良いとニュースで確認した。そのため、外出のたびに毎回自動でエアコンをオフにするのではなく都度ユーザ（=制作者）に確認を求めるようにしたいと思った。

**技術スタック:**
- フロントエンド: HTML5, CSS3, Vanilla JavaScript
- バックエンド: Node.js (Vercel Functions)
- API: SwitchBot API v1.1, Geolocation API
- デプロイ: Vercel

## 📋 機能要件

### 1. 位置情報監視機能
- **継続的な位置情報取得** (navigator.geolocation.watchPosition)
- **距離計算**: ハーバシンの公式で自宅からの距離を算出
- **トリガー判定**: 100m超過時にエアコン制御APIを呼び出し
- **精度設定**: enableHighAccuracy: true, maximumAge: 60秒

### 2. SwitchBot API連携
- **認証**: HMAC-SHA256署名による API v1.1 認証
- **デバイス制御**: エアコンの電源OFF操作
- **エラーハンドリング**: API呼び出し失敗時の適切な処理

### 3. PWA機能
- **オフライン対応**: Service Worker実装
- **ホーム画面追加**: マニフェストファイル
- **プッシュ通知**: 制御実行時の通知表示
- **バックグラウンド動作**: 可能な範囲でのバックグラウンド処理

### 4. ユーザーインターフェース
- **リアルタイム表示**: 現在位置、距離、ステータス
- **手動制御**: 監視の開始/停止ボタン
- **設定画面**: API設定、位置設定の変更機能
- **ログ表示**: 実行履歴の確認

## 🏗️ システム構成

```
PWA Frontend (iPhone Safari)
├── index.html (メインUI)
├── manifest.json (PWA設定)
├── sw.js (Service Worker)
├── app.js (メインロジック)
└── style.css (スタイル)

Vercel Backend
├── api/
│   ├── location-check.js (位置チェック + SwitchBot制御)
│   ├── devices.js (SwitchBotデバイス一覧取得)
│   └── test-aircon.js (エアコンテスト制御)
└── package.json
```

## 📁 ファイル構成と要件

### `/public/index.html`
```html
要件:
- PWA対応のメタタグ設定
- 位置情報許可のプロンプト表示
- リアルタイム情報表示エリア
  - 現在の緯度・経度
  - 自宅からの距離（m）
  - 監視ステータス（監視中/停止中/エラー）
  - 最後の制御実行時刻
- 操作ボタン
  - 監視開始/停止
  - 手動エアコンOFF
  - 設定画面へのリンク
- レスポンシブデザイン（iPhone向け最適化）
```

### `/public/manifest.json`
```json
要件:
- アプリ名: "SwitchBot自動制御"
- アイコン: 192x192, 512x512サイズ
- display: "standalone"
- start_url: "/"
- theme_color, background_color設定
```

### `/public/sw.js` (Service Worker)
```javascript
要件:
- キャッシュ戦略の実装
- オフライン時のフォールバック
- バックグラウンド同期（可能な範囲で）
- プッシュ通知の受信処理
```

### `/public/app.js` (メインアプリケーション)
```javascript
要件:
- クラス設計: LocationMonitor, SwitchBotAPI, UIController
- 位置情報監視の開始/停止
- 距離計算関数（ハーバシンの公式）
- API通信処理
- 設定の永続化（localStorage）
- エラーハンドリング
- 通知表示
```

### `/api/location-check.js` (Vercel Function)
```javascript
要件:
- POSTメソッドで緯度・経度を受信
- 自宅座標との距離計算
- 100m超過時にSwitchBot API呼び出し
- エラー時の適切なレスポンス
- 環境変数からAPI設定読み込み
```

### `/api/devices.js` (デバイス一覧取得)
```javascript
要件:
- SwitchBot API v1.1でデバイス一覧取得
- デバイスIDの取得支援
- 認証ヘッダーの自動生成
```

## 🔧 技術仕様

### SwitchBot API v1.1認証
```javascript
要件:
- トークン・シークレットは環境変数で管理
- タイムスタンプ・Nonce生成
- HMAC-SHA256署名の実装
- 必要ヘッダー: Authorization, sign, t, nonce
```

### 位置情報取得オプション
```javascript
const options = {
  enableHighAccuracy: true,  // 高精度GPS使用
  timeout: 10000,           // 10秒タイムアウト
  maximumAge: 60000         // 1分間キャッシュ
};
```

### エアコン制御コマンド
```javascript
要件:
- command: "setAll"
- parameter: "off" (電源OFF)
- commandType: "command"
- デバイスID: 環境変数から読み込み
```

### 距離計算（ハーバシンの公式）
```javascript
要件:
- 地球半径: 6371000m
- 緯度・経度をラジアンに変換
- Math.atan2, Math.sin, Math.cos使用
- 結果をメートル単位で返却
```

## 🎨 UI/UX要件

### デザイン
- **カラーテーマ**: iOS風のシンプルデザイン
- **フォント**: システムフォント優先
- **アイコン**: 直感的な絵文字またはSVGアイコン
- **レイアウト**: カード型レイアウト、適度な余白

### ユーザビリティ
- **起動時**: 自動で位置情報許可を求める
- **状態表示**: 色分けでステータスを直感的に表示
  - 🟢 監視中・正常
  - 🟡 警告・待機中
  - 🔴 エラー・停止中
- **フィードバック**: 操作時の適切なフィードバック表示

## ⚙️ 環境変数

### 必須環境変数（Vercel）
```bash
SWITCHBOT_TOKEN=        # SwitchBotアプリから取得
SWITCHBOT_SECRET=       # SwitchBotアプリから取得
AIRCON_DEVICE_ID=       # エアコンのデバイスID
HOME_LATITUDE=          # 自宅の緯度
HOME_LONGITUDE=         # 自宅の経度
TRIGGER_DISTANCE=100    # トリガー距離（メートル）
```

## 🔒 セキュリティ要件

### API セキュリティ
- **認証情報**: フロントエンドに秘匿情報を含めない
- **CORS設定**: 適切なOrigin制限
- **レート制限**: API呼び出し頻度の制限
- **入力検証**: 緯度・経度の妥当性チェック

### 位置情報プライバシー
- **許可確認**: 位置情報アクセス前の明確な説明
- **データ保持**: 位置履歴の最小限保持
- **暗号化**: 通信時のHTTPS必須

## 📱 PWA要件

### インストール可能性
- **マニフェスト**: 完全なmanifest.json
- **Service Worker**: 最低限のキャッシュ機能
- **HTTPS**: 必須（Vercelで自動対応）

### ネイティブライク体験
- **スプラッシュ画面**: アプリ起動時の適切な表示
- **ステータスバー**: iOS Safari UIとの調和
- **戻るボタン**: ブラウザの戻るボタン対応

## 🧪 テスト要件

### 必須テスト項目
1. **位置情報取得**: GPS ON/OFF状態での動作確認
2. **距離計算**: 既知の座標での計算精度確認
3. **API通信**: SwitchBot API の正常/異常系確認
4. **PWA機能**: インストール、オフライン動作確認
5. **通知機能**: 各種通知の表示確認

### テスト用機能
- **デバッグモード**: 詳細ログ表示
- **位置情報モック**: テスト用座標の設定
- **API テスト**: 手動でのAPI呼び出し確認

## 📊 ログ・監視要件

### 必須ログ
- 位置情報取得ログ（タイムスタンプ、座標、距離）
- API呼び出しログ（成功/失敗、レスポンス）
- エラーログ（詳細なエラー情報）

### ユーザー向け表示
- 実行履歴（最新10件程度）
- 統計情報（今日の制御回数など）

## 🚀 デプロイ要件

### Vercel設定
```json
{
  "functions": {
    "api/*.js": {
      "runtime": "nodejs18.x"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" }
      ]
    }
  ]
}
```

### 必須ファイル
- `package.json` (依存関係定義)
- `vercel.json` (Vercel設定)
- `.env.example` (環境変数テンプレート)
- `README.md` (セットアップ手順)

## 📝 エラーハンドリング仕様

### 位置情報エラー
- `PERMISSION_DENIED`: 再許可の案内
- `POSITION_UNAVAILABLE`: GPS設定確認の案内
- `TIMEOUT`: リトライ処理

### API エラー
- `401 Unauthorized`: 認証情報確認の案内
- `404 Device Not Found`: デバイスID確認の案内
- `429 Rate Limited`: 待機時間の表示
- `500 Server Error`: 再試行処理

## 💡 実装上の注意点

### iPhone Safari特有の制約
- **バックグラウンド制限**: アプリがアクティブな時のみ確実動作
- **PWA制限**: 一部ネイティブ機能の制限あり
- **位置情報精度**: 建物内での精度低下に注意

### パフォーマンス考慮
- **バッテリー消費**: 位置情報更新頻度の最適化
- **API呼び出し制限**: SwitchBot APIの1日1000回制限
- **メモリ使用量**: 長時間動作時のメモリリーク防止

以上の仕様に基づいて、GitHub Copilot Agentに実装を依頼してください。
不明な点があれば詳細を確認いたします。
