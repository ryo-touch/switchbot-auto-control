/**
 * エアコン状態取得API
 * SwitchBotデバイスの現在の状態を取得する
 */

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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SwitchBot API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // APIレスポンスの検証
        if (data.statusCode !== 100) {
            throw new Error(`SwitchBot API returned error: ${data.message || 'Unknown error'}`);
        }

        // エアコンの電源状態を判定
        const deviceStatus = data.body;
        const powerState = deviceStatus.power || 'off'; // デフォルトはoff

        const result = {
            success: true,
            power: powerState,
            temperature: deviceStatus.temperature || null,
            mode: deviceStatus.mode || null,
            fanSpeed: deviceStatus.fanSpeed || null,
            timestamp: new Date().toISOString(),
            deviceId: deviceId
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
