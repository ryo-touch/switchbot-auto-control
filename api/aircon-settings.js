/**
 * エアコン設定確認API
 * エンドポイント: GET /.netlify/functions/aircon-settings
 * 現在の季節別設定を確認できます
 */

const { createErrorResponse, createSuccessResponse, validateHttpMethod, createCorsResponse } = require('./utils/error-handler');
const { getAllSettings, getAirconSettings, generateAirconParameter, getCurrentSeason } = require('./config/aircon-settings');

/**
 * エアコン設定情報を取得
 */
exports.handler = async (event, context) => {
    console.log('[AIRCON_SETTINGS] リクエスト受信:', {
        method: event.httpMethod,
        query: event.queryStringParameters,
        timestamp: new Date().toISOString()
    });

    // CORS対応
    if (event.httpMethod === 'OPTIONS') {
        return createCorsResponse();
    }

    try {
        // HTTPメソッド検証
        if (!validateHttpMethod(event, ['GET'])) {
            return createErrorResponse('Method not allowed', 405);
        }

        const query = event.queryStringParameters || {};
        const { action, season } = query;

        let responseData;

        if (action) {
            // 特定のアクション設定を取得
            if (!['on', 'off'].includes(action)) {
                return createErrorResponse('Invalid action. Use "on" or "off"', 400);
            }

            const settings = getAirconSettings(action, season);
            const parameter = generateAirconParameter(action, season);

            responseData = {
                action,
                season: season || getCurrentSeason(),
                settings,
                parameter,
                usage: `setAll コマンドのパラメータとして "${parameter}" を使用`
            };

        } else {
            // 全設定を取得
            responseData = {
                current: {
                    season: getCurrentSeason(),
                    month: new Date().getMonth() + 1
                },
                examples: {
                    on: {
                        parameter: generateAirconParameter('on'),
                        settings: getAirconSettings('on')
                    },
                    off: {
                        parameter: generateAirconParameter('off'),
                        settings: getAirconSettings('off')
                    }
                },
                allSettings: getAllSettings()
            };
        }

        console.log('[AIRCON_SETTINGS] 設定情報を返却:', {
            hasAction: !!action,
            season: season || getCurrentSeason(),
            timestamp: new Date().toISOString()
        });

        return createSuccessResponse(responseData);

    } catch (error) {
        console.error('[AIRCON_SETTINGS] エラー:', error);

        return createErrorResponse(
            error.message || 'Internal server error',
            500,
            {
                error: error.message,
                timestamp: new Date().toISOString()
            }
        );
    }
};
