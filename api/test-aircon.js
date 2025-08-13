/**
 * SwitchBot エアコン手動制御API
 * エンドポイント: POST /.netlify/functions/test-aircon
 */

const { createAuthHeaders, getBaseURL, getAirconDeviceId, isDebugMode } = require('./utils/switchbot-auth');
const { createErrorResponse, createSuccessResponse, handleSwitchBotError, logError, validateHttpMethod, createCorsResponse, COMMON_ERRORS } = require('./utils/error-handler');

/**
 * SwitchBot API にエアコン制御コマンドを送信
 * @param {string} action - 制御アクション ('on', 'off', 'toggle')
 * @returns {Promise<Object>} API レスポンス
 */
async function sendAirconCommand(action = 'off') {
    try {
        const headers = createAuthHeaders();
        const baseURL = getBaseURL();
        const deviceId = getAirconDeviceId();
        
        // SwitchBot API v1.1 エアコン制御コマンド
        const commandBody = {
            command: 'setAll',
            parameter: action,
            commandType: 'command'
        };
        
        const url = `${baseURL}/devices/${deviceId}/commands`;
        
        if (isDebugMode()) {
            console.log('[DEBUG] Sending aircon command:', {
                url,
                deviceId,
                command: commandBody,
                headers: { ...headers, Authorization: '[HIDDEN]', sign: '[HIDDEN]' }
            });
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(commandBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Aircon control failed: ${response.status}`);
            error.response = {
                status: response.status,
                data: { message: errorText }
            };
            throw error;
        }
        
        const data = await response.json();
        
        if (isDebugMode()) {
            console.log('[DEBUG] Aircon command response:', JSON.stringify(data, null, 2));
        }
        
        return {
            success: true,
            action,
            deviceId,
            response: data,
            timestamp: Date.now()
        };
        
    } catch (error) {
        logError('sendAirconCommand', error, { action, deviceId: getAirconDeviceId() });
        throw error;
    }
}

/**
 * アクションパラメータのバリデーション
 * @param {string} action - アクション名
 * @returns {Object} バリデーション結果
 */
function validateAction(action) {
    const validActions = ['on', 'off', 'toggle'];
    
    if (!action) {
        return {
            valid: false,
            error: 'アクションパラメータが必要です'
        };
    }
    
    if (!validActions.includes(action.toLowerCase())) {
        return {
            valid: false,
            error: `無効なアクションです。使用可能: ${validActions.join(', ')}`
        };
    }
    
    return {
        valid: true,
        action: action.toLowerCase()
    };
}

/**
 * リクエストボディを解析
 * @param {string} body - リクエストボディ
 * @returns {Object} 解析結果
 */
function parseRequestBody(body) {
    try {
        if (!body) {
            // デフォルトアクション
            return { action: 'off' };
        }
        
        const parsed = JSON.parse(body);
        return {
            action: parsed.action || 'off'
        };
        
    } catch (error) {
        throw new Error('リクエストボディのJSON解析に失敗しました');
    }
}

/**
 * 制御結果メッセージを生成
 * @param {string} action - 実行されたアクション
 * @returns {string} 結果メッセージ
 */
function generateResultMessage(action) {
    const messages = {
        'on': 'エアコンを起動しました',
        'off': 'エアコンを停止しました',
        'toggle': 'エアコンの状態を切り替えました'
    };
    
    return messages[action] || `エアコンを制御しました (${action})`;
}

/**
 * メイン処理関数
 * @param {Object} event - Netlify Functions イベント
 * @param {Object} context - Netlify Functions コンテキスト
 * @returns {Promise<Object>} レスポンス
 */
exports.handler = async (event, context) => {
    try {
        // CORS プリフライトリクエストの処理
        if (event.httpMethod === 'OPTIONS') {
            return createCorsResponse();
        }
        
        // HTTPメソッドの検証
        if (!validateHttpMethod(event.httpMethod, ['POST'])) {
            return createErrorResponse(405, COMMON_ERRORS.INVALID_METHOD.message);
        }
        
        if (isDebugMode()) {
            console.log('[DEBUG] Test aircon API called:', {
                method: event.httpMethod,
                body: event.body,
                timestamp: new Date().toISOString()
            });
        }
        
        // リクエストボディの解析
        const { action } = parseRequestBody(event.body);
        
        // アクションのバリデーション
        const validation = validateAction(action);
        if (!validation.valid) {
            return createErrorResponse(400, validation.error);
        }
        
        const validatedAction = validation.action;
        
        // エアコン制御実行
        const result = await sendAirconCommand(validatedAction);
        
        // 制御結果メッセージ生成
        const message = generateResultMessage(validatedAction);
        
        // レスポンスデータ作成
        const responseData = {
            action: validatedAction,
            message,
            deviceId: getAirconDeviceId(),
            timestamp: result.timestamp,
            ...(isDebugMode() && { 
                debug: {
                    apiResponse: result.response
                }
            })
        };
        
        if (isDebugMode()) {
            console.log('[DEBUG] Test aircon response:', JSON.stringify(responseData, null, 2));
        }
        
        return createSuccessResponse(responseData);
        
    } catch (error) {
        logError('test-aircon-api', error, {
            method: event.httpMethod,
            body: event.body
        });
        
        // 設定エラー（デバイスIDなど）
        if (error.message.includes('設定されていません') || error.message.includes('AIRCON_DEVICE_ID')) {
            return createErrorResponse(500, '設定エラー', error.message);
        }
        
        // バリデーションエラー
        if (error.message.includes('JSON解析') || error.message.includes('バリデーション')) {
            return createErrorResponse(400, error.message);
        }
        
        // SwitchBot APIエラー
        const { statusCode, message, details } = handleSwitchBotError(error);
        return createErrorResponse(statusCode, message, details);
    }
};
