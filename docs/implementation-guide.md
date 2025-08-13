# 実装改善ガイド - ジオフェンス機能

**更新日**: 2025年8月13日
**対象**: SwitchBot位置情報自動制御システムの実装改善

## 🎯 このガイドの目的

先行して実施した調査結果を基に、実際の改善実装手順と注意事項をまとめています。

---

## 🛠️ 実装予定の改善項目

### ✅ 完了済み

| 項目 | 状況 | 実装日 |
|------|------|--------|
| ポーリング間隔最適化 | ✅ 完了 | 2025-08-13 |
| 重複制御防止強化 | ✅ 完了 | 2025-08-13 |
| デバッグログ改善 | ✅ 完了 | 2025-08-13 |

### 🔄 実装予定 (優先度順)

| 項目 | 優先度 | 推定工数 | メリット |
|------|--------|----------|----------|
| エラーハンドリング強化 | 🔴 高 | 2-3時間 | 安定性向上 |
| パフォーマンス監視機能 | 🟡 中 | 3-4時間 | 運用可視化 |
| 複数ジオフェンス対応 | 🟢 低 | 4-6時間 | 機能拡張 |
| バッテリー消費最適化 | 🟡 中 | 2-3時間 | ユーザビリティ |
| 時間制限付きジオフェンス | 🟢 低 | 3-4時間 | 便利機能 |

---

## 🚨 エラーハンドリング強化（優先度: 高）

### 現在の課題

```javascript
// 現在のコード: エラー時の復旧処理が不十分
try {
    const response = await fetch(apiUrl, options);
    const data = await response.json();
} catch (error) {
    console.error('API呼び出しエラー:', error);
    // エラー後の処理が不十分
}
```

### 改善実装

```javascript
class RobustAPIClient {
    constructor() {
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
        };
        this.circuitBreaker = {
            failureThreshold: 5,
            recoveryTimeout: 60000,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failures: 0,
            lastFailure: null
        };
    }

    async executeWithRetry(apiCall, context = '') {
        if (this.circuitBreaker.state === 'OPEN') {
            if (Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.recoveryTimeout) {
                this.circuitBreaker.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const result = await apiCall();

                // 成功時はサーキットブレーカーをリセット
                if (this.circuitBreaker.state === 'HALF_OPEN') {
                    this.circuitBreaker.state = 'CLOSED';
                    this.circuitBreaker.failures = 0;
                }

                return result;
            } catch (error) {
                console.error(`[${context}] API呼び出し失敗 (試行${attempt}/${this.retryConfig.maxRetries}):`, error);

                // 最後の試行でない場合は待機
                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
                        this.retryConfig.maxDelay
                    );
                    await this.delay(delay);
                    continue;
                }

                // 全ての試行が失敗した場合
                this.handleCircuitBreaker();
                throw error;
            }
        }
    }

    handleCircuitBreaker() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();

        if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
            this.circuitBreaker.state = 'OPEN';
            console.warn('Circuit breaker opened due to repeated failures');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### 位置情報取得のエラーハンドリング

```javascript
class RobustLocationManager {
    constructor() {
        this.fallbackStrategies = [
            'high_accuracy',
            'balanced',
            'low_power',
            'cached'
        ];
    }

    async getCurrentPosition() {
        for (const strategy of this.fallbackStrategies) {
            try {
                return await this.getPositionWithStrategy(strategy);
            } catch (error) {
                console.warn(`位置情報取得失敗 (${strategy}):`, error);
                continue;
            }
        }
        throw new Error('全ての位置情報取得方法が失敗しました');
    }

