/**
 * SwitchBot API v1.1 認証ヘルパー
 * HMAC-SHA256署名による認証ヘッダー生成
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * 環境変数から認証情報を取得
 */
function getCredentials() {
    const token = process.env.SWITCHBOT_TOKEN;
    const secret = process.env.SWITCHBOT_SECRET;
    
    if (!token || !secret) {
        throw new Error('SwitchBot認証情報が設定されていません（SWITCHBOT_TOKEN, SWITCHBOT_SECRET）');
    }
    
    return { token, secret };
}

/**
 * HMAC-SHA256署名を生成
 * @param {string} token - SwitchBot API トークン
 * @param {string} secret - SwitchBot API シークレット
 * @param {number} timestamp - タイムスタンプ（ミリ秒）
 * @param {string} nonce - 一意識別子
 * @returns {string} Base64エンコードされた署名
 */
function generateSignature(token, secret, timestamp, nonce) {
    const data = token + timestamp + nonce;
    return crypto.createHmac('sha256', secret)
                 .update(data, 'utf-8')
                 .digest('base64');
}

/**
 * SwitchBot API用の認証ヘッダーを生成
 * @returns {Object} APIリクエスト用ヘッダー
 */
function createAuthHeaders() {
    try {
        const { token, secret } = getCredentials();
        const timestamp = Date.now();
        const nonce = uuidv4();
        const signature = generateSignature(token, secret, timestamp, nonce);
        
        return {
            'Authorization': token,
            'sign': signature,
            't': timestamp.toString(),
            'nonce': nonce,
            'Content-Type': 'application/json'
        };
    } catch (error) {
        throw new Error(`認証ヘッダー生成エラー: ${error.message}`);
    }
}

/**
 * 認証情報の妥当性を検証
 * @returns {boolean} 認証情報が有効かどうか
 */
function validateCredentials() {
    try {
        const { token, secret } = getCredentials();
        return !!(token && secret && token.length > 0 && secret.length > 0);
    } catch (error) {
        return false;
    }
}

/**
 * SwitchBot API用のベースURL取得
 * @returns {string} ベースURL
 */
function getBaseURL() {
    return 'https://api.switch-bot.com/v1.1';
}

/**
 * デバイスID取得
 * @returns {string} エアコンのデバイスID
 */
function getAirconDeviceId() {
    const deviceId = process.env.AIRCON_DEVICE_ID;
    if (!deviceId) {
        throw new Error('エアコンデバイスIDが設定されていません（AIRCON_DEVICE_ID）');
    }
    return deviceId;
}

/**
 * ホーム位置情報取得
 * @returns {Object} 自宅の緯度・経度
 */
function getHomeLocation() {
    const latitude = parseFloat(process.env.HOME_LATITUDE);
    const longitude = parseFloat(process.env.HOME_LONGITUDE);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('自宅位置が正しく設定されていません（HOME_LATITUDE, HOME_LONGITUDE）');
    }
    
    return { latitude, longitude };
}

/**
 * トリガー距離取得
 * @returns {number} トリガー距離（メートル）
 */
function getTriggerDistance() {
    const distance = parseInt(process.env.TRIGGER_DISTANCE) || 100;
    return distance;
}

/**
 * デバッグモード判定
 * @returns {boolean} デバッグモードかどうか
 */
function isDebugMode() {
    return process.env.DEBUG_MODE === 'true';
}

module.exports = {
    getCredentials,
    generateSignature,
    createAuthHeaders,
    validateCredentials,
    getBaseURL,
    getAirconDeviceId,
    getHomeLocation,
    getTriggerDistance,
    isDebugMode
};
