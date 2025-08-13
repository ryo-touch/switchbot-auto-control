/**
 * SwitchBot デバイス一覧取得API
 * エンドポイント: GET /.netlify/functions/devices
 */

// Netlify Functions では dotenv は不要（環境変数は自動注入される）
const { createAuthHeaders, getBaseURL, isDebugMode } = require('./utils/switchbot-auth');
const { createErrorResponse, createSuccessResponse, handleSwitchBotError, logError, validateHttpMethod, createCorsResponse } = require('./utils/error-handler');

/**
 * SwitchBot API からデバイス一覧を取得
 * @returns {Promise<Object>} デバイス一覧
 */
async function fetchDevices() {
    try {
        const headers = createAuthHeaders();
        const baseURL = getBaseURL();

        if (isDebugMode()) {
            console.log('[DEBUG] Fetching devices from:', `${baseURL}/devices`);
        }

        // Node.js 18+ の fetch を使用
        const response = await fetch(`${baseURL}/devices`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`API request failed: ${response.status}`);
            error.response = {
                status: response.status,
                data: { message: errorText }
            };
            throw error;
        }

        const data = await response.json();

        if (isDebugMode()) {
            console.log('[DEBUG] Devices response:', JSON.stringify(data, null, 2));
        }

        return data;

    } catch (error) {
        logError('fetchDevices', error);
        throw error;
    }
}

/**
 * デバイスリストをフィルタリングして整形
 * @param {Object} apiResponse - SwitchBot APIレスポンス
 * @returns {Array} 整形されたデバイス一覧
 */
function formatDeviceList(apiResponse) {
    const devices = [];

    // 物理デバイス
    if (apiResponse.body && apiResponse.body.deviceList) {
        apiResponse.body.deviceList.forEach(device => {
            devices.push({
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                deviceType: device.deviceType,
                hubDeviceId: device.hubDeviceId || null,
                category: 'device'
            });
        });
    }

    // 赤外線デバイス
    if (apiResponse.body && apiResponse.body.infraredRemoteList) {
        apiResponse.body.infraredRemoteList.forEach(device => {
            devices.push({
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                deviceType: device.remoteType,
                hubDeviceId: device.hubDeviceId,
                category: 'infrared'
            });
        });
    }

    return devices;
}

/**
 * エアコンデバイスを検索
 * @param {Array} devices - デバイス一覧
 * @returns {Array} エアコンデバイス一覧
 */
function findAirConditioners(devices) {
    return devices.filter(device =>
        device.deviceType === 'Air Conditioner' ||
        device.deviceType === 'DIY Air Conditioner' ||
        device.deviceName.toLowerCase().includes('aircon') ||
        device.deviceName.toLowerCase().includes('エアコン')
    );
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
        if (!validateHttpMethod(event.httpMethod, ['GET'])) {
            return createErrorResponse(405, '許可されていないHTTPメソッドです');
        }

        if (isDebugMode()) {
            console.log('[DEBUG] Devices API called:', {
                method: event.httpMethod,
                headers: event.headers,
                timestamp: new Date().toISOString()
            });
        }

        // SwitchBot APIからデバイス一覧を取得
        const apiResponse = await fetchDevices();

        // デバイス一覧を整形
        const devices = formatDeviceList(apiResponse);

        // エアコンデバイスを特定
        const airConditioners = findAirConditioners(devices);

        // レスポンスデータ作成
        const responseData = {
            devices,
            airConditioners,
            summary: {
                totalDevices: devices.length,
                physicalDevices: devices.filter(d => d.category === 'device').length,
                infraredDevices: devices.filter(d => d.category === 'infrared').length,
                airConditionerCount: airConditioners.length
            }
        };

        if (isDebugMode()) {
            console.log('[DEBUG] Response data:', JSON.stringify(responseData, null, 2));
        }

        return createSuccessResponse(responseData);

    } catch (error) {
        logError('devices-api', error, {
            method: event.httpMethod,
            path: event.path
        });

        // SwitchBot APIエラーの場合
        const { statusCode, message, details } = handleSwitchBotError(error);
        return createErrorResponse(statusCode, message, details);
    }
};