    getPositionWithStrategy(strategy) {
        const options = this.getGeolocationOptions(strategy);

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                options
            );
        });
    }

    getGeolocationOptions(strategy) {
        const strategies = {
            high_accuracy: {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            },
            balanced: {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            },
            low_power: {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000
            },
            cached: {
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 300000 // 5分
            }
        };

        return strategies[strategy] || strategies.balanced;
    }
}
```

---

## 📊 パフォーマンス監視機能

### 実装目標

- API応答時間の監視
- 位置情報取得頻度の追跡
- エラー発生率の計測
- バッテリー消費推定

### 実装例

```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: {
                total: 0,
                success: 0,
                failure: 0,
                avgResponseTime: 0,
                lastError: null
            },
            location: {
                updates: 0,
                failures: 0,
                avgAccuracy: 0,
                lastUpdate: null
            },
            system: {
                startTime: Date.now(),
                uptime: 0,
                memoryUsage: 0
            }
        };

        this.listeners = [];
        this.reportInterval = 60000; // 1分間隔で統計レポート
        this.startReporting();
    }

    trackAPICall(duration, success, error = null) {
        this.metrics.apiCalls.total++;

        if (success) {
            this.metrics.apiCalls.success++;
            this.metrics.apiCalls.avgResponseTime =
                (this.metrics.apiCalls.avgResponseTime + duration) / 2;
        } else {
            this.metrics.apiCalls.failure++;
            this.metrics.apiCalls.lastError = {
                message: error?.message,
                timestamp: Date.now()
            };
        }

        this.notifyListeners('api_call', { duration, success, error });
    }

    trackLocationUpdate(position, accuracy) {
        this.metrics.location.updates++;
        this.metrics.location.avgAccuracy =
            (this.metrics.location.avgAccuracy + accuracy) / 2;
        this.metrics.location.lastUpdate = Date.now();

        this.notifyListeners('location_update', { position, accuracy });
    }

    trackLocationError(error) {
        this.metrics.location.failures++;
        this.notifyListeners('location_error', { error });
    }

    getReport() {
        const now = Date.now();
        this.metrics.system.uptime = now - this.metrics.system.startTime;

        // メモリ使用量（概算）
        if (performance.memory) {
            this.metrics.system.memoryUsage = performance.memory.usedJSHeapSize;
        }

        return {
            timestamp: now,
            metrics: JSON.parse(JSON.stringify(this.metrics)),
            summary: {
                apiSuccessRate: this.getAPISuccessRate(),
                locationSuccessRate: this.getLocationSuccessRate(),
                avgApiResponseTime: this.metrics.apiCalls.avgResponseTime,
                systemHealth: this.getSystemHealth()
            }
        };
    }

    getAPISuccessRate() {
        const total = this.metrics.apiCalls.total;
        if (total === 0) return 100;
        return (this.metrics.apiCalls.success / total) * 100;
    }

    getLocationSuccessRate() {
        const total = this.metrics.location.updates + this.metrics.location.failures;
        if (total === 0) return 100;
        return (this.metrics.location.updates / total) * 100;
    }

    getSystemHealth() {
        const apiHealth = this.getAPISuccessRate();
        const locationHealth = this.getLocationSuccessRate();
        const avgHealth = (apiHealth + locationHealth) / 2;

        if (avgHealth >= 95) return 'excellent';
        if (avgHealth >= 85) return 'good';
        if (avgHealth >= 70) return 'fair';
        return 'poor';
    }

    startReporting() {
        setInterval(() => {
            const report = this.getReport();
            console.log('📊 Performance Report:', report.summary);

            // 閾値チェック
            if (report.summary.apiSuccessRate < 80) {
                console.warn('⚠️ API成功率が低下しています:', report.summary.apiSuccessRate);
            }

            if (report.summary.avgApiResponseTime > 5000) {
                console.warn('⚠️ API応答時間が遅延しています:', report.summary.avgApiResponseTime);
            }

        }, this.reportInterval);
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Performance monitor listener error:', error);
            }
        });
    }
}

// 使用例
const monitor = new PerformanceMonitor();

// UI用のリスナー
monitor.addListener((event, data) => {
    if (event === 'api_call' && !data.success) {
        showNotification('API呼び出しに失敗しました', 'warning');
    }
});
```

---

## 🔋 バッテリー消費最適化

### 適応的更新間隔

```javascript
class AdaptiveLocationMonitor {
    constructor() {
        this.baseInterval = 30000; // 30秒
        this.intervals = {
            stationary: 60000,  // 1分 - 静止時
            walking: 30000,     // 30秒 - 歩行時
            driving: 15000,     // 15秒 - 運転時
            background: 120000  // 2分 - バックグラウンド時
        };

        this.lastPosition = null;
        this.lastMovementTime = Date.now();
        this.currentInterval = this.baseInterval;
        this.movementThreshold = 10; // 10m未満は静止とみなす
    }

    calculateOptimalInterval(currentPosition) {
        if (!this.lastPosition) {
            this.lastPosition = currentPosition;
            return this.baseInterval;
        }

        const distance = this.calculateDistance(this.lastPosition, currentPosition);
        const timeDiff = Date.now() - this.lastMovementTime;
        const speed = distance / (timeDiff / 1000); // m/s

        let newInterval;

        if (speed < 0.5) { // < 1.8 km/h (静止)
            newInterval = this.intervals.stationary;
        } else if (speed < 2.0) { // < 7.2 km/h (歩行)
            newInterval = this.intervals.walking;
        } else { // >= 7.2 km/h (車両)
            newInterval = this.intervals.driving;
        }

        // ページ可視性チェック
        if (document.hidden) {
            newInterval = this.intervals.background;
        }

        // 段階的変更（急激な変更を避ける）
        const maxChange = this.currentInterval * 0.5;
        const proposedChange = newInterval - this.currentInterval;

        if (Math.abs(proposedChange) > maxChange) {
            newInterval = this.currentInterval + Math.sign(proposedChange) * maxChange;
        }

        this.currentInterval = newInterval;
        this.lastPosition = currentPosition;

        if (distance > this.movementThreshold) {
            this.lastMovementTime = Date.now();
        }

        console.log(`🎯 更新間隔調整: ${newInterval/1000}秒 (速度: ${speed.toFixed(2)}m/s)`);
        return newInterval;
    }

