/**
 * 設定情報取得API
 * エンドポイント: GET /.netlify/functions/config
 */

const { getHomeLocation, getTriggerDistance, isDebugMode } = require('./utils/switchbot-auth');
const { createErrorResponse, createSuccessResponse, logError, validateHttpMethod, createCorsResponse } = require('./utils/error-handler');

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
            console.log('[DEBUG] Config API called:', {
                method: event.httpMethod,
                timestamp: new Date().toISOString()
            });
        }

        // 設定情報を取得
        const homeLocation = getHomeLocation();
        const triggerDistance = getTriggerDistance();

        // レスポンスデータ作成
        const responseData = {
            homeLocation: {
                latitude: homeLocation.latitude,
                longitude: homeLocation.longitude
            },
            triggerDistance,
            debugMode: isDebugMode(),
            readonly: true // フロントエンドで編集不可であることを示す
        };

        if (isDebugMode()) {
            console.log('[DEBUG] Config response:', JSON.stringify(responseData, null, 2));
        }

        return createSuccessResponse(responseData);

    } catch (error) {
        logError('config-api', error, {
            method: event.httpMethod,
            path: event.path
        });

        // 設定エラー
        if (error.message.includes('設定されていません') ||
            error.message.includes('HOME_LATITUDE') ||
            error.message.includes('HOME_LONGITUDE')) {
            return createErrorResponse(500, '設定エラー', error.message);
        }

        return createErrorResponse(500, 'サーバーエラーが発生しました', error.message);
    }
};
