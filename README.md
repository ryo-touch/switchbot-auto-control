# SwitchBot位置情報自動制御システム

iPhoneが自宅から100m離れた時に、SwitchBot Hub2経由でエアコンを自動停止するPWAアプリケーション

## 🎯 概要

- **目的**: 外出時のエアコン自動制御
- **特徴**: 位置情報ベースでのSwitchBotデバイス制御
- **対象**: iPhone Safari（PWA対応）

## 🛠️ 技術スタック

- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript
- **バックエンド**: Node.js (Netlify Functions)
- **API**: SwitchBot API v1.1, Geolocation API
- **デプロイ**: GitHub Pages（フロントエンド）+ Netlify Functions（API）

## 📁 プロジェクト構成

```text
/
├── public/           # PWAフロントエンド
│   ├── index.html   # メインUI
│   ├── manifest.json # PWA設定
│   ├── sw.js        # Service Worker
│   ├── app.js       # メインロジック
│   ├── style.css    # スタイル
│   └── icons/       # PWAアイコン
├── api/             # Netlify Functions
│   ├── devices.js           # デバイス一覧取得
│   ├── location-check.js    # 位置チェック + 制御
│   └── test-aircon.js       # エアコンテスト制御
├── .github/workflows/       # GitHub Actions
│   ├── deploy.yml          # PWAデプロイ
│   └── deploy-api.yml      # APIデプロイ
├── docs/            # ドキュメント
├── .env.example     # 環境変数テンプレート
├── package.json     # 依存関係
└── netlify.toml     # Netlify設定
```

## 🚀 セットアップ

### 1. 環境変数設定

```bash
cp .env.example .env
```

`.env`ファイルを編集して、以下の情報を設定：

- `SWITCHBOT_TOKEN`: SwitchBotアプリから取得
- `SWITCHBOT_SECRET`: SwitchBotアプリから取得
- `AIRCON_DEVICE_ID`: エアコンのデバイスID
- `HOME_LATITUDE`: 自宅の緯度
- `HOME_LONGITUDE`: 自宅の経度

### 2. 依存関係インストール

```bash
npm install
```

### 3. 開発サーバー起動

```bash
npm run dev
```

### 4. デプロイ

#### フロントエンド（GitHub Pages）
1. GitHubリポジトリにプッシュ
2. GitHub Actionsが自動でGitHub Pagesにデプロイ

#### API（Netlify Functions）
1. Netlifyでサイト作成
2. GitHub Secretsに環境変数設定：
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`
   - `SWITCHBOT_TOKEN`
   - `SWITCHBOT_SECRET`
   - `AIRCON_DEVICE_ID`
   - `HOME_LATITUDE`
   - `HOME_LONGITUDE`
   - `TRIGGER_DISTANCE`
3. APIファイル変更時に自動デプロイ

## 📱 使用方法

1. PWAアプリにアクセス
2. 位置情報許可を承認
3. 監視開始ボタンをタップ
4. 自宅から100m離れると自動でエアコンが停止

## 🧪 テスト

### ローカルテスト

```bash
# 環境変数を設定
cp .env.example .env
# .envファイルを編集して実際の値を設定

# APIテスト実行
npm run test

# 個別テスト
npm run test:api
```

### Netlify Dev（推奨）

```bash
# Netlify開発環境起動
npm run dev:api

# ブラウザでアクセス
open http://localhost:8888
```

- `main`: 本番環境用
- `develop`: 開発統合用
- `feature/*`: 機能別開発

### コミット規約

```bash
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
style: コードスタイル修正
refactor: リファクタリング
test: テスト追加・修正
chore: 設定・ツール修正
```

## � トラブルシューティング

## 重要：190エラーについて

**190 ステータスコードは正常動作です！**

Hub2の赤外線デバイス（エアコン等）では、デバイスの状態履歴がサーバーと同期されていないため、`statusCode: 190` が返されます。これは**エラーではなく、正常な動作**です。

### エアコン制御の重要な修正

🔧 **2025-08-13 修正完了**

従来の `turnOn`/`turnOff` コマンドではエアコンが物理的に動作しませんでした。SwitchBot公式API仕様に基づき、エアコンには **`setAll` コマンド**を使用するよう修正しました：

```javascript
// ❌ 従来（動作しない）
{
    command: 'turnOff',
    parameter: 'default',
    commandType: 'command'
}

// ✅ 修正後（動作する）
{
    command: 'setAll',
    parameter: '26,1,1,off',  // 温度,モード,風量,電源状態
    commandType: 'command'
}
```

### setAllパラメータ仕様
- **temperature**: 温度（例：26）
- **mode**: 0/1=自動, 2=冷房, 3=除湿, 4=送風, 5=暖房
- **fan speed**: 1=自動, 2=低, 3=中, 4=高
- **power state**: `on`=電源ON, `off`=電源OFF

## 🚀 Netlify デプロイメントガイド

### ローカルで成功、Netlify で失敗する原因と対策

**問題**: ローカルではエアコン制御が成功するが、Netlify アプリケーションでは失敗する

**原因**:
1. **環境設定の違い**: ローカル（.env ファイル）vs Netlify（環境変数設定）
2. **タイムアウト**: Netlify Functions は 10秒制限
3. **コマンド形式**: setAll コマンドへの修正が必要

**解決済み修正**:
- ✅ すべての API ファイルから `dotenv` 削除
- ✅ エアコン制御を `setAll` コマンドに修正
- ✅ 診断機能の簡素化（タイムアウト対策）

### Netlify 環境変数設定

Netlify Dashboard > Site settings > Environment variables で以下を設定：

```
SWITCHBOT_TOKEN=your_token_here
SWITCHBOT_SECRET=your_secret_here
AIRCON_DEVICE_ID=your_device_id_here
HOME_LATITUDE=your_latitude_here
HOME_LONGITUDE=your_longitude_here
TRIGGER_DISTANCE=100
```

## �📄 ライセンス

MIT License

---

詳細な実装仕様については、[PWA実装仕様書](docs/PWA-Implementation-Specification.md)を参照してください。
