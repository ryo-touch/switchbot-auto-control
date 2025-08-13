# 本番確認 - クイックスタートガイド

## 🚀 即座に確認すべき項目

### 1. 環境変数設定（最優先）
Netlify管理画面で以下を設定:

```env
SWITCHBOT_TOKEN=your_token
SWITCHBOT_SECRET=your_secret
HOME_LATITUDE=35.6762
HOME_LONGITUDE=139.6503
TRIGGER_DISTANCE_METERS=500
```

### 2. APIクイックテスト

```bash
# デバイス一覧確認
curl https://glittering-puffpuff-24595b.netlify.app/.netlify/functions/devices

# エアコン制御テスト
curl -X POST https://glittering-puffpuff-24595b.netlify.app/.netlify/functions/test-aircon \
  -H "Content-Type: application/json" \
  -d '{"action":"turnOff"}'
```

### 3. PWA動作確認
- https://glittering-puffpuff-24595b.netlify.app にアクセス
- インストールプロンプト確認
- 位置情報許可テスト

## ⚠️ 既知の注意点
- SwitchBot API は statusCode 190 を返すが正常動作
- 環境変数設定後は必ず再デプロイが必要

## 📋 完了チェックリスト
- [ ] 環境変数設定完了
- [ ] 3つのAPI動作確認
- [ ] PWA機能確認
- [ ] 実機でのエアコン制御確認

詳細は `production-handover.md` を参照してください。
