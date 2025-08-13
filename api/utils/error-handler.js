/**
 * エラーハンドリング ユーティリティ
 * 統一されたエラーレスポンスとSwitchBot APIエラーのマッピング
 */

/**
 * 標準的なエラーレスポンスを作成
 * @param {number} statusCode - HTTPステータスコード
 * @param {string} message - エラーメッセージ
 * @param {Object} details - 詳細情報（オプション）
 * @returns {Object} Netlify Functions用レスポンス
 */
function createErrorResponse(statusCode, message, details = null) {
    const response = {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
            success: false,
            error: {
                message,
                code: statusCode,
                timestamp: new Date().toISOString(),
                ...(details && { details })
            }
        })
    };
    
    return response;
}

/**
 * 成功レスポンスを作成
 * @param {Object} data - レスポンスデータ
 * @param {number} statusCode - HTTPステータスコード（デフォルト: 200）
 * @returns {Object} Netlify Functions用レスポンス
 */
function createSuccessResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            ...data
        })
    };
}

/**
 * SwitchBot APIエラーをマッピング
 * @param {Error} error - エラーオブジェクト
 * @returns {Object} マッピング済みエラー情報
 */
function handleSwitchBotError(error) {
    // レスポンスからステータスコードを取得
    let statusCode = 500;
    let message = 'SwitchBot APIでエラーが発生しました';
    let details = null;
    
    if (error.response) {
        statusCode = error.response.status;
        
        switch (statusCode) {
            case 401:
                message = 'SwitchBot API認証に失敗しました';
                details = 'トークンまたはシークレットを確認してください';
                break;
            case 403:
                message = 'SwitchBot API アクセスが拒否されました';
                details = 'デバイスへのアクセス権限を確認してください';
                break;
            case 404:
                message = 'デバイスが見つかりません';
                details = 'デバイスIDを確認してください';
                break;
            case 429:
                message = 'SwitchBot API制限に達しました';
                details = 'しばらく待ってから再試行してください（1日1000回制限）';
                break;
            case 500:
            case 502:
            case 503:
                message = 'SwitchBot APIサーバーエラー';
                details = 'SwitchBotサービス側の問題です';
                break;
            default:
                message = `SwitchBot API エラー (${statusCode})`;
        }
        
        // レスポンスボディにエラー詳細がある場合
        if (error.response.data) {
            details = error.response.data.message || details;
        }
    } else if (error.code) {
        // ネットワークエラーなど
        switch (error.code) {
            case 'ENOTFOUND':
            case 'ECONNREFUSED':
                statusCode = 503;
                message = 'SwitchBot APIに接続できません';
                details = 'ネットワーク接続を確認してください';
                break;
            case 'ETIMEDOUT':
                statusCode = 408;
                message = 'SwitchBot API応答タイムアウト';
                details = 'リクエストがタイムアウトしました';
                break;
            default:
                statusCode = 500;
                message = 'ネットワークエラーが発生しました';
                details = error.message;
        }
    }
    
    return { statusCode, message, details };
}

/**
 * バリデーションエラーを処理
 * @param {string} field - フィールド名
 * @param {string} requirement - 要求事項
 * @returns {Object} バリデーションエラー情報
 */
function createValidationError(field, requirement) {
    return {
        statusCode: 400,
        message: `バリデーションエラー: ${field}`,
        details: requirement
    };
}

/**
 * エラーをログ出力
 * @param {string} context - エラーコンテキスト
 * @param {Error} error - エラーオブジェクト
 * @param {Object} additionalInfo - 追加情報
 */
function logError(context, error, additionalInfo = {}) {
    const logData = {
        timestamp: new Date().toISOString(),
        context,
        error: {
            message: error.message,
            stack: error.stack,
            ...(error.response && {
                status: error.response.status,
                data: error.response.data
            })
        },
        ...additionalInfo
    };
    
    // デバッグモードの場合は詳細を出力
    if (process.env.DEBUG_MODE === 'true') {
        console.error('[DEBUG] Error Details:', JSON.stringify(logData, null, 2));
    } else {
        console.error(`[${context}] ${error.message}`);
    }
}

/**
 * HTTPメソッドの妥当性チェック
 * @param {string} actualMethod - 実際のHTTPメソッド
 * @param {Array} allowedMethods - 許可されるメソッド配列
 * @returns {boolean} メソッドが許可されているか
 */
function validateHttpMethod(actualMethod, allowedMethods) {
    return allowedMethods.includes(actualMethod.toUpperCase());
}

/**
 * OPTIONSリクエスト用のCORSレスポンス
 * @returns {Object} CORSプリフライトレスポンス
 */
function createCorsResponse() {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        },
        body: ''
    };
}

/**
 * 標準的なエラーレスポンス定数
 */
const COMMON_ERRORS = {
    INVALID_METHOD: {
        statusCode: 405,
        message: '許可されていないHTTPメソッドです'
    },
    MISSING_BODY: {
        statusCode: 400,
        message: 'リクエストボディが必要です'
    },
    INVALID_JSON: {
        statusCode: 400,
        message: '無効なJSON形式です'
    },
    INTERNAL_ERROR: {
        statusCode: 500,
        message: '内部サーバーエラーが発生しました'
    },
    UNAUTHORIZED: {
        statusCode: 401,
        message: '認証が必要です'
    },
    FORBIDDEN: {
        statusCode: 403,
        message: 'アクセスが拒否されました'
    }
};

module.exports = {
    createErrorResponse,
    createSuccessResponse,
    handleSwitchBotError,
    createValidationError,
    logError,
    validateHttpMethod,
    createCorsResponse,
    COMMON_ERRORS
};
