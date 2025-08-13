/**
 * SwitchBot位置情報自動制御システム - メインアプリケーション
 * 位置情報監視によるエアコン自動制御PWA
 */

// ========================================
// 設定定数
// ========================================
const DEFAULT_SETTINGS = {
    triggerDistance: 100,     // トリガー距離(m)
    updateInterval: 60,       // 位置情報取得の更新間隔(秒)
    debugMode: false,         // デバッグモード
    homeLatitude: null,       // 自宅緯度
    homeLongitude: null       // 自宅経度
};

const API_ENDPOINTS = {
    locationCheck: '/api/location-check',
    devices: '/api/devices',
    testAircon: '/api/test-aircon',
    config: '/api/config'
};

// ========================================
// LocationMonitor クラス - 位置情報監視
// ========================================
class LocationMonitor {
    constructor() {
        this.watchId = null;
        this.pollingTimer = null; // ポーリング用タイマー追加
        this.isMonitoring = false;
        this.currentPosition = null;
        this.lastDistance = null;
        this.lastControlDistance = null; // 前回制御時の距離を記録
        this.onPositionUpdate = null;
        this.onError = null;
        this.onStatusUpdate = null; // ステータス更新コールバック追加
    }

    /**
     * 位置情報監視を開始
     */
    startMonitoring() {
        if (!navigator.geolocation) {
            this.handleError('位置情報がサポートされていません');
            return false;
        }

        // まず一度だけ位置情報を取得して権限を確認
        this.requestInitialPosition()
            .then(() => {
                // 権限が取得できたら定期ポーリングを開始
                this.startPeriodicMonitoring();
            })
            .catch((error) => {
                this.handlePositionError(error);
            });

        return true;
    }

    /**
     * 初回位置情報取得（権限確認用）
     */
    requestInitialPosition() {
        return new Promise((resolve, reject) => {
            // UI状態更新
            if (this.onStatusUpdate) {
                this.onStatusUpdate('requesting');
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 30000, // iOSでは長めに設定
                maximumAge: 300000 // 5分間キャッシュを許可
            };

            // UI状態更新（取得開始）
            if (this.onStatusUpdate) {
                this.onStatusUpdate('acquiring');
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('初回位置情報取得成功');
                    this.handlePositionUpdate(position);
                    resolve(position);
                },
                (error) => {
                    console.error('初回位置情報取得失敗:', error);
                    // エラー種別に応じてUI更新
                    if (this.onStatusUpdate) {
                        if (error.code === error.PERMISSION_DENIED) {
                            this.onStatusUpdate('denied');
                        } else if (error.code === error.TIMEOUT) {
                            this.onStatusUpdate('timeout');
                        } else {
                            this.onStatusUpdate('error');
                        }
                    }
                    reject(error);
                },
                options
            );
        });
    }

    /**
     * 定期的な位置情報監視を開始（ポーリング方式）
     */
    startPeriodicMonitoring() {
        const settings = this.getSettings();
        const intervalMs = settings.updateInterval * 1000; // 秒をミリ秒に変換

        // 定期的に位置情報を取得
        this.pollingTimer = setInterval(() => {
            this.getCurrentPosition();
        }, intervalMs);

        this.isMonitoring = true;
        console.log(`定期的な位置情報監視を開始しました (間隔: ${settings.updateInterval}秒)`);
    }

    /**
     * 現在位置を取得（ポーリング用）
     */
    getCurrentPosition() {
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            options
        );
    }

    /**
     * 位置情報監視を停止
     */
    stopMonitoring() {
        // watchPositionのクリア
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // ポーリングタイマーのクリア
        if (this.pollingTimer !== null) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }

        this.isMonitoring = false;
        console.log('位置情報監視を停止しました');
    }

    /**
     * 位置情報更新時の処理
     */
    handlePositionUpdate(position) {
        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp
        };

        // 自宅からの距離を計算
        const settings = this.getSettings();
        if (settings.homeLatitude && settings.homeLongitude) {
            this.lastDistance = this.calculateDistance(
                this.currentPosition.latitude,
                this.currentPosition.longitude,
                settings.homeLatitude,
                settings.homeLongitude
            );
        }

        if (this.onPositionUpdate) {
            this.onPositionUpdate(this.currentPosition, this.lastDistance);
        }
    }

    /**
     * 位置情報エラー処理
     */
    handlePositionError(error) {
        let message = '';
        let userMessage = '';

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = '位置情報の許可が拒否されました';
                userMessage = 'iPhoneの設定 > プライバシーとセキュリティ > 位置情報サービス で位置情報を有効にし、Safariでの位置情報アクセスを許可してください。';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '位置情報を取得できません';
                userMessage = 'GPS信号が弱い可能性があります。屋外に移動するか、しばらく待ってから再試行してください。';
                break;
            case error.TIMEOUT:
                message = '位置情報の取得がタイムアウトしました';
                userMessage = 'GPS信号の取得に時間がかかっています。しばらく待ってから再試行してください。';
                break;
            default:
                message = '位置情報の取得中にエラーが発生しました';
                userMessage = '位置情報の取得に失敗しました。しばらく待ってから再試行してください。';
        }

        console.error('Geolocation Error:', error);
        this.handleError(`${message} (${userMessage})`);
    }

    /**
     * エラーハンドリング
     */
    handleError(message) {
        console.error('LocationMonitor Error:', message);
        if (this.onError) {
            this.onError(message);
        }
    }

    /**
     * ハーバシンの公式による距離計算
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // 地球半径(m)
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // メートル単位
    }

    /**
     * 設定を取得
     */
    getSettings() {
        // ローカルストレージとサーバー設定をマージ
        const savedSettings = localStorage.getItem('switchbot-settings');
        const localSettings = savedSettings ? JSON.parse(savedSettings) : {};

        // サーバー設定を優先してマージ（デバッグモードはユーザー設定を優先）
        return {
            ...DEFAULT_SETTINGS,
            ...localSettings,
            // サーバー管理項目は上書き
            homeLatitude: DEFAULT_SETTINGS.homeLatitude,
            homeLongitude: DEFAULT_SETTINGS.homeLongitude,
            triggerDistance: DEFAULT_SETTINGS.triggerDistance,
            // debugModeはユーザー設定を優先（ローカル設定がない場合のみデフォルト値を使用）
            debugMode: localSettings.debugMode !== undefined ? localSettings.debugMode : DEFAULT_SETTINGS.debugMode
        };
    }
}

