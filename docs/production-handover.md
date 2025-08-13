# 本番環境動作確認 - 引き継ぎ資料

## プロジェクト概要

### システム名
SwitchBot位置連動エアコン自動制御システム

### 目的
ユーザーの位置情報に基づいてSwitchBotエアコンを自動制御するPWAアプリケーション

### 技術スタック
- **フロントエンド**: PWA (HTML, CSS, JavaScript)
- **バックエンド**: Netlify Functions (Node.js)
- **外部API**: SwitchBot API v1.1
- **認証**: HMAC-SHA256署名

## デプロイ情報

### 本番環境URL
```
https://ryo-touch-switchbot-app.netlify.app/
```

### プロジェクト名
- Netlify: `glittering-puffpuff-24595b`
- GitHub: `switchbot-auto-control` (Owner: ryo-touch)

### デプロイ状況
- ✅ デプロイ成功
- ✅ 本番環境稼働中
- ⚠️ 環境変数設定待ち
- ⚠️ 本番動作確認待ち

## API エンドポイント一覧

### 1. デバイス一覧取得
```
GET https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/devices
```
**目的**: SwitchBotデバイス一覧を取得し、エアコンを識別

**期待レスポンス**:
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "xxx",
      "deviceName": "エアコン",
      "deviceType": "Air Conditioner"
    }
  ]
}
```

### 2. 位置ベース制御（メイン機能）
```
POST https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/location-check
Content-Type: application/json

{
  "latitude": 35.6762,
  "longitude": 139.6503
}
```
**目的**: 位置情報に基づいてエアコンを自動制御

**期待動作**:
- 自宅から500m以内: エアコン停止
- 自宅から500m以上: 制御なし

### 3. 手動エアコン制御
```
POST https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/test-aircon
Content-Type: application/json

{
  "action": "turnOff"
}
```
**目的**: 手動でエアコンを制御（テスト用）

**利用可能アクション**:
- `turnOn`: エアコンON
- `turnOff`: エアコンOFF

## 環境変数設定（要対応）

### Netlify管理画面での設定が必要
以下の環境変数をNetlify > Site settings > Environment variables で設定:

```
SWITCHBOT_TOKEN=your_switchbot_token_here
SWITCHBOT_SECRET=your_switchbot_secret_here
HOME_LATITUDE=35.6762
HOME_LONGITUDE=139.6503
TRIGGER_DISTANCE_METERS=500
```

### 設定手順
1. Netlify管理画面にログイン
2. プロジェクト `glittering-puffpuff-24595b` を選択
3. Site settings → Environment variables
4. 上記の変数を追加
5. サイトを再デプロイ

## 動作確認手順

### Phase 1: 基本接続確認
```bash
# 1. デバイス一覧取得テスト
curl -X GET "https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/devices"

# 期待結果: SwitchBotデバイス一覧が返却される
```

### Phase 2: エアコン制御テスト
```bash
# 2. 手動エアコンOFF制御
curl -X POST "https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/test-aircon" \
  -H "Content-Type: application/json" \
  -d '{"action": "turnOff"}'

# 期待結果: エアコンが停止する
```

### Phase 3: 位置ベース制御テスト
```bash
# 3. 自宅近く（500m以内）のテスト
curl -X POST "https://ryo-touch-switchbot-app.netlify.app/.netlify/functions/location-check" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 35.6762, "longitude": 139.6503}'

# 期待結果: エアコンが自動停止される
```

### Phase 4: フロントエンド動作確認
1. `https://glittering-puffpuff-24595b.netlify.app` にアクセス
2. PWAとしてインストール可能かチェック
3. 位置情報許可の動作確認
4. エアコン制御ボタンの動作確認

## エラー対応

### よくあるエラー

#### 1. 環境変数未設定エラー
```json
{
  "success": false,
  "error": "Missing required environment variables"
}
```
**対応**: 環境変数をNetlify管理画面で設定後、再デプロイ

#### 2. SwitchBot API認証エラー
```json
{
  "success": false,
  "error": "SwitchBot API authentication failed",
  "statusCode": 401
}
```
**対応**: SwitchBotトークンとシークレットを確認

#### 3. CORS エラー
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**対応**: 既にCORSヘッダーは設定済み。ブラウザキャッシュクリア後再試行

### デバッグ用ツール

#### ローカルテストランナー
```bash
cd /Users/ryosakai/Documents/github_repo/switchbotApp
npm run test
```

#### ログ確認
- Netlify管理画面 > Functions > 各関数のログを確認
- リアルタイムログ監視可能

## セキュリティ確認事項

### ✅ 実装済み
- HMAC-SHA256による API署名認証
- CORS設定
- 環境変数による認証情報保護
- レート制限対応
- エラーハンドリング

### 確認項目
- [ ] 環境変数が本番環境で正しく設定されているか
- [ ] SwitchBot API呼び出しが正常に動作するか
- [ ] PWA機能（オフライン動作、インストール）が正常か
- [ ] 位置情報取得許可が適切に動作するか

## 完了報告フォーマット

### テスト結果報告
```
## 本番環境動作確認結果

### 環境設定
- [ ] 環境変数設定完了
- [ ] デプロイ正常完了

### API動作確認
- [ ] /devices エンドポイント: 正常/異常
- [ ] /test-aircon エンドポイント: 正常/異常
- [ ] /location-check エンドポイント: 正常/異常

### フロントエンド確認
- [ ] PWAアクセス: 正常/異常
- [ ] 位置情報取得: 正常/異常
- [ ] UI操作: 正常/異常

### 実機テスト
- [ ] SwitchBotエアコン制御: 正常/異常
- [ ] 位置ベース自動制御: 正常/異常

### 問題・課題
（発見された問題があれば記載）

### 推奨事項
（改善提案があれば記載）
```

## 連絡先・参考資料

### 技術仕様書
- `docs/app-js-implementation-guide.md`
- `docs/PWA-Implementation-Specification.md`

### 前任者からの引き継ぎ
- 全5フェーズの実装完了
- ローカル環境での動作確認済み（5/5テスト成功）
- Git履歴に実装過程が記録済み

---

**次のパイロットへ**: 環境変数設定と本番動作確認をお願いします。何か問題があれば上記のデバッグ手順を参考にしてください。
