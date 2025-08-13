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

```
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

## 🔧 開発

### ブランチ戦略

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

## 📄 ライセンス

MIT License

---

詳細な実装仕様については、[PWA実装仕様書](docs/PWA-Implementation-Specification.md)を参照してください。