// ========================================
// SwitchBotAPI クラス - API通信管理
// ========================================
class SwitchBotAPI {
    constructor() {
        this.lastCallTime = 0;
        this.minInterval = 1000; // 最小API呼び出し間隔(ms)
    }

    /**
     * 設定情報取得
     */
    async getConfig() {
        try {
            const response = await fetch(API_ENDPOINTS.config, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error('Config Error:', error);
            throw error;
        }
    }

    /**
     * 位置チェックと制御実行
     */
    async checkLocationAndControl(latitude, longitude) {
        try {
            await this.waitForRateLimit();

            const response = await fetch(API_ENDPOINTS.locationCheck, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude,
                    longitude,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const result = await response.json();
            this.lastCallTime = Date.now();
            return result;

        } catch (error) {
            console.error('API Call Error:', error);
            throw this.handleAPIError(error);
        }
    }

    /**
     * デバイス一覧取得
     */
    async getDevices() {
        try {
            await this.waitForRateLimit();

            const response = await fetch(API_ENDPOINTS.devices);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const result = await response.json();
            this.lastCallTime = Date.now();
            return result;

        } catch (error) {
            console.error('Get Devices Error:', error);
            throw this.handleAPIError(error);
        }
    }

    /**
     * エアコン手動制御
     */
    async testAirconControl(action = 'off') {
        try {
            await this.waitForRateLimit();

            const response = await fetch(API_ENDPOINTS.testAircon, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const result = await response.json();
            this.lastCallTime = Date.now();
            return result;

        } catch (error) {
            console.error('Test Aircon Error:', error);
            throw this.handleAPIError(error);
        }
    }

    /**
     * レート制限対応
     */
    async waitForRateLimit() {
        const elapsed = Date.now() - this.lastCallTime;
        if (elapsed < this.minInterval) {
            const waitTime = this.minInterval - elapsed;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    /**
     * APIエラー処理
     */
    handleAPIError(error) {
        if (error.message.includes('401')) {
            return new Error('API認証に失敗しました');
        } else if (error.message.includes('404')) {
            return new Error('デバイスが見つかりません');
        } else if (error.message.includes('429')) {
            return new Error('API制限に達しました。しばらく待ってから再試行してください');
        } else if (error.message.includes('500')) {
            return new Error('サーバーエラーが発生しました');
        } else {
            return new Error(`通信エラー: ${error.message}`);
        }
    }
}

// ========================================
// UIController クラス - UI制御
// ========================================
class UIController {
    constructor() {
        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * DOM要素の取得
     */
    initializeElements() {
        this.elements = {
            currentLocation: document.getElementById('currentLocation'),
            distanceFromHome: document.getElementById('distanceFromHome'),
            monitoringStatus: document.getElementById('monitoringStatus'),
            lastControl: document.getElementById('lastControl'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            logContainer: document.getElementById('logContainer'),
            toggleMonitoringBtn: document.getElementById('toggleMonitoringBtn'),
            manualOnBtn: document.getElementById('manualOnBtn'),
            manualOffBtn: document.getElementById('manualOffBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
            closeModalBtn: document.getElementById('closeModalBtn'),
            clearLogBtn: document.getElementById('clearLogBtn'),
            homeLatInput: document.getElementById('homeLatitude'),
            homeLonInput: document.getElementById('homeLongitude'),
            triggerDistanceInput: document.getElementById('triggerDistance'),
            debugModeInput: document.getElementById('debugMode')
        };
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // 監視開始/停止ボタン
        if (this.elements.toggleMonitoringBtn) {
            this.elements.toggleMonitoringBtn.addEventListener('click', () => {
                this.onToggleMonitoring && this.onToggleMonitoring();
            });
        }

        // 手動制御ボタン
        if (this.elements.manualOnBtn) {
            this.elements.manualOnBtn.addEventListener('click', () => {
                this.onManualControl && this.onManualControl('on');
            });
        }

        if (this.elements.manualOffBtn) {
            this.elements.manualOffBtn.addEventListener('click', () => {
                this.onManualControl && this.onManualControl('off');
            });
        }

        // 設定ボタン
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }

        // 設定保存ボタン
        if (this.elements.saveSettingsBtn) {
            this.elements.saveSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 設定キャンセルボタン
        if (this.elements.cancelSettingsBtn) {
            this.elements.cancelSettingsBtn.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }

        // モーダル閉じるボタン
        if (this.elements.closeModalBtn) {
            this.elements.closeModalBtn.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }

        // ログクリアボタン
        if (this.elements.clearLogBtn) {
            this.elements.clearLogBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        // モーダルの外側クリックで閉じる
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.settingsModal) {
                    this.closeSettingsModal();
                }
            });
        }
    }

    /**
     * 現在位置表示更新
     */
    updateCurrentLocation(latitude, longitude) {
        if (this.elements.currentLocation) {
            this.elements.currentLocation.textContent =
                `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

            // 位置情報取得成功ログ
            const logTimestamp = new Date();
            const logTimeStr = `${logTimestamp.getHours().toString().padStart(2, '0')}:${logTimestamp.getMinutes().toString().padStart(2, '0')}:${logTimestamp.getSeconds().toString().padStart(2, '0')}`;
            console.log('位置情報更新:', { latitude, longitude, timestamp: logTimeStr });
        }
    }

    /**
     * 位置情報取得状態の更新
     */
    updateLocationStatus(status) {
        if (this.elements.currentLocation) {
            switch (status) {
                case 'requesting':
                    this.elements.currentLocation.textContent = '📍 位置情報を要求中...';
                    break;
                case 'acquiring':
                    this.elements.currentLocation.textContent = '🔍 位置情報を取得中...';
                    break;
                case 'timeout':
                    this.elements.currentLocation.textContent = '⏰ 取得タイムアウト';
                    break;
                case 'denied':
                    this.elements.currentLocation.textContent = '❌ アクセス拒否';
                    break;
                case 'error':
                    this.elements.currentLocation.textContent = '❌ 取得エラー';
                    break;
                default:
                    this.elements.currentLocation.textContent = '取得中...';
            }
        }
    }

    /**
     * 距離表示更新
     */
    updateDistance(distance) {
        if (this.elements.distanceFromHome) {
            if (distance !== null) {
                this.elements.distanceFromHome.textContent = `${Math.round(distance)}m`;
            } else {
                this.elements.distanceFromHome.textContent = '計算中...';
            }
        }
    }

    /**
     * 監視状態表示更新
     */
    updateMonitoringStatus(isMonitoring, isError = false) {
        if (this.elements.monitoringStatus) {
            if (isError) {
                this.elements.monitoringStatus.textContent = 'エラー';
                this.elements.monitoringStatus.className = 'status error';
            } else if (isMonitoring) {
                this.elements.monitoringStatus.textContent = '監視中';
                this.elements.monitoringStatus.className = 'status monitoring';
            } else {
                this.elements.monitoringStatus.textContent = '停止中';
                this.elements.monitoringStatus.className = 'status stopped';
            }
        }

        // ボタンテキスト更新
        if (this.elements.toggleMonitoringBtn) {
            this.elements.toggleMonitoringBtn.textContent =
                isMonitoring ? '監視停止' : '監視開始';
        }
    }

    /**
     * 最後の制御時刻更新
     */
    updateLastControl(timestamp) {
        if (this.elements.lastControl && timestamp) {
            const date = new Date(timestamp);
            this.elements.lastControl.textContent =
                `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        }
    }

    /**
     * 接続状態表示更新
     */
    updateConnectionStatus(isConnected, message = '') {
        if (this.elements.statusDot && this.elements.statusText) {
            this.elements.statusDot.className = isConnected ? 'status-dot connected' : 'status-dot disconnected';
            this.elements.statusText.textContent = message || (isConnected ? '接続中' : '未接続');
        }
    }

    /**
     * ログ追加
     */
    addLog(message) {
        if (!this.elements.logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        const timestamp = new Date();
        const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;

        logEntry.innerHTML = `<span class="log-time">${timeStr}</span> ${message}`;

        this.elements.logContainer.insertBefore(logEntry, this.elements.logContainer.firstChild);

        // 最大10件まで保持
        while (this.elements.logContainer.children.length > 10) {
            this.elements.logContainer.removeChild(this.elements.logContainer.lastChild);
        }

        // ローカルストレージに保存
        this.saveLogsToStorage();
    }

    /**
     * 設定モーダル開く
     */
    openSettingsModal() {
        if (!this.elements.settingsModal) return;

        // 現在の設定値を入力フィールドに設定
        const settings = this.getSettings();

        if (this.elements.homeLatInput) this.elements.homeLatInput.value = settings.homeLatitude || '';
        if (this.elements.homeLonInput) this.elements.homeLonInput.value = settings.homeLongitude || '';
        if (this.elements.triggerDistanceInput) this.elements.triggerDistanceInput.value = settings.triggerDistance;
        if (this.elements.debugModeInput) this.elements.debugModeInput.checked = settings.debugMode;

        this.elements.settingsModal.style.display = 'flex';
    }

    /**
     * 設定モーダル閉じる
     */
    closeSettingsModal() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'none';
        }
    }

    /**
     * 設定保存
     */
    saveSettings() {
        const settings = {
            homeLatitude: this.elements.homeLatInput?.value ? parseFloat(this.elements.homeLatInput.value) : null,
            homeLongitude: this.elements.homeLonInput?.value ? parseFloat(this.elements.homeLonInput.value) : null,
            triggerDistance: this.elements.triggerDistanceInput?.value ? parseInt(this.elements.triggerDistanceInput.value) : DEFAULT_SETTINGS.triggerDistance,
            debugMode: this.elements.debugModeInput?.checked || false
        };

        localStorage.setItem('switchbot-settings', JSON.stringify(settings));
        this.closeSettingsModal();
        this.addLog('設定を保存しました');

        if (this.onSettingsSaved) {
            this.onSettingsSaved(settings);
        }
    }

    /**
     * サーバー設定を適用
     */
    applyServerConfig(config) {
        // 設定モーダルのフィールドに値を設定
        if (this.elements.homeLatInput) {
            this.elements.homeLatInput.value = config.homeLocation.latitude.toFixed(6);
        }
        if (this.elements.homeLonInput) {
            this.elements.homeLonInput.value = config.homeLocation.longitude.toFixed(6);
        }
        if (this.elements.triggerDistanceInput) {
            this.elements.triggerDistanceInput.value = config.triggerDistance;
        }
        if (this.elements.debugModeInput) {
            this.elements.debugModeInput.checked = config.debugMode;
        }

        // LocationMonitorに自宅座標を設定
        if (window.switchBotApp?.locationMonitor) {
            window.switchBotApp.locationMonitor.homeLocation = {
                latitude: config.homeLocation.latitude,
                longitude: config.homeLocation.longitude
            };
        }
    }

    /**
     * 通知表示
     */
    showNotification(message, type = 'info') {
        // ブラウザ通知がサポートされている場合
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('SwitchBot制御', {
                body: message,
                icon: '/icons/icon-192x192.svg'
            });
        }

        // ログにも追加
        this.addLog(message);
    }

    /**
     * ログをローカルストレージに保存
     */
    saveLogsToStorage() {
        if (!this.elements.logContainer) return;

        const logs = Array.from(this.elements.logContainer.children).map(entry => entry.textContent);
        localStorage.setItem('switchbot-logs', JSON.stringify(logs));
    }

    /**
     * ログをローカルストレージから復元
     */
    loadLogsFromStorage() {
        const savedLogs = localStorage.getItem('switchbot-logs');
        if (savedLogs && this.elements.logContainer) {
            const logs = JSON.parse(savedLogs);
            logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.textContent = log;
                this.elements.logContainer.appendChild(logEntry);
            });
        }
    }

    /**
     * ログをクリア
     */
    clearLogs() {
        if (this.elements.logContainer) {
            this.elements.logContainer.innerHTML = '';
        }
        localStorage.removeItem('switchbot-logs');
        this.addLog('ログをクリアしました');
    }

    /**
     * 設定取得
     */
    getSettings() {
        const savedSettings = localStorage.getItem('switchbot-settings');
        const localSettings = savedSettings ? JSON.parse(savedSettings) : {};

        // サーバー設定とマージ（デバッグモードはユーザー設定を優先）
        return {
            ...DEFAULT_SETTINGS,
            ...localSettings,
            // サーバー管理項目は上書き
            homeLatitude: DEFAULT_SETTINGS.homeLatitude,
            homeLongitude: DEFAULT_SETTINGS.homeLongitude,
            triggerDistance: DEFAULT_SETTINGS.triggerDistance,
            // debugModeはユーザー設定を優先
            debugMode: localSettings.debugMode !== undefined ? localSettings.debugMode : DEFAULT_SETTINGS.debugMode
        };
    }
}

// ========================================
// AppController クラス - 全体統合制御
// ========================================
class AppController {
    constructor() {
        this.locationMonitor = new LocationMonitor();
        this.switchBotAPI = new SwitchBotAPI();
        this.uiController = new UIController();

        this.isInitialized = false;
        this.lastTriggerTime = 0;
        this.lastControlDistance = null; // 前回制御実行時の距離
        this.triggerCooldown = 120000; // 2分間のクールダウンに延長

        this.setupEventHandlers();
        this.initialize();
    }

    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        // 位置情報更新時
        this.locationMonitor.onPositionUpdate = (position, distance) => {
            this.handlePositionUpdate(position, distance);
        };

