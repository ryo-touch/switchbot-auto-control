/**
 * SwitchBot 位置チェック + エアコン制御API
 * エンドポイント: POST /.netlify/functions/location-check
 *
 * メイン機能：位置情報を受け取り、距離判定してエアコンを自動制御
 */

const { getHomeLocation, getTriggerDistance, getAirconDeviceId, createAuthHeaders, getBaseURL, isDebugMode } = require('./utils/switchbot-auth');
const { calculateDistance, shouldTriggerControl, validateCoordinates, formatDistance } = require('./utils/distance-calc');
const { createErrorResponse, createSuccessResponse, handleSwitchBotError, logError, validateHttpMethod, createCorsResponse, COMMON_ERRORS } = require('./utils/error-handler');

/**
 * 位置情報リクエストのバリデーション
 * @param {Object} body - リクエストボディ
 * @returns {Object} バリデーション結果
 */
function validateLocationRequest(body) {
    if (!body) {
        return {
            valid: false,
            error: 'リクエストボディが必要です'
        };
    }

    const { latitude, longitude, timestamp } = body;

    // 緯度・経度の必須チェック
    if (latitude === undefined || longitude === undefined) {
        return {
            valid: false,
            error: '緯度（latitude）と経度（longitude）が必要です'
        };
    }

    // 数値変換
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // 座標の妥当性チェック
    if (!validateCoordinates(lat, lon)) {
        return {
            valid: false,
            error: '無効な座標です（緯度: -90〜90, 経度: -180〜180）'
        };
    }

    // タイムスタンプの妥当性チェック（オプション）
    let validTimestamp = null;
    if (timestamp) {
        const ts = parseInt(timestamp);
        if (!isNaN(ts) && ts > 0) {
            // 過去24時間以内かチェック
            const now = Date.now();
            const dayAgo = now - (24 * 60 * 60 * 1000);
            if (ts >= dayAgo && ts <= now + (60 * 1000)) { // 1分の未来まで許可
                validTimestamp = ts;
            }
        }
    }

    return {
        valid: true,
        coordinates: { latitude: lat, longitude: lon },
        timestamp: validTimestamp || Date.now()
    };
}

/**
 * SwitchBot API にエアコン停止コマンドを送信
 * @returns {Promise<Object>} API レスポンス
 */
async function stopAircon() {
    try {
        const headers = createAuthHeaders();
        const baseURL = getBaseURL();
        const deviceId = getAirconDeviceId();

        const commandBody = {
            command: 'setAll',
            parameter: 'off',
            commandType: 'command'
        };

        const url = `${baseURL}/devices/${deviceId}/commands`;

        if (isDebugMode()) {
            console.log('[DEBUG] Stopping aircon:', {
                url,
                deviceId,
                command: commandBody
            });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(commandBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Aircon stop failed: ${response.status}`);
            error.response = {
                status: response.status,
                data: { message: errorText }
            };
            throw error;
        }

        const data = await response.json();

        if (isDebugMode()) {
            console.log('[DEBUG] Aircon stop response:', JSON.stringify(data, null, 2));
        }

        return data;

    } catch (error) {
        logError('stopAircon', error);
        throw error;
    }
}

/**
 * 位置情報と制御ロジックの処理
 * @param {Object} coordinates - 現在位置 {latitude, longitude}
 * @param {number} timestamp - タイムスタンプ
 * @returns {Promise<Object>} 制御結果
 */
async function processLocationAndControl(coordinates, timestamp) {
    try {
        // 自宅位置とトリガー距離を取得
        const homeLocation = getHomeLocation();
        const triggerDistance = getTriggerDistance();

        if (isDebugMode()) {
            console.log('[DEBUG] Location processing:', {
                current: coordinates,
                home: homeLocation,
                triggerDistance
            });
        }

        // 距離計算とトリガー判定
        const triggerResult = shouldTriggerControl(
            coordinates.latitude,
            coordinates.longitude,
            homeLocation.latitude,
            homeLocation.longitude,
            triggerDistance
        );

        let controlResult = null;
        let actionTaken = false;

        // トリガー条件が満たされた場合、エアコンを停止
        if (triggerResult.shouldTrigger) {
            try {
                controlResult = await stopAircon();
                actionTaken = true;

                if (isDebugMode()) {
                    console.log('[DEBUG] Aircon control executed:', controlResult);
                }
            } catch (controlError) {
                logError('aircon-control', controlError, {
                    distance: triggerResult.distance,
                    coordinates
                });
                throw controlError;
            }
        }

        return {
            distance: triggerResult.distance,
            threshold: triggerResult.threshold,
            triggered: actionTaken,
            action: actionTaken ? 'aircon_off' : null,
            message: actionTaken
                ? `エアコンを停止しました (距離: ${formatDistance(triggerResult.distance)})`
                : `自宅から${formatDistance(triggerResult.distance)}です`,
            controlResult,
            timestamp,
            location: {
                current: coordinates,
                home: homeLocation
            }
        };

    } catch (error) {
        logError('processLocationAndControl', error, { coordinates, timestamp });
        throw error;
    }
}

/**
 * リクエストボディを解析
 * @param {string} body - リクエストボディ
 * @returns {Object} 解析されたボディ
 */
function parseRequestBody(body) {
    try {
        if (!body) {
            throw new Error('リクエストボディが空です');
        }

        return JSON.parse(body);

    } catch (error) {
        if (error.message.includes('リクエストボディが空')) {
            throw error;
        }
        throw new Error('リクエストボディのJSON解析に失敗しました');
    }
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
            console.log('[DEBUG] Location check API called:', {
                method: event.httpMethod,
                body: event.body ? JSON.parse(event.body) : null,
                timestamp: new Date().toISOString()
            });
        }

        // リクエストボディの解析
        const requestBody = parseRequestBody(event.body);

        // 位置情報のバリデーション
        const validation = validateLocationRequest(requestBody);
        if (!validation.valid) {
            return createErrorResponse(400, validation.error);
        }

        const { coordinates, timestamp } = validation;

        // 位置情報処理と制御実行
        const result = await processLocationAndControl(coordinates, timestamp);

        // レスポンスデータ作成
        const responseData = {
            success: true,
            distance: result.distance,
            triggered: result.triggered,
            action: result.action,
            message: result.message,
            timestamp: result.timestamp,
            ...(isDebugMode() && {
                debug: {
                    location: result.location,
                    threshold: result.threshold,
                    controlResult: result.controlResult
                }
            })
        };

        if (isDebugMode()) {
            console.log('[DEBUG] Location check response:', JSON.stringify(responseData, null, 2));
        }

        return createSuccessResponse(responseData);

    } catch (error) {
        logError('location-check-api', error, {
            method: event.httpMethod,
            body: event.body
        });

        // 設定エラー
        if (error.message.includes('設定されていません') ||
            error.message.includes('HOME_LATITUDE') ||
            error.message.includes('HOME_LONGITUDE') ||
            error.message.includes('AIRCON_DEVICE_ID')) {
            return createErrorResponse(500, '設定エラー', error.message);
        }

        // バリデーションエラー
        if (error.message.includes('JSON解析') ||
            error.message.includes('リクエストボディ') ||
            error.message.includes('無効な座標')) {
            return createErrorResponse(400, error.message);
        }

        // 距離計算エラー
        if (error.message.includes('距離計算') || error.message.includes('トリガー判定')) {
            return createErrorResponse(422, '位置情報処理エラー', error.message);
        }

        // SwitchBot APIエラー
        const { statusCode, message, details } = handleSwitchBotError(error);
        return createErrorResponse(statusCode, message, details);
    }
};
