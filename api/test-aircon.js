/**
 * SwitchBot エアコン手動制御API + 診断機能
 * エンドポイント: POST /.netlify/functions/test-aircon
 *
 * 🔧 緊急修正: 物理デバイス制御失敗の診断・解決
 */

// Netlify Functions では dotenv は不要（環境変数は自動注入される）
const { createAuthHeaders, getBaseURL, getAirconDeviceId, isDebugMode, generateSignature } = require('./utils/switchbot-auth');
const { createErrorResponse, createSuccessResponse, handleSwitchBotError, logError, validateHttpMethod, createCorsResponse, COMMON_ERRORS } = require('./utils/error-handler');
const { generateAirconParameter, getAirconSettings } = require('./config/aircon-settings');

/**
 * 🔧 SwitchBot APIの簡易診断（Netlify対応）
 * @returns {Promise<Object>} 診断結果
 */
async function performQuickDiagnostic() {
    const diagnosticResults = {
        timestamp: new Date().toISOString(),
        environment: {},
        basicConnectivity: null,
        quickTest: null
    };

    try {
        console.log('[DIAGNOSTIC] 🔬 簡易診断開始...');

        // 1. 環境変数チェック（高速）
        const {
            token: envToken,
            secret: envSecret,
            deviceId: envDeviceId
        } = {
            token: process.env.SWITCHBOT_TOKEN,
            secret: process.env.SWITCHBOT_SECRET,
            deviceId: process.env.AIRCON_DEVICE_ID
        };

        diagnosticResults.environment = {
            tokenExists: !!envToken,
            tokenValid: envToken && envToken.length > 10,
            secretExists: !!envSecret,
            secretValid: envSecret && envSecret.length > 10,
            deviceIdExists: !!envDeviceId,
            deviceIdMasked: envDeviceId ? envDeviceId.substring(0, 4) + '***' + envDeviceId.slice(-2) : 'MISSING',
            allRequired: !!(envToken && envSecret && envDeviceId)
        };

        // 環境変数が不完全な場合は早期終了
        if (!diagnosticResults.environment.allRequired) {
            diagnosticResults.basicConnectivity = { error: '環境変数が不完全です' };
            return diagnosticResults;
        }

        // 2. 基本接続テスト（タイムアウト5秒）
        try {
            const headers = createAuthHeaders();
            const baseURL = getBaseURL();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${baseURL}/devices`, {
                method: 'GET',
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            diagnosticResults.basicConnectivity = {
                success: response.ok,
                status: response.status,
                statusText: response.statusText
            };

            if (response.ok) {
                const data = await response.json();
                diagnosticResults.quickTest = {
                    success: true,
                    deviceCount: data.body?.deviceList?.length || 0,
                    infraredCount: data.body?.infraredRemoteList?.length || 0
                };
            }

        } catch (error) {
            diagnosticResults.basicConnectivity = {
                success: false,
                error: error.message,
                type: error.name
            };
        }

        return diagnosticResults;

    } catch (error) {
        console.error('[DIAGNOSTIC] 診断エラー:', error);
        diagnosticResults.error = error.message;
        return diagnosticResults;
    }
}

/**
 * 簡易診断結果から推奨事項を生成

        // 3. 認証テスト
        console.log('[DIAGNOSTIC] 🔐 認証システムテスト...');
        try {
            const timestamp = Date.now().toString();
            const nonce = Math.random().toString(36).substring(2, 15);
            const signature = generateSignature(envToken, envSecret, timestamp, nonce);

            diagnosticResults.authentication = {
                signatureGenerated: !!signature,
                signatureLength: signature.length,
                timestamp,
                nonce,
                valid: signature.length > 0
            };
        } catch (authError) {
            diagnosticResults.authentication = {
                valid: false,
                error: authError.message
            };
        }

        // 4. デバイス状態確認
        console.log('[DIAGNOSTIC] 📱 デバイス状態確認...');
        try {
            const headers = createAuthHeaders();
            const statusUrl = `${getBaseURL()}/devices/${envDeviceId}/status`;

            const statusResponse = await fetch(statusUrl, {
                method: 'GET',
                headers
            });

            const statusText = await statusResponse.text();
            let statusData;
            try {
                statusData = JSON.parse(statusText);
            } catch (parseError) {
                statusData = { raw: statusText };
            }

            diagnosticResults.deviceStatus = {
                httpStatus: statusResponse.status,
                httpOk: statusResponse.ok,
                responseData: statusData,
                deviceFound: statusData.statusCode === 100 || statusData.statusCode === 190,
                deviceOnline: statusData.statusCode === 100,
                infraredDevice: statusData.statusCode === 190,
                note: statusData.statusCode === 190 ? '190は赤外線デバイスの正常応答（状態履歴なし）' : null
            };
        } catch (statusError) {
            diagnosticResults.deviceStatus = {
                error: statusError.message,
                accessible: false
            };
        }

        // 5. 制御コマンドテスト（実際には送信しない、検証のみ）
        console.log('[DIAGNOSTIC] 🎯 制御コマンド構造テスト...');
        try {
            const commandBody = {
                command: 'turnOff',
                parameter: '',  // 🔧 修正: 'default' → '' (空文字列)
                commandType: 'command'
            };

            const headers = createAuthHeaders();
            const commandUrl = `${getBaseURL()}/devices/${envDeviceId}/commands`;

            diagnosticResults.commandTest = {
                url: commandUrl,
                headers: Object.keys(headers),
                body: commandBody,
                structureValid: !!(commandBody.command && commandBody.commandType)
            };
        } catch (commandError) {
            diagnosticResults.commandTest = {
                error: commandError.message,
                valid: false
            };
        }

        return diagnosticResults;

    } catch (error) {
        console.error('[DIAGNOSTIC] 診断エラー:', error);
        diagnosticResults.error = error.message;
        return diagnosticResults;
    }
}

/**
 * 簡易診断結果から推奨事項を生成
 * @param {Object} diagnostics - 診断結果
 * @returns {Array} 推奨事項の配列
 */
function generateDiagnosticRecommendations(diagnostics) {
    const recommendations = [];

    if (!diagnostics.environment?.allRequired) {
        recommendations.push('❌ Netlify環境変数を設定してください: SWITCHBOT_TOKEN, SWITCHBOT_SECRET, AIRCON_DEVICE_ID');
    }

    if (diagnostics.basicConnectivity && !diagnostics.basicConnectivity.success) {
        recommendations.push('❌ SwitchBot API接続に失敗しています。認証情報を確認してください');
    }

    if (diagnostics.quickTest && !diagnostics.quickTest.success) {
        recommendations.push('❌ デバイス取得に失敗しています。API キーの権限を確認してください');
    }

    if (recommendations.length === 0) {
        recommendations.push('✅ 基本設定は正常です');
    }

    return recommendations;
}

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

        // SwitchBot API v1.1 エアコン制御コマンド（赤外線デバイス用）
        // ✅ 修正: エアコンには setAll コマンドを使用
        let commandBody;

        if (action === 'on' || action === 'off') {
            const parameter = generateAirconParameter(action);
            const settings = getAirconSettings(action);

            commandBody = {
                command: 'setAll',
                parameter: parameter,  // 季節別設定から動的生成
                commandType: 'command'
            };

            if (isDebugMode()) {
                console.log('[DEBUG] Aircon settings applied:', {
                    action,
                    season: settings.season,
                    parameter,
                    settings: {
                        temperature: settings.temperature,
                        mode: settings.mode,
                        fanSpeed: settings.fanSpeed,
                        power: settings.power
                    }
                });
            }
        } else {
            throw new Error(`Unsupported action: ${action}`);
        }

        const url = `${baseURL}/devices/${deviceId}/commands`;

        if (isDebugMode()) {
            console.log('[DEBUG] Sending aircon command:', {
                url,
                deviceIdMasked: deviceId ? deviceId.substring(0, 4) + '***' + deviceId.substring(-2) : 'MISSING',
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

        // 状態管理APIに状態を更新
        try {
            const { handler: stateHandler } = require('./aircon-state-manager');
            const stateUpdate = {
                power: action === 'off' ? 'off' : 'on',
                source: 'manual_api',
                timestamp: new Date().toISOString()
            };

            const updateEvent = {
                httpMethod: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(stateUpdate)
            };

            const updateResult = await stateHandler(updateEvent, {});
            if (updateResult.statusCode === 200) {
                console.log(`手動制御後の状態更新完了: ${action}`);
            } else {
                console.warn('状態更新に失敗:', updateResult);
            }
        } catch (stateError) {
            console.warn('状態更新に失敗:', stateError.message);
            // 状態更新の失敗は制御には影響しない
        }

        return {
            success: true,
            action,
            deviceIdMasked: deviceId ? deviceId.substring(0, 4) + '***' + deviceId.substring(-2) : 'MISSING',
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
        if (!validateHttpMethod(event.httpMethod, ['POST', 'GET'])) {
            return createErrorResponse(405, '許可されていないHTTPメソッドです');
        }

        console.log('[TEST] 🔧 テスト・診断API呼び出し:', {
            method: event.httpMethod,
            timestamp: new Date().toISOString(),
            userAgent: event.headers['user-agent'] || 'unknown'
        });

        // 🔧 GETリクエスト: 包括的診断実行
        if (event.httpMethod === 'GET') {
            console.log('[TEST] 🔬 診断モード実行...');
            const diagnosticResults = await performQuickDiagnostic();

            return createSuccessResponse({
                mode: 'diagnostic',
                message: '🔬 SwitchBot API包括的診断完了',
                diagnostics: diagnosticResults,
                timestamp: new Date().toISOString(),
                recommendations: generateDiagnosticRecommendations(diagnosticResults)
            });
        }

        // 🔧 POSTリクエスト: 実際のコマンド送信
        console.log('[TEST] 🎯 制御コマンドモード実行...');

        // リクエストボディの解析
        const { action, diagnostic } = parseRequestBody(event.body);

        // 診断フラグが有効な場合、診断も同時実行
        let diagnosticResults = null;
        if (diagnostic) {
            console.log('[TEST] 🔬 制御前診断実行...');
            diagnosticResults = await performQuickDiagnostic();
        }

        // アクションのバリデーション
        const validation = validateAction(action);
        if (!validation.valid) {
            return createErrorResponse(400, validation.error);
        }

        const validatedAction = validation.action;

        // エアコン制御実行（強化版）
        const result = await sendAirconCommandEnhanced(validatedAction);

        // 制御結果メッセージ生成
        const message = generateResultMessage(validatedAction);

        // レスポンスデータ作成
        const responseData = {
            mode: 'control',
            action: validatedAction,
            message,
            deviceId: getAirconDeviceId(),
            timestamp: result.timestamp,
            success: result.success,
            ...(diagnosticResults && { preDiagnostic: diagnosticResults }),
            ...(isDebugMode() && {
                debug: {
                    apiResponse: result.response,
                    detailedLogs: result.logs
                }
            })
        };

        console.log('[TEST] ✅ テスト完了:', JSON.stringify(responseData, null, 2));

        return createSuccessResponse(responseData);

    } catch (error) {
        console.error('[TEST] 🚨 テストAPIエラー:', error);
        logError('test-aircon-api', error, {
            method: event.httpMethod,
            body: event.body
        });

        // 設定エラー（デバイスIDなど）
        if (error.message.includes('設定されていません') || error.message.includes('AIRCON_DEVICE_ID')) {
            return createErrorResponse(500, '🚨 設定エラー', error.message);
        }

        // バリデーションエラー
        if (error.message.includes('JSON解析') || error.message.includes('バリデーション')) {
            return createErrorResponse(400, error.message);
        }

        // SwitchBot APIエラー
        const { statusCode, message, details } = handleSwitchBotError(error);
        return createErrorResponse(statusCode, `🚨 SwitchBot APIエラー: ${message}`, details);
    }
};

/**
 * 🔧 診断結果に基づく推奨事項生成
 */
function generateDiagnosticRecommendations(diagnostics) {
    const recommendations = [];

    if (!diagnostics.environment?.allRequired) {
        recommendations.push('🚨 優先度HIGH: 環境変数（SWITCHBOT_TOKEN, SWITCHBOT_SECRET, AIRCON_DEVICE_ID）を確認');
        return recommendations;
    }

    if (!diagnostics.connectivity?.reachable) {
        recommendations.push('🌐 ネットワーク接続を確認 - SwitchBot APIにアクセスできません');
        return recommendations;
    }

    if (!diagnostics.authentication?.valid) {
        recommendations.push('🔐 認証情報を確認 - Token/Secretが無効な可能性');
        return recommendations;
    }

    // デバイス状態に基づく詳細な推奨事項
    if (diagnostics.deviceStatus?.responseData?.statusCode === 190) {
        recommendations.push('✅ 190応答: 赤外線デバイスの正常な動作（状態履歴なし）');
        recommendations.push('🎯 重要: これはエラーではありません');
        recommendations.push('📱 SwitchBotアプリで手動制御をテスト → 物理的にエアコンが動作するか確認');
        recommendations.push('� 動作しない場合: Hub2の設置位置・学習コマンドを確認');
    } else if (diagnostics.deviceStatus?.responseData?.statusCode === 151) {
        recommendations.push('📶 Hub2の接続状態を確認 - WiFi接続やオンライン状態をチェック');
    } else if (diagnostics.deviceStatus?.responseData?.statusCode === 100) {
        recommendations.push('✅ API接続は正常 - 物理制御レイヤーを確認');
        recommendations.push('🔧 Hub2 → エアコンの赤外線送信を確認');
        recommendations.push('📱 SwitchBotアプリで同じデバイスの手動制御をテスト');
        recommendations.push('🏠 Hub2の設置位置・障害物・距離を確認');
    }

    // 制御コマンドテストの結果に基づく推奨事項
    if (diagnostics.commandTest?.structureValid) {
        recommendations.push('✅ APIコマンド構造は正常');
        recommendations.push('🎯 次のステップ: 実際のコマンド送信テストを実行');
    }

    // 基本設定が正常な場合の包括的推奨事項
    if (recommendations.length === 0) {
        recommendations.push('✅ 基本設定は正常');
        recommendations.push('🔍 物理デバイス確認手順:');
        recommendations.push('   1. SwitchBotアプリで手動制御テスト');
        recommendations.push('   2. Hub2の電源・WiFi状態確認');
        recommendations.push('   3. エアコンの学習コマンド再設定');
        recommendations.push('   4. Hub2とエアコンの物理的配置確認');
    }

    return recommendations;
}

/**
 * 🔧 強化版制御コマンド送信
 */
async function sendAirconCommandEnhanced(action) {
    const logs = [];

    try {
        logs.push(`🚀 強化版制御開始: ${action}`);

        // 制御前の状態確認
        logs.push('📊 制御前状態確認...');
        const preState = await getAirconCurrentState();
        logs.push(`制御前状態: ${JSON.stringify(preState)}`);

        // 実際の制御実行
        const result = await sendAirconCommand(action);
        logs.push(`API制御結果: ${JSON.stringify(result)}`);

        // 制御後の状態確認（5秒後）
        logs.push('⏱️ 制御後状態確認のため5秒待機...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const postState = await getAirconCurrentState();
        logs.push(`制御後状態: ${JSON.stringify(postState)}`);

        // 状態変化の分析
        const stateChanged = preState.power !== postState.power;
        logs.push(`状態変化: ${stateChanged ? '✅ 検出' : '❌ なし'}`);

        return {
            ...result,
            success: result.success && stateChanged,
            logs,
            stateAnalysis: {
                preState,
                postState,
                stateChanged,
                expectedState: action === 'off' ? 'off' : 'on',
                actualMatchesExpected: postState.power === (action === 'off' ? 'off' : 'on')
            }
        };

    } catch (error) {
        logs.push(`🚨 エラー: ${error.message}`);
        throw error;
    }
}

/**
 * 現在のエアコン状態を取得（location-check.jsから移植）
 */
async function getAirconCurrentState() {
    try {
        // ローカル状態管理APIから状態を取得
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

        // フォールバック：状態不明
        return {
            power: 'unknown',
            timestamp: new Date().toISOString(),
            source: 'error_fallback'
        };

    } catch (error) {
        return {
            power: 'unknown',
            timestamp: new Date().toISOString(),
            source: 'error_fallback'
        };
    }
}
