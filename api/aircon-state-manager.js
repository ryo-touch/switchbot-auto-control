/**
 * エアコン状態管理API
 * 赤外線デバイスの制限を考慮した状態管理システム
 */

// Netlify Functions では dotenv は不要（環境変数は自動注入される）

const { handleError, createSuccessResponse } = require('./utils/error-handler');
const { measurePerformance } = require('./utils/performance');

// 簡易的な状態ストレージ（実際の運用では外部DBを使用）
let lastKnownState = {
    power: 'unknown',
    temperature: null,
    mode: null,
    lastUpdate: null,
    source: 'unknown' // 'api', 'app', 'manual'
};

/**
 * エアコンの状態を設定
 * @param {Object} event - Netlify Functions event object
 * @param {Object} context - Netlify Functions context object
 * @returns {Object} 設定結果
 */
exports.handler = async (event, context) => {
    const startTime = Date.now();

    try {
        // CORS対応
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: ''
            };
        }

        if (event.httpMethod === 'GET') {
            // 現在の状態を取得
            const result = {
                success: true,
                state: lastKnownState,
                timestamp: new Date().toISOString(),
                note: '赤外線デバイスの制限により、これは最後に記録された状態です。実際の状態と異なる場合があります。'
            };

            console.log('エアコン状態取得:', {
                state: lastKnownState,
                timestamp: new Date().toISOString()
            });

            return createSuccessResponse(result);

        } else if (event.httpMethod === 'POST') {
            // 状態を更新
            const body = JSON.parse(event.body || '{}');
            const { power, temperature, mode, source = 'app' } = body;

            // 状態を更新
            if (power !== undefined) lastKnownState.power = power;
            if (temperature !== undefined) lastKnownState.temperature = temperature;
            if (mode !== undefined) lastKnownState.mode = mode;

            lastKnownState.lastUpdate = new Date().toISOString();
            lastKnownState.source = source;

            const result = {
                success: true,
                message: 'エアコン状態を更新しました',
                state: lastKnownState,
                timestamp: new Date().toISOString()
            };

            console.log('エアコン状態更新:', {
                newState: lastKnownState,
                source: source,
                timestamp: new Date().toISOString()
            });

            return createSuccessResponse(result);

        } else {
            return handleError(new Error('GET または POST メソッドが必要です'), 405);
        }

    } catch (error) {
        console.error('エアコン状態管理エラー:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        });

        return handleError(error, 500);
    } finally {
        // パフォーマンス測定
        measurePerformance('aircon-state-manager', startTime);
    }
};
