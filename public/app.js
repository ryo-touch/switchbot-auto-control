/**
 * SwitchBot位置情報自動制御システム - メインアプリケーション
 * 位置情報監視によるエアコン自動制御PWA
 */

// ========================================
// 設定定数
// ========================================
const DEFAULT_SETTINGS = {
    triggerDistance: 100,     // トリガー距離(m)
    updateInterval: 10,       // 更新間隔(秒)
    debugMode: false,         // デバッグモード
    homeLatitude: null,       // 自宅緯度
    homeLongitude: null       // 自宅経度
};

const API_ENDPOINTS = {
    locationCheck: '/api/location-check',
    devices: '/api/devices',
    testAircon: '/api/test-aircon'
};

// ========================================
// LocationMonitor クラス - 位置情報監視
// ========================================
class LocationMonitor {
    constructor() {
        this.watchId = null;
        this.isMonitoring = false;
        this.currentPosition = null;
        this.lastDistance = null;
        this.onPositionUpdate = null;
        this.onError = null;
    }

    /**
     * 位置情報監視を開始
     */
    startMonitoring() {
        if (!navigator.geolocation) {
            this.handleError('位置情報がサポートされていません');
            return false;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            options
        );

        this.isMonitoring = true;
        console.log('位置情報監視を開始しました');
        return true;
    }

    /**
     * 位置情報監視を停止
     */
    stopMonitoring() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
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
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = '位置情報の許可が必要です';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '位置情報を取得できません';
                break;
            case error.TIMEOUT:
                message = '位置情報の取得がタイムアウトしました';
                break;
            default:
                message = '位置情報の取得中にエラーが発生しました';
        }
        this.handleError(message);
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
        const savedSettings = localStorage.getItem('switchbot-settings');
        return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
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
                `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
        const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

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
        return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
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
        this.triggerCooldown = 60000; // 1分間のクールダウン

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

        // UI イベント
        this.uiController.onToggleMonitoring = () => {
            this.toggleMonitoring();
        };

        this.uiController.onManualControl = () => {
            this.manualControl();
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
            // 通知許可の確認
            await this.requestNotificationPermission();

            // ログの復元
            this.uiController.loadLogsFromStorage();

            // 接続状態確認
            await this.checkConnection();

            this.uiController.addLog('アプリケーションを初期化しました');
            this.isInitialized = true;

        } catch (error) {
            console.error('Initialization Error:', error);
            this.uiController.addLog(`初期化エラー: ${error.message}`);
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

        // デバッグ情報
        if (settings.debugMode) {
            console.log('Position Update:', position, 'Distance:', distance);
        }

        // トリガー距離チェック
        if (distance && distance > settings.triggerDistance) {
            await this.checkTriggerCondition(position, distance);
        }
    }

    /**
     * トリガー条件チェック
     */
    async checkTriggerCondition(position, distance) {
        const now = Date.now();

        // クールダウン期間チェック
        if (now - this.lastTriggerTime < this.triggerCooldown) {
            return;
        }

        try {
            const result = await this.switchBotAPI.checkLocationAndControl(
                position.latitude,
                position.longitude
            );

            if (result.triggered) {
                this.lastTriggerTime = now;
                this.uiController.updateLastControl(now);
                this.uiController.addLog(`エアコンを停止しました (距離: ${Math.round(distance)}m)`);
                this.uiController.showNotification(result.message || 'エアコンを制御しました');
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
