# app.js実装方針と引き継ぎドキュメント

## 📋 現在の状況

### ✅ 完了済み
- **プロジェクト基盤**: Git初期化、GitHub リポジトリ作成済み
- **PWA基盤ファイル**: manifest.json, index.html, style.css, sw.js 実装完了
- **開発環境**: http-server起動中 (http://127.0.0.1:3000)
- **デプロイ設定**: GitHub Actions, Netlify Functions設定済み

### 🎯 次のタスク: app.js実装

## 📁 app.js実装方針

### 🏗️ アーキテクチャ設計

#### クラス構成
```javascript
// 1. LocationMonitor クラス
// - 位置情報の継続監視
// - 距離計算（ハーバシンの公式）
// - トリガー判定

// 2. SwitchBotAPI クラス
// - API通信の管理
// - エラーハンドリング
// - レート制限対応

// 3. UIController クラス
// - DOM操作の集約
// - 状態表示の更新
// - イベントハンドリング

// 4. AppController クラス
// - 全体のオーケストレーション
// - 設定管理
// - ログ管理
```

### 🔧 実装すべき機能

#### 1. 位置情報監視機能
```javascript
// 要件:
// - navigator.geolocation.watchPosition使用
// - enableHighAccuracy: true, maximumAge: 60秒
// - エラーハンドリング (PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT)
// - 継続的な監視の開始/停止制御
```

#### 2. 距離計算機能
```javascript
// ハーバシンの公式実装
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 地球半径(m)
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // メートル単位
}
```

#### 3. API通信機能
```javascript
// エンドポイント:
// - POST /api/location-check (位置チェック + 制御)
// - GET /api/devices (デバイス一覧)
// - POST /api/test-aircon (手動制御)

// 要件:
// - CORS対応
// - エラーハンドリング
// - レート制限対応
// - リトライ機能
```

#### 4. UI制御機能
```javascript
// DOM要素の更新:
// - #currentLocation (現在位置表示)
// - #distanceFromHome (距離表示)
// - #monitoringStatus (監視状態)
// - #lastControl (最後の制御時刻)
// - #statusDot, #statusText (接続状態)
// - #logContainer (ログ表示)

// イベントハンドリング:
// - #toggleMonitoringBtn (監視開始/停止)
// - #manualControlBtn (手動制御)
// - #settingsBtn (設定モーダル)
// - #saveSettingsBtn, #cancelSettingsBtn
```

#### 5. 設定管理機能
```javascript
// localStorage使用
const DEFAULT_SETTINGS = {
    triggerDistance: 100,     // トリガー距離(m)
    updateInterval: 10,       // 更新間隔(秒)
    debugMode: false,         // デバッグモード
    homeLatitude: null,       // 自宅緯度
    homeLongitude: null       // 自宅経度
};
```

### 📱 実装の詳細要件

#### エラーハンドリング仕様
```javascript
// 位置情報エラー
// - PERMISSION_DENIED: "位置情報の許可が必要です"
// - POSITION_UNAVAILABLE: "位置情報を取得できません"
// - TIMEOUT: "位置情報の取得がタイムアウトしました"

// API エラー
// - 401: "API認証に失敗しました"
// - 404: "デバイスが見つかりません"
// - 429: "API制限に達しました。しばらく待ってから再試行してください"
// - 500: "サーバーエラーが発生しました"
```

#### 通知機能
```javascript
// 通知表示パターン
// - 監視開始: "位置情報監視を開始しました"
// - エアコン制御: "エアコンを停止しました (距離: XXXm)"
// - エラー: 各種エラーメッセージ
// - 設定保存: "設定を保存しました"
```

#### ログ機能
```javascript
// ログ形式
// - 時刻: HH:MM
// - メッセージ: 実行内容
// - 最大表示件数: 10件
// - ローカルストレージに永続化
```

### 🔗 API連携仕様

#### フロントエンド → バックエンド
```javascript
// 位置チェック API
const response = await fetch('/api/location-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        latitude: currentLat,
        longitude: currentLon,
        timestamp: Date.now()
    })
});

// レスポンス形式
{
    success: true,
    distance: 150,
    triggered: true,
    action: "aircon_off",
    message: "エアコンを停止しました"
}
```

### 🚨 実装時の注意点

#### 1. iPhone Safari制約
- バックグラウンド動作制限あり
- アプリがアクティブな時のみ確実動作
- 位置情報精度に注意

#### 2. パフォーマンス考慮
- バッテリー消費最適化
- API呼び出し頻度制限
- メモリリーク防止

#### 3. セキュリティ
- 位置情報の適切な扱い
- API認証情報の非露出
- XSS対策

### 📂 ファイル構成
```
public/
├── app.js              # 👈 次に実装するファイル
├── index.html          # ✅ 完了
├── style.css           # ✅ 完了
├── sw.js               # ✅ 完了
├── manifest.json       # ✅ 完了
└── icons/              # ⚠️ 仮アイコン(要改善)
```

### 🎯 実装順序の推奨

1. **基本クラス定義** (LocationMonitor, SwitchBotAPI, UIController)
2. **位置情報取得機能** (watchPosition実装)
3. **距離計算機能** (ハーバシンの公式)
4. **UI更新機能** (DOM操作、状態表示)
5. **設定管理機能** (localStorage読み書き)
6. **API通信機能** (fetch, エラーハンドリング)
7. **監視ロジック** (トリガー判定、制御実行)
8. **通知・ログ機能** (ユーザーフィードバック)

### 🧪 テスト項目

- [ ] 位置情報許可プロンプト表示
- [ ] 位置情報取得・表示
- [ ] 距離計算の精度確認
- [ ] 監視開始/停止の動作
- [ ] 設定保存・読み込み
- [ ] モーダル開閉
- [ ] エラーハンドリング
- [ ] レスポンシブ表示

### 📖 参考資料

- **実装仕様書**: `docs/PWA-Implementation-Specification.md`
- **Geolocation API**: https://developer.mozilla.org/ja/docs/Web/API/Geolocation_API
- **SwitchBot API**: 仕様書参照

---

## 🚀 開始方法

1. 開発サーバーアクセス: http://127.0.0.1:3000
2. app.js作成: `public/app.js`
3. ブラウザ開発者ツールでデバッグ
4. 段階的実装・テスト

## 📞 引き継ぎ完了

現在PWA基盤は完成しており、app.js実装のみが残っています。
上記仕様に従って実装を進めてください。

**質問や不明点があれば、実装仕様書やこのドキュメントを参照してください。**