    calculateDistance(pos1, pos2) {
        // ハーバシンの公式の実装は省略
        // 既存のdistance-calc.jsを使用
        return 0;
    }
}
```

### Page Visibility API の活用

```javascript
class VisibilityAwareMonitor {
    constructor(locationMonitor) {
        this.locationMonitor = locationMonitor;
        this.isBackground = false;
        this.backgroundStartTime = null;
        this.maxBackgroundTime = 300000; // 5分

        this.setupVisibilityListener();
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleBackground();
            } else {
                this.handleForeground();
            }
        });
    }

    handleBackground() {
        console.log('🌙 バックグラウンドモードに切り替え');
        this.isBackground = true;
        this.backgroundStartTime = Date.now();

        // 更新間隔を延長
        this.locationMonitor.setUpdateInterval(120000); // 2分

        // 一定時間後に監視を停止
        setTimeout(() => {
            if (this.isBackground) {
                console.log('⏸️ 長時間バックグラウンド - 監視を一時停止');
                this.locationMonitor.pause();
            }
        }, this.maxBackgroundTime);
    }

    handleForeground() {
        console.log('☀️ フォアグラウンドモードに復帰');
        this.isBackground = false;

        // 通常の更新間隔に戻す
        this.locationMonitor.resume();
        this.locationMonitor.setUpdateInterval(30000); // 30秒

        // 即座に位置情報を確認
        this.locationMonitor.checkLocation();
    }
}
```

---

## 🔧 実装ステップ

### Phase 1: 安定性向上 (推定: 4-6時間)

1. **エラーハンドリング強化** (2-3時間)

   ```bash
   # 実装ファイル
   touch api/robust-client.js
   touch api/location-manager.js
   ```

2. **パフォーマンス監視** (2-3時間)

   ```bash
   # 実装ファイル
   touch utils/performance-monitor.js
   touch public/dashboard.html
   ```

### Phase 2: ユーザビリティ向上 (推定: 3-4時間)

1. **バッテリー最適化** (2-3時間)

   ```bash
   # 実装ファイル
   touch utils/adaptive-monitor.js
   touch utils/visibility-manager.js
   ```

2. **設定UI改善** (1-2時間)

   ```bash
   # 実装ファイル
   touch public/settings.html
   touch public/settings.js
   ```

### Phase 3: 機能拡張 (推定: 6-8時間)

1. **複数ジオフェンス対応** (4-6時間)
2. **時間制限機能** (2-2時間)

---

## ⚠️ 実装時の注意事項

### セキュリティ

```javascript
// APIキーの保護
class SecureConfig {
    static getAPIKey() {
        // 本番環境では環境変数から取得
        return process.env.SWITCHBOT_API_KEY || localStorage.getItem('switchbot_api_key');
    }

    static validateAPIKey(key) {
        return key && key.length > 10 && key.startsWith('sk-');
    }
}
```

### テスト戦略

```javascript
// ユニットテスト例
describe('GeofenceLogic', () => {
    test('should trigger when exiting geofence', () => {
        const geofence = new EnhancedGeofence({
            center: { lat: 35.6762, lng: 139.6503 },
            radius: 100
        });

        const outsidePosition = { lat: 35.6772, lng: 139.6503 };
        const result = geofence.check(outsidePosition);

        expect(result.shouldTrigger).toBe(true);
        expect(result.triggerType).toBe('exit');
    });
});
```

### デバッグ支援

```javascript
class DebugManager {
    constructor() {
        this.isDebugMode = localStorage.getItem('debug_mode') === 'true';
        this.logLevel = localStorage.getItem('log_level') || 'info';
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        console.log(logMessage, data);

        // デバッグモード時はローカルストレージにも保存
        if (this.isDebugMode) {
            this.saveToLocalStorage(level, message, data);
        }
    }

    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);

        return messageLevelIndex <= currentLevelIndex;
    }
}
```

---

## 📝 まとめ

このガイドに従って段階的に実装することで、以下の改善が期待できます：

- **安定性**: エラー発生時の自動復旧
- **パフォーマンス**: バッテリー消費の最適化
- **可観測性**: 運用状況の可視化
- **拡張性**: 新機能追加の基盤整備

各実装フェーズ完了後は、実際の使用環境でのテストを実施し、メトリクスを確認することを推奨します。

**次のステップ**: Phase 1の「エラーハンドリング強化」から開始することをお勧めします。
