/**
 * パフォーマンス最適化ユーティリティ
 * キャッシュ、レスポンス圧縮、実行時間監視
 */

/**
 * 簡易メモリキャッシュ
 */
class SimpleCache {
    constructor(defaultTTL = 300000) { // デフォルト5分
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }
    
    /**
     * キャッシュに値を設定
     * @param {string} key - キー
     * @param {any} value - 値
     * @param {number} ttl - TTL（ミリ秒）
     */
    set(key, value, ttl = this.defaultTTL) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { value, expiry });
        
        // 古いエントリの削除（簡易GC）
        if (this.cache.size > 100) {
            this.cleanup();
        }
    }
    
    /**
     * キャッシュから値を取得
     * @param {string} key - キー
     * @returns {any} 値またはnull
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.value;
    }
    
    /**
     * 期限切れエントリを削除
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * キャッシュをクリア
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * キャッシュサイズを取得
     */
    size() {
        return this.cache.size;
    }
}

// グローバルキャッシュインスタンス
const globalCache = new SimpleCache();

/**
 * 実行時間を測定
 * @param {Function} fn - 実行する関数
 * @param {string} label - ラベル
 * @returns {Promise<any>} 関数の実行結果
 */
async function measureExecutionTime(fn, label = 'function') {
    const start = process.hrtime.bigint();
    
    try {
        const result = await fn();
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // ナノ秒をミリ秒に変換
        
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
        }
        
        return result;
    } catch (error) {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000;
        
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`[PERF] ${label} (error): ${duration.toFixed(2)}ms`);
        }
        
        throw error;
    }
}

/**
 * SwitchBot API レスポンスをキャッシュ
 * @param {string} deviceId - デバイスID
 * @param {Object} response - APIレスポンス
 * @param {number} ttl - キャッシュ時間（ミリ秒）
 */
function cacheSwitchBotResponse(deviceId, response, ttl = 30000) { // 30秒
    const key = `switchbot_${deviceId}_${Date.now().toString().slice(0, -4)}`; // 10秒単位でキー生成
    globalCache.set(key, response, ttl);
}

/**
 * キャッシュされたSwitchBot APIレスポンスを取得
 * @param {string} deviceId - デバイスID
 * @returns {Object|null} キャッシュされたレスポンス
 */
function getCachedSwitchBotResponse(deviceId) {
    const timeKey = Date.now().toString().slice(0, -4);
    const key = `switchbot_${deviceId}_${timeKey}`;
    return globalCache.get(key);
}

/**
 * 距離計算結果をキャッシュ
 * @param {number} lat1 - 緯度1
 * @param {number} lon1 - 経度1
 * @param {number} lat2 - 緯度2
 * @param {number} lon2 - 経度2
 * @param {number} distance - 計算結果
 */
function cacheDistanceCalculation(lat1, lon1, lat2, lon2, distance) {
    const key = `distance_${lat1.toFixed(6)}_${lon1.toFixed(6)}_${lat2.toFixed(6)}_${lon2.toFixed(6)}`;
    globalCache.set(key, distance, 600000); // 10分間キャッシュ
}

/**
 * キャッシュされた距離計算結果を取得
 * @param {number} lat1 - 緯度1
 * @param {number} lon1 - 経度1
 * @param {number} lat2 - 緯度2
 * @param {number} lon2 - 経度2
 * @returns {number|null} キャッシュされた距離
 */
function getCachedDistance(lat1, lon1, lat2, lon2) {
    const key = `distance_${lat1.toFixed(6)}_${lon1.toFixed(6)}_${lat2.toFixed(6)}_${lon2.toFixed(6)}`;
    return globalCache.get(key);
}

/**
 * レスポンスを圧縮すべきかどうか判定
 * @param {Object} event - Netlify Functions イベント
 * @param {number} contentLength - コンテンツサイズ
 * @returns {boolean} 圧縮すべきかどうか
 */
function shouldCompress(event, contentLength) {
    // 小さなレスポンスは圧縮しない
    if (contentLength < 1024) {
        return false;
    }
    
    // Accept-Encodingヘッダーをチェック
    const acceptEncoding = event.headers['accept-encoding'] || '';
    return acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate');
}

/**
 * エラーレスポンスの最適化
 * @param {Object} baseResponse - ベースレスポンス
 * @returns {Object} 最適化されたレスポンス
 */
function optimizeErrorResponse(baseResponse) {
    // 本番環境では詳細なエラー情報を削除
    if (process.env.NODE_ENV === 'production') {
        const body = JSON.parse(baseResponse.body);
        if (body.error && body.error.details) {
            delete body.error.details;
        }
        return {
            ...baseResponse,
            body: JSON.stringify(body)
        };
    }
    
    return baseResponse;
}

/**
 * レスポンスヘッダーを最適化
 * @param {Object} headers - 既存のヘッダー
 * @param {number} contentLength - コンテンツサイズ
 * @returns {Object} 最適化されたヘッダー
 */
function optimizeResponseHeaders(headers, contentLength) {
    const optimized = { ...headers };
    
    // キャッシュヘッダー
    if (!optimized['Cache-Control']) {
        optimized['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    }
    
    // コンテンツサイズ
    if (contentLength) {
        optimized['Content-Length'] = contentLength.toString();
    }
    
    // ETags for caching (簡易版)
    if (contentLength && !optimized['ETag']) {
        optimized['ETag'] = `"${contentLength}-${Date.now()}"`;
    }
    
    return optimized;
}

/**
 * メモリ使用量を監視
 * @returns {Object} メモリ使用状況
 */
function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        cacheSize: globalCache.size()
    };
}

/**
 * パフォーマンス統計をログ出力
 * @param {string} context - コンテキスト
 * @param {number} executionTime - 実行時間（ミリ秒）
 */
function logPerformanceStats(context, executionTime) {
    if (process.env.DEBUG_MODE === 'true') {
        const memory = getMemoryUsage();
        console.log(`[PERF] ${context}:`, {
            executionTime: `${executionTime.toFixed(2)}ms`,
            memory,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 重複リクエストを検出・防止
 * @param {string} requestId - リクエストID
 * @param {number} windowMs - 重複検出ウィンドウ（ミリ秒）
 * @returns {boolean} 重複リクエストかどうか
 */
function isDuplicateRequest(requestId, windowMs = 5000) {
    const key = `req_${requestId}`;
    const existing = globalCache.get(key);
    
    if (existing) {
        return true;
    }
    
    globalCache.set(key, true, windowMs);
    return false;
}

/**
 * リクエストIDを生成
 * @param {Object} event - Netlify Functions イベント
 * @returns {string} リクエストID
 */
function generateRequestId(event) {
    const body = event.body || '';
    const timestamp = Date.now().toString().slice(-6); // 最後の6桁
    const hash = body.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    
    return `${timestamp}_${Math.abs(hash).toString(16)}`;
}

module.exports = {
    SimpleCache,
    globalCache,
    measureExecutionTime,
    cacheSwitchBotResponse,
    getCachedSwitchBotResponse,
    cacheDistanceCalculation,
    getCachedDistance,
    shouldCompress,
    optimizeErrorResponse,
    optimizeResponseHeaders,
    getMemoryUsage,
    logPerformanceStats,
    isDuplicateRequest,
    generateRequestId
};