        // 位置情報エラー時
        this.locationMonitor.onError = (error) => {
            this.handleLocationError(error);
        };

        // 位置情報ステータス更新時
        this.locationMonitor.onStatusUpdate = (status) => {
            this.uiController.updateLocationStatus(status);
        };

        // UI イベント
        this.uiController.onToggleMonitoring = () => {
            this.toggleMonitoring();
        };

        this.uiController.onManualControl = (action) => {
            this.manualControl(action);
        };

        this.uiController.onSettingsSaved = (settings) => {
            this.onSettingsChanged(settings);
        };
    }

    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            // HTTPSチェック（本番環境のみ）
            if (location.hostname !== 'localhost' && location.protocol !== 'https:') {
                this.uiController.addLog('⚠️ HTTPSが必要です。位置情報は取得できません。');
                this.uiController.showNotification('HTTPSが必要です', 'error');
                return;
            }

            // iOSデバイス検出
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                this.uiController.addLog('📱 iOSデバイスを検出しました');
                // iOSでの位置情報説明を表示
                this.showIOSLocationInstructions();
            }

            // 位置情報サポートチェック
            if (!navigator.geolocation) {
                throw new Error('このブラウザは位置情報をサポートしていません');
            }

            // 通知許可の確認
            await this.requestNotificationPermission();

            // ログの復元
            this.uiController.loadLogsFromStorage();

            // サーバー設定を取得
            await this.loadServerConfig();

            // 接続状態確認
            await this.checkConnection();

            this.uiController.addLog('✅ アプリケーションを初期化しました');
            this.isInitialized = true;

        } catch (error) {
            console.error('Initialization Error:', error);
            this.uiController.addLog(`❌ 初期化エラー: ${error.message}`);
        }
    }

    /**
     * iOS向けの位置情報説明を表示
     */
    showIOSLocationInstructions() {
        const instructions = [
            '📍 iPhoneで位置情報を使用するには：',
            '1. 設定 > プライバシーとセキュリティ > 位置情報サービス をオンにする',
            '2. Safari の位置情報アクセスを許可する',
            '3. ブラウザで「位置情報の共有を許可」を選択する'
        ];

        instructions.forEach(instruction => {
            this.uiController.addLog(instruction);
        });
    }

    /**
     * サーバー設定を取得・適用
     */
    async loadServerConfig() {
        try {
            this.uiController.addLog('サーバー設定を取得中...');
            const config = await this.switchBotAPI.getConfig();

            // グローバル設定に適用
            DEFAULT_SETTINGS.homeLatitude = config.homeLocation.latitude;
            DEFAULT_SETTINGS.homeLongitude = config.homeLocation.longitude;
            DEFAULT_SETTINGS.triggerDistance = config.triggerDistance;
            DEFAULT_SETTINGS.debugMode = config.debugMode;

            // UI設定に適用
            this.uiController.applyServerConfig(config);

            this.uiController.addLog('サーバー設定を適用しました');

        } catch (error) {
            console.error('Config Load Error:', error);
            this.uiController.addLog(`設定取得エラー: ${error.message}`);
        }
    }

    /**
     * 通知許可要求
     */
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.uiController.addLog('通知が有効になりました');
            }
        }
    }

    /**
     * 接続状態確認
     */
    async checkConnection() {
        try {
            await this.switchBotAPI.getDevices();
            this.uiController.updateConnectionStatus(true, 'API接続正常');
        } catch (error) {
            this.uiController.updateConnectionStatus(false, `接続エラー: ${error.message}`);
        }
    }

    /**
     * 監視開始/停止切り替え
     */
    toggleMonitoring() {
        if (this.locationMonitor.isMonitoring) {
            this.stopMonitoring();
        } else {
            this.startMonitoring();
        }
    }

    /**
     * 監視開始
     */
    startMonitoring() {
        const settings = this.uiController.getSettings();

        if (!settings.homeLatitude || !settings.homeLongitude) {
            this.uiController.addLog('自宅の位置を設定してください');
            this.uiController.openSettingsModal();
            return;
        }

        if (this.locationMonitor.startMonitoring()) {
            this.uiController.updateMonitoringStatus(true);
            this.uiController.addLog('位置情報監視を開始しました');
            this.uiController.showNotification('位置情報監視を開始しました');
        }
    }

    /**
     * 監視停止
     */
    stopMonitoring() {
        this.locationMonitor.stopMonitoring();
        this.uiController.updateMonitoringStatus(false);
        this.uiController.addLog('位置情報監視を停止しました');
    }

    /**
     * 位置情報更新処理
     */
    async handlePositionUpdate(position, distance) {
        // UI更新
        this.uiController.updateCurrentLocation(position.latitude, position.longitude);
        this.uiController.updateDistance(distance);

        const settings = this.uiController.getSettings();

        // デバッグ情報（制御実行時のみ詳細表示）
        if (settings.debugMode) {
            const now = new Date().toLocaleTimeString();
            console.log(`[${now}] 位置更新: 距離=${distance?.toFixed(1) || 'N/A'}m`);
        }

        // トリガー距離チェック
        if (distance && distance > settings.triggerDistance) {
            await this.checkTriggerCondition(position, distance);
        } else if (settings.debugMode && distance) {
            console.log(`トリガー距離内のため制御なし: ${distance.toFixed(1)}m (閾値: ${settings.triggerDistance}m)`);
        }
    }

    /**
     * トリガー条件チェック
     */
    async checkTriggerCondition(position, distance) {
        const now = Date.now();
        const settings = this.uiController.getSettings();

        // クールダウン期間チェック
        if (now - this.lastTriggerTime < this.triggerCooldown) {
            if (settings.debugMode) {
                const remainingTime = Math.round((this.triggerCooldown - (now - this.lastTriggerTime)) / 1000);
                console.log(`クールダウン中: あと${remainingTime}秒`);
            }
            return;
        }

        // 距離に大きな変化がない場合はスキップ（重複制御防止）
        if (this.lastControlDistance !== null) {
            const distanceDiff = Math.abs(distance - this.lastControlDistance);
            if (distanceDiff < 10) { // 10m未満の変化はスキップ
                if (settings.debugMode) {
                    console.log(`距離変化が少ないためスキップ: ${distanceDiff.toFixed(1)}m`);
                }
                return;
            }
        }

        try {
            if (settings.debugMode) {
                this.uiController.addLog(`制御判定実行中... (距離: ${Math.round(distance)}m)`);
            }

            const result = await this.switchBotAPI.checkLocationAndControl(
                position.latitude,
                position.longitude
            );

            if (result.triggered) {
                this.lastTriggerTime = now;
                this.lastControlDistance = distance; // 制御実行時の距離を記録
                this.uiController.updateLastControl(now);
                this.uiController.addLog(`エアコンを停止しました (距離: ${Math.round(distance)}m)`);
                this.uiController.showNotification(result.message || 'エアコンを制御しました');
            } else if (settings.debugMode) {
                this.uiController.addLog(`制御条件未満のため実行せず (距離: ${Math.round(distance)}m)`);
            }

        } catch (error) {
            this.uiController.addLog(`制御エラー: ${error.message}`);
            console.error('Control Error:', error);
        }
    }

    /**
     * 手動制御
     */
    async manualControl(action = 'off') {
        try {
            const actionText = action === 'on' ? 'ON' : 'OFF';
            this.uiController.addLog(`手動制御(${actionText})を実行中...`);
            const result = await this.switchBotAPI.testAirconControl(action);

            this.uiController.updateLastControl(Date.now());
            this.uiController.addLog(`エアコンを${actionText}にしました`);
            this.uiController.showNotification(`エアコンを${actionText}にしました`);

        } catch (error) {
            this.uiController.addLog(`手動制御エラー: ${error.message}`);
            console.error('Manual Control Error:', error);
        }
    }

    /**
     * 位置情報エラー処理
     */
    handleLocationError(error) {
        this.uiController.updateMonitoringStatus(false, true);
        this.uiController.addLog(`位置情報エラー: ${error}`);
        this.stopMonitoring();
    }

    /**
     * 設定変更時の処理
     */
    onSettingsChanged(settings) {
        // 監視中の場合は再起動
        if (this.locationMonitor.isMonitoring) {
            this.stopMonitoring();
            setTimeout(() => this.startMonitoring(), 1000);
        }
    }
}

// ========================================
// アプリケーション起動
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('SwitchBot位置情報自動制御システム - 起動中...');

    // Service Worker登録
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // メインアプリケーション起動
    window.switchBotApp = new AppController();

    console.log('アプリケーションが正常に起動しました');
});

// ========================================
// PWA関連イベント
// ========================================

// アプリがフォアグラウンドになったとき
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.switchBotApp) {
        // 接続状態を再確認
        window.switchBotApp.checkConnection();
    }
});

// PWAインストール促進
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWAインストールプロンプトが利用可能です');
});

// デバッグ用グローバル関数
window.debugSwitchBot = {
    getSettings: () => {
        return JSON.parse(localStorage.getItem('switchbot-settings') || '{}');
    },
    clearSettings: () => {
        localStorage.removeItem('switchbot-settings');
        console.log('設定をクリアしました');
    },
    clearLogs: () => {
        localStorage.removeItem('switchbot-logs');
        console.log('ログをクリアしました');
    },
    getCurrentPosition: () => {
        return window.switchBotApp?.locationMonitor.currentPosition;
    },
    getLastDistance: () => {
        return window.switchBotApp?.locationMonitor.lastDistance;
    }
};
