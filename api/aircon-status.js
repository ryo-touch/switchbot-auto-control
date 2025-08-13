/**
 * エアコン状態取得API
 * SwitchBotデバイスの現在の状態を取得する
 */

// Netlify Functions では dotenv は不要（環境変数は自動注入される）
const {
    authenticateRequest,
    generateSignature,
    validateEnvironment
} = require('./utils/switchbot-auth');
const { handleError } = require('./utils/error-handler');
const { measurePerformance } = require('./utils/performance');

/**
 * エアコンの現在状態を取得
 * @param {Object} event - Netlify Functions event object
 * @param {Object} context - Netlify Functions context object
 * @returns {Object} エアコンの状態情報
 */
exports.handler = async (event, context) => {
    const startTime = Date.now();

    try {
        // 環境変数の検証
        const envCheck = validateEnvironment();
        if (!envCheck.valid) {
            return handleError(new Error(`環境設定エラー: ${envCheck.missing.join(', ')}`), 500);
        }

        // CORS対応
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: ''
            };
        }

        // GETメソッドのみ許可
        if (event.httpMethod !== 'GET') {
            return handleError(new Error('GET method required'), 405);
        }

        console.log('エアコン状態取得開始:', {
            timestamp: new Date().toISOString(),
            userAgent: event.headers['user-agent'] || 'unknown'
        });

        // SwitchBot認証情報を生成
        const { token, secret, deviceId } = {
            token: process.env.SWITCHBOT_TOKEN,
            secret: process.env.SWITCHBOT_SECRET,
            deviceId: process.env.AIRCON_DEVICE_ID
        };

        const timestamp = Date.now().toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const signature = generateSignature(token, secret, timestamp, nonce);

        // SwitchBot APIでデバイス状態を取得
        const apiUrl = `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`;

        console.log('SwitchBot API 呼び出し:', {
            url: apiUrl,
            deviceId: deviceId,
            timestamp: new Date().toISOString()
        });

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

        console.log('SwitchBot API レスポンス:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn('SwitchBot API エラー - 赤外線デバイス制限の可能性:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText
            });

            // 赤外線デバイスの場合、エラーレスポンスからも情報を取得を試行
            let errorData = null;
            try {
                errorData = JSON.parse(errorText);
            } catch (parseError) {
                console.log('エラーレスポンスのパース失敗:', parseError.message);
            }

            // 赤外線デバイスの制限による特別なエラーハンドリング
            if (response.status === 404 || errorText.includes('wrong deviceId')) {
                // 最後のコマンド履歴が不明な場合のフォールバック
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    },
                    body: JSON.stringify({
                        success: true,
                        power: 'unknown',
                        temperature: null,
                        mode: null,
                        timestamp: new Date().toISOString(),
                        deviceId: deviceId,
                        source: 'fallback',
                        note: '赤外線デバイスの制限により、最後のコマンド履歴を取得できません。状態は不明です。'
                    })
                };
            }

            throw new Error(`SwitchBot API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // APIレスポンスの解析（赤外線デバイス対応）
        let deviceStatus = null;
        let powerState = 'unknown';
        let isValidResponse = false;
        let responseSource = 'unknown';

        if (data.statusCode === 100 && data.body) {
            // 正常なレスポンス
            deviceStatus = data.body;
            powerState = deviceStatus.power || 'unknown';
            isValidResponse = true;
            responseSource = 'api_current_state';
            console.log('正常なAPI応答:', deviceStatus);
        } else if (data.statusCode === 190) {
            // 赤外線デバイス特有：最後のコマンド履歴
            console.log('赤外線デバイス - 最後のコマンド履歴を取得');
            if (data.body && data.body.power !== undefined) {
                powerState = data.body.power;
                deviceStatus = data.body;
                isValidResponse = true;
                responseSource = 'api_last_command';
            } else {
                // bodyが空またはpowerが未定義の場合
                deviceStatus = {};
                powerState = 'unknown';
                responseSource = 'api_last_command_empty';
            }
        } else {
            console.warn('予期しないAPIレスポンス:', data);
            // フォールバック: エラーでも状態不明として継続
            deviceStatus = {};
            responseSource = 'error_fallback';
        }

        // APIレスポンスの検証（190は赤外線デバイスの正常応答）
        if (data.statusCode === 190) {
            console.log('赤外線デバイス特有の応答: 状態履歴が存在しないため190応答（正常）');
        } else if (data.statusCode !== 100) {
            console.warn(`SwitchBot API returned status ${data.statusCode}: ${data.message || 'Unknown'}`);
            // エラーでも継続処理（赤外線デバイス対応）
        }

        // エアコンの電源状態を判定（修正済み）
        // deviceStatus と powerState は上記で既に設定済み

        const result = {
            success: true,
            power: powerState,
            temperature: deviceStatus?.temperature || null,
            mode: deviceStatus?.mode || null,
            fanSpeed: deviceStatus?.fanSpeed || null,
            timestamp: new Date().toISOString(),
            deviceId: deviceId,
            source: responseSource,
            note: responseSource === 'api_last_command' ?
                '赤外線デバイスの最後のコマンド履歴から状態を取得しました。' :
                responseSource === 'api_current_state' ?
                    '現在の状態を取得しました。' :
                    '状態の取得に制限があります。'
        };

        console.log('エアコン状態取得成功:', {
            power: powerState,
            temperature: deviceStatus.temperature,
            mode: deviceStatus.mode,
            processingTime: Date.now() - startTime
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('エアコン状態取得エラー:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        });

        return handleError(error, 500);
    } finally {
        // パフォーマンス測定
        measurePerformance('aircon-status', startTime);
    }
};
