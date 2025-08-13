/**
 * セキュリティユーティリティ
 * CORS設定、レート制限、入力サニタイゼーション
 */

/**
 * 許可されたオリジンを取得
 * @returns {Array} 許可されたオリジン一覧
 */
function getAllowedOrigins() {
    const origins = process.env.ALLOWED_ORIGINS;
    if (!origins) {
        // デフォルトで localhost と一般的な開発環境を許可
        return [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        ];
    }

    return origins.split(',').map(origin => origin.trim());
}

/**
 * オリジンの妥当性をチェック
 * @param {string} origin - リクエストのオリジン
 * @returns {boolean} 許可されたオリジンかどうか
 */
function isOriginAllowed(origin) {
    if (!origin) {
        return true; // オリジンヘッダーがない場合は許可（サーバー間通信など）
    }

    const allowedOrigins = getAllowedOrigins();
    return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}

/**
 * 安全なCORSヘッダーを生成
 * @param {string} origin - リクエストのオリジン
 * @returns {Object} CORSヘッダー
 */
function createSecureCorsHeaders(origin = null) {
    const allowedOrigin = isOriginAllowed(origin) ? (origin || '*') : 'null';

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

/**
 * レート制限チェック（簡易版）
 * 本格的な実装にはRedisなどが必要だが、ここではメモリベース
 */
const requestCounts = new Map();

/**
 * IP アドレスを取得
 * @param {Object} event - Netlify Functions イベント
 * @returns {string} クライアントIP
 */
function getClientIP(event) {
    return event.headers['x-forwarded-for'] ||
           event.headers['x-real-ip'] ||
           event.headers['cf-connecting-ip'] ||
           'unknown';
}

/**
 * レート制限をチェック
 * @param {string} ip - クライアントIP
 * @param {number} maxRequests - 最大リクエスト数
 * @param {number} windowMs - ウィンドウ時間（ミリ秒）
 * @returns {Object} レート制限結果
 */
function checkRateLimit(ip, maxRequests = 60, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // 古いエントリを削除
    if (requestCounts.has(ip)) {
        const requests = requestCounts.get(ip).filter(time => time > windowStart);
        requestCounts.set(ip, requests);
    } else {
        requestCounts.set(ip, []);
    }

    const currentRequests = requestCounts.get(ip);

    // 制限チェック
    if (currentRequests.length >= maxRequests) {
        return {
            allowed: false,
            remainingRequests: 0,
            resetTime: Math.ceil((currentRequests[0] + windowMs) / 1000)
        };
    }

    // リクエストを記録
    currentRequests.push(now);
    requestCounts.set(ip, currentRequests);

    return {
        allowed: true,
        remainingRequests: maxRequests - currentRequests.length,
        resetTime: Math.ceil((now + windowMs) / 1000)
    };
}

/**
 * 入力値のサニタイゼーション
 * @param {any} input - 入力値
 * @returns {any} サニタイズされた値
 */
function sanitizeInput(input) {
    if (typeof input === 'string') {
        // HTMLエスケープ
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }

    if (typeof input === 'number') {
        // 数値の範囲チェック
        if (isNaN(input) || !isFinite(input)) {
            throw new Error('無効な数値です');
        }
        return input;
    }

    if (typeof input === 'object' && input !== null) {
        // オブジェクトの再帰的サニタイズ
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[sanitizeInput(key)] = sanitizeInput(value);
        }
        return sanitized;
    }

    return input;
}

/**
 * 座標値の安全性チェック
 * @param {number} latitude - 緯度
 * @param {number} longitude - 経度
 * @returns {boolean} 安全な座標かどうか
 */
function isSafeCoordinate(latitude, longitude) {
    // 基本的な範囲チェック
    if (isNaN(latitude) || isNaN(longitude)) {
        return false;
    }

    if (latitude < -90 || latitude > 90) {
        return false;
    }

    if (longitude < -180 || longitude > 180) {
        return false;
    }

    // 異常に精密すぎる座標をブロック（プライバシー考慮）
    const latPrecision = (latitude.toString().split('.')[1] || '').length;
    const lonPrecision = (longitude.toString().split('.')[1] || '').length;

    if (latPrecision > 8 || lonPrecision > 8) {
        return false;
    }

    return true;
}

/**
 * セキュリティヘッダーを追加
 * @param {Object} headers - 既存のヘッダー
 * @returns {Object} セキュリティヘッダー付きヘッダー
 */
function addSecurityHeaders(headers = {}) {
    return {
        ...headers,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    };
}

/**
 * リクエストの妥当性を総合的にチェック
 * @param {Object} event - Netlify Functions イベント
 * @param {Object} options - チェックオプション
 * @returns {Object} バリデーション結果
 */
function validateRequest(event, options = {}) {
    const {
        allowedMethods = ['GET', 'POST'],
        requireBody = false,
        maxBodySize = 1024 * 10, // 10KB
        enableRateLimit = true
    } = options;

    // HTTPメソッドチェック
    if (!allowedMethods.includes(event.httpMethod.toUpperCase())) {
        return {
            valid: false,
            error: '許可されていないHTTPメソッドです',
            statusCode: 405
        };
    }

    // オリジンチェック
    const origin = event.headers.origin || event.headers.Origin;
    if (!isOriginAllowed(origin)) {
        return {
            valid: false,
            error: '許可されていないオリジンです',
            statusCode: 403
        };
    }

    // ボディサイズチェック
    if (event.body && event.body.length > maxBodySize) {
        return {
            valid: false,
            error: 'リクエストボディが大きすぎます',
            statusCode: 413
        };
    }

    // 必須ボディチェック
    if (requireBody && !event.body) {
        return {
            valid: false,
            error: 'リクエストボディが必要です',
            statusCode: 400
        };
    }

    // レート制限チェック
    if (enableRateLimit) {
        const ip = getClientIP(event);
        const maxRequests = parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60;
        const rateLimit = checkRateLimit(ip, maxRequests);

        if (!rateLimit.allowed) {
            return {
                valid: false,
                error: 'レート制限に達しました',
                statusCode: 429,
                headers: {
                    'X-RateLimit-Limit': maxRequests.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimit.resetTime.toString()
                }
            };
        }
    }

    return {
        valid: true,
        clientIP: getClientIP(event),
        origin
    };
}

module.exports = {
    getAllowedOrigins,
    isOriginAllowed,
    createSecureCorsHeaders,
    getClientIP,
    checkRateLimit,
    sanitizeInput,
    isSafeCoordinate,
    addSecurityHeaders,
    validateRequest
};
