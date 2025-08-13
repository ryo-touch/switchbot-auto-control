/**
 * SwitchBot 位置チェック + エアコン制御API
 * エンドポイント: POST /.netlify/functions/location-check
 *
 * メイン機能：位置情報を受け取り、距離判定してエアコンを自動制御
 */

// Netlify Functions では dotenv は不要（環境変数は自動注入される）
const { getHomeLocation, getTriggerDistance, getAirconDeviceId, createAuthHeaders, getBaseURL, isDebugMode, generateSignature } = require('./utils/switchbot-auth');
const { calculateDistance, shouldTriggerControl, validateCoordinates, formatDistance } = require('./utils/distance-calc');
const { createErrorResponse, createSuccessResponse, handleSwitchBotError, logError, validateHttpMethod, createCorsResponse, COMMON_ERRORS } = require('./utils/error-handler');

/**
 * エアコンの現在状態を取得（ローカル状態管理APIを使用）
 * @returns {Promise<Object>} 状態情報
 */
async function getAirconCurrentState() {
    try {
        // まずローカル状態管理APIから状態を取得（優先）
        try {
            const { handler: stateHandler } = require('./aircon-state-manager');
            const stateEvent = {
                httpMethod: 'GET',
                headers: { 'content-type': 'application/json' }
            };

            const stateResult = await stateHandler(stateEvent, {});
            if (stateResult.statusCode === 200) {
                const stateData = JSON.parse(stateResult.body);
                if (stateData.success && stateData.state && stateData.state.power !== 'unknown') {
                    console.log('[DEBUG] Using local state (priority):', stateData.state);
                    return {
                        power: stateData.state.power,
                        timestamp: stateData.timestamp,
                        source: 'local_state_manager'
                    };
                }
            }
        } catch (localError) {
            console.warn('[WARNING] Local state manager error:', localError.message);
        }

        // ローカル状態が不明または利用できない場合、SwitchBot APIを試行
        const {
            token,
            secret,
            deviceId
        } = {
            token: process.env.SWITCHBOT_TOKEN,
            secret: process.env.SWITCHBOT_SECRET,
            deviceId: process.env.AIRCON_DEVICE_ID
        };

        const timestamp = Date.now().toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const signature = generateSignature(token, secret, timestamp, nonce);

        const apiUrl = `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'sign': signature,
                't': timestamp,
                'nonce': nonce,
                'Content-Type': 'application/json'
            }
        });

        console.log('[DEBUG] SwitchBot API status check:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('[DEBUG] SwitchBot API response:', data);

            // 特別なケース：赤外線デバイスで statusCode 190
            if (data.statusCode === 190 && data.message === 'wrong deviceId') {
                // これは「最後のコマンド履歴が空」を意味する可能性
                console.log('[DEBUG] No recent command history - assuming OFF');
                return {
                    power: 'off',
                    timestamp: new Date().toISOString(),
                    source: 'api_inferred_from_empty_history'
                };
            }

            if (data.statusCode === 100 && data.body) {
                return {
                    power: data.body.power || 'unknown',
                    timestamp: new Date().toISOString(),
                    source: 'switchbot_api'
                };
            }
        }

        // フォールバック：状態不明
        console.log('[DEBUG] All state check methods failed, returning unknown');
        return {
            power: 'unknown',
            timestamp: new Date().toISOString(),
            source: 'error_fallback'
        };

    } catch (error) {
        console.warn('getAirconCurrentState error:', error.message);
        return {
            power: 'unknown',
            timestamp: new Date().toISOString(),
            source: 'error_fallback'
        };
    }
}/**
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
 * エアコンの現在状態を確認してから制御を実行
 * @returns {Promise<Object>} 制御結果
 */
async function stopAircon() {
    try {
        console.log('[DEBUG] ===== stopAircon 開始 =====');

        // まず現在の状態を確認（ローカル状態管理を優先）
        const currentState = await getAirconCurrentState();

        console.log('[DEBUG] Current aircon state check result:', {
            power: currentState.power,
            source: currentState.source,
            timestamp: currentState.timestamp
        });

        // 🔧 修正: 赤外線デバイスでは状態不明が正常なので、常にOFFコマンドを送信
        // 安全性を重視し、位置トリガー時は必ずOFFコマンドを実行
        console.log('[DEBUG] Position-based trigger detected - executing OFF command regardless of state');
        console.log('[SAFETY] For infrared devices, state is often unknown, so we always send OFF command');

        const result = await executeAirconOff();
        console.log('[DEBUG] ===== stopAircon 完了 (制御実行) =====');
        return result;

    } catch (error) {
        console.error('[ERROR] stopAircon error:', error);
        // エラーが発生した場合も安全のためOFFコマンドを実行
        console.log('[FALLBACK] Executing OFF command due to state check error');
        try {
            const result = await executeAirconOff();
            console.log('[DEBUG] ===== stopAircon 完了 (フォールバック実行) =====');
            return result;
        } catch (fallbackError) {
            console.error('[ERROR] Fallback execution also failed:', fallbackError);
            throw fallbackError;
        }
    }
}

/**
 * 実際のエアコンOFFコマンドを実行
 * @returns {Promise<Object>} API レスポンス
 */
async function executeAirconOff() {
    try {
        console.log('[DEBUG] ===== executeAirconOff 開始 =====');

        // 🔧 環境変数の詳細確認（デバッグ強化）
        const {
            token: envToken,
            secret: envSecret,
            deviceId: envDeviceId
        } = {
            token: process.env.SWITCHBOT_TOKEN,
            secret: process.env.SWITCHBOT_SECRET,
            deviceId: process.env.AIRCON_DEVICE_ID
        };

        console.log('[DEBUG] 🔍 環境変数チェック:', {
            tokenExists: !!envToken,
            tokenLength: envToken ? envToken.length : 0,
            tokenPrefix: envToken ? envToken.substring(0, 8) + '...' : 'MISSING',
            secretExists: !!envSecret,
            secretLength: envSecret ? envSecret.length : 0,
            deviceIdExists: !!envDeviceId,
            deviceIdMasked: envDeviceId ? envDeviceId.substring(0, 4) + '***' + envDeviceId.substring(-2) : 'MISSING',
            timestamp: new Date().toISOString()
        });

        if (!envToken || !envSecret || !envDeviceId) {
            const missingVars = [];
            if (!envToken) missingVars.push('SWITCHBOT_TOKEN');
            if (!envSecret) missingVars.push('SWITCHBOT_SECRET');
            if (!envDeviceId) missingVars.push('AIRCON_DEVICE_ID');
            throw new Error(`🚨 必須環境変数が不足: ${missingVars.join(', ')}`);
        }

        // 🔧 認証ヘッダー生成の詳細ログ
        const timestamp = Date.now().toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const { generateSignature } = require('./utils/switchbot-auth');
        const signature = generateSignature(envToken, envSecret, timestamp, nonce);

        console.log('[DEBUG] 🔐 認証情報生成:', {
            timestamp,
            nonce,
            signatureLength: signature.length,
            signaturePrefix: signature.substring(0, 12) + '...'
        });

        const headers = {
            'Authorization': envToken,
            'sign': signature,
            't': timestamp,
            'nonce': nonce,
            'Content-Type': 'application/json'
        };

        const baseURL = getBaseURL();
        const deviceId = getAirconDeviceId();

        const commandBody = {
            command: 'setAll',
            parameter: '26,1,1,off',  // 26度、自動モード、低風量、電源OFF
            commandType: 'command'
        };

        const url = `${baseURL}/devices/${deviceId}/commands`;

        console.log('[DEBUG] 📡 API リクエスト詳細:', {
            url,
            deviceIdMasked: deviceId ? deviceId.substring(0, 4) + '***' + deviceId.substring(-2) : 'MISSING',
            command: commandBody,
            timestamp: new Date().toISOString(),
            headersInfo: {
                authorization: '[MASKED]',
                sign: '[MASKED]',
                t: timestamp,
                nonce: nonce,
                contentType: headers['Content-Type']
            }
        });

        // 🔧 リクエスト実行と詳細計測
        const startTime = Date.now();

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(commandBody)
        });

        const responseTime = Date.now() - startTime;

        console.log('[DEBUG] 📥 HTTP レスポンス詳細:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            responseTime: `${responseTime}ms`,
            headers: Object.fromEntries(response.headers.entries()),
            url: response.url
        });

        // 🔧 レスポンス内容の詳細解析
        const responseText = await response.text();
        console.log('[DEBUG] 📄 生レスポンステキスト:', responseText);

        if (!response.ok) {
            console.error('[ERROR] 🚨 API リクエスト失敗:', {
                status: response.status,
                statusText: response.statusText,
                responseText: responseText,
                responseTime: `${responseTime}ms`
            });
            const error = new Error(`Aircon stop failed: ${response.status} - ${responseText}`);
            error.response = {
                status: response.status,
                data: { message: responseText }
            };
            throw error;
        }

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('[DEBUG] 🎯 パース済みレスポンス:', JSON.stringify(data, null, 2));
        } catch (parseError) {
            console.error('[ERROR] JSON パースエラー:', parseError.message);
            data = { raw: responseText, parseError: parseError.message };
        }

        // 🔧 SwitchBot特有のレスポンス構造解析
        if (data.statusCode !== undefined) {
            console.log('[DEBUG] 🔍 SwitchBot レスポンス解析:', {
                statusCode: data.statusCode,
                message: data.message,
                isSuccess: data.statusCode === 100,
                isDeviceNotFound: data.statusCode === 190,
                isInvalidParameter: data.statusCode === 151,
                timestamp: new Date().toISOString()
            });

            // ❌ エラーケースの詳細ログ
            if (data.statusCode !== 100) {
                console.error('[ERROR] 🚨 SwitchBot APIエラー:', {
                    statusCode: data.statusCode,
                    message: data.message,
                    possibleCauses: getSwitchBotErrorCauses(data.statusCode),
                    timestamp: new Date().toISOString()
                });
            } else {
                // ✅ 成功時も詳細ログを出力
                console.log('[SUCCESS] ✅ SwitchBot API制御成功:', {
                    statusCode: data.statusCode,
                    message: data.message,
                    commandSent: 'setAll(26,1,1,off)',
                    parameter: '',
                    timestamp: new Date().toISOString(),
                    note: '物理デバイスの動作確認が必要'
                });
            }
        }

        // 🔧 制御後の状態確認を追加（3秒後）
        console.log('[DEBUG] ⏱️ 制御後状態確認のため3秒待機...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            const postControlState = await getAirconCurrentState();
            console.log('[DEBUG] 🔍 制御後の状態確認:', postControlState);
        } catch (stateError) {
            console.warn('[WARNING] 制御後状態確認エラー:', stateError.message);
        }

        // OFFコマンド成功後に状態を更新
        try {
            await updateLocalAirconState({ power: 'off', source: 'location_control' });
            console.log('[DEBUG] ✅ ローカル状態をOFFに更新完了');
        } catch (updateError) {
            console.warn('[WARNING] ⚠️ ローカル状態更新失敗:', updateError.message);
        }

        console.log('[DEBUG] ===== executeAirconOff 完了 =====');
        return data;

    } catch (error) {
        console.error('[ERROR] 🚨 executeAirconOff エラー:', error);
        logError('stopAircon', error);
        throw error;
    }
}

/**
 * SwitchBot APIエラーコードの原因分析
 * @param {number} statusCode - SwitchBot APIステータスコード
 * @returns {Array<string>} 考えられる原因のリスト
 */
function getSwitchBotErrorCauses(statusCode) {
    const causes = {
        151: [
            'デバイスIDが間違っている',
            'デバイスがオフラインまたは接続不良',
            'Hub2の電源・WiFi接続を確認'
        ],
        161: [
            'コマンドフォーマットが不正',
            'parameter値が不適切',
            'デバイスタイプとコマンドが不一致'
        ],
        171: [
            'Hub2が範囲外または電波が届かない',
            'デバイスの赤外線学習が不完全',
            '物理的な障害物の確認が必要'
        ],
        190: [
            'デバイスIDが存在しない',
            'アカウントに登録されていないデバイス',
            'APIとアプリの設定不一致'
        ]
    };
    return causes[statusCode] || ['不明なエラー - SwitchBotサポートに確認'];
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
            console.log('[DEBUG] ===== トリガー条件満たしているため制御実行 =====');
            try {
                controlResult = await stopAircon();
                actionTaken = controlResult && !controlResult.body?.skipped;

                console.log('[DEBUG] Control execution result:', {
                    actionTaken: actionTaken,
                    skipped: controlResult?.body?.skipped,
                    statusCode: controlResult?.statusCode,
                    message: controlResult?.message
                });

            } catch (controlError) {
                console.error('[ERROR] Control execution failed:', controlError);
                logError('aircon-control', controlError, {
                    distance: triggerResult.distance,
                    coordinates
                });
                throw controlError;
            }
        } else {
            console.log('[DEBUG] トリガー条件を満たしていないため制御スキップ');
        }

        // レスポンスメッセージの生成
        let message;
        if (actionTaken) {
            message = `エアコンを停止しました (距離: ${formatDistance(triggerResult.distance)})`;
        } else if (triggerResult.shouldTrigger && controlResult?.body?.skipped) {
            message = `エアコンは既にOFFです (距離: ${formatDistance(triggerResult.distance)})`;
        } else {
            message = `自宅から${formatDistance(triggerResult.distance)}です`;
        }

        return {
            distance: triggerResult.distance,
            threshold: triggerResult.threshold,
            triggered: triggerResult.shouldTrigger,
            action: actionTaken ? 'aircon_off' : controlResult?.body?.skipped ? 'already_off' : null,
            message: message,
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

/**
 * ローカル状態管理APIを更新
 * @param {Object} stateData - 更新する状態データ
 * @returns {Promise<boolean>} 更新成功フラグ
 */
async function updateLocalAirconState(stateData) {
    try {
        const { handler: stateHandler } = require('./aircon-state-manager');
        const updateEvent = {
            httpMethod: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(stateData)
        };

        const updateResult = await stateHandler(updateEvent, {});
        return updateResult.statusCode === 200;
    } catch (error) {
        console.error('updateLocalAirconState error:', error);
        return false;
    }
}
