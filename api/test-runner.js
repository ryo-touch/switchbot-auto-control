/**
 * APIテスト用ユーティリティ
 * 各APIエンドポイントの動作確認
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * テスト用のモックイベント生成
 * @param {string} method - HTTPメソッド
 * @param {string} endpoint - エンドポイント
 * @param {Object} body - リクエストボディ
 * @returns {Object} モックイベント
 */
function createMockEvent(method, endpoint, body = null) {
    return {
        httpMethod: method,
        path: `/.netlify/functions/${endpoint}`,
        headers: {
            'content-type': 'application/json',
            'origin': 'http://localhost:3000',
            'user-agent': 'test-runner'
        },
        body: body ? JSON.stringify(body) : null,
        isBase64Encoded: false
    };
}

/**
 * レスポンスを整形して出力
 * @param {string} testName - テスト名
 * @param {Object} response - レスポンス
 */
function logTestResult(testName, response) {
    console.log(`\n=== ${testName} ===`);
    console.log(`Status: ${response.statusCode}`);
    
    if (response.headers) {
        console.log(`Headers:`, Object.keys(response.headers).join(', '));
    }
    
    if (response.body) {
        try {
            const body = JSON.parse(response.body);
            console.log(`Response:`, JSON.stringify(body, null, 2));
        } catch (e) {
            console.log(`Response:`, response.body);
        }
    }
}

/**
 * デバイス一覧APIテスト
 */
async function testDevicesAPI() {
    try {
        const { handler } = require('./devices');
        const event = createMockEvent('GET', 'devices');
        const context = {};
        
        const response = await handler(event, context);
        logTestResult('Devices API Test', response);
        
        return response.statusCode === 200;
    } catch (error) {
        console.error('Devices API Test Failed:', error.message);
        return false;
    }
}

/**
 * エアコン手動制御APIテスト
 */
async function testAirconAPI() {
    try {
        const { handler } = require('./test-aircon');
        
        // OFFコマンドテスト
        const eventOff = createMockEvent('POST', 'test-aircon', { action: 'off' });
        const context = {};
        
        const response = await handler(eventOff, context);
        logTestResult('Test Aircon API (OFF)', response);
        
        return response.statusCode === 200;
    } catch (error) {
        console.error('Test Aircon API Failed:', error.message);
        return false;
    }
}

/**
 * 位置チェックAPIテスト
 */
async function testLocationCheckAPI() {
    try {
        const { handler } = require('./location-check');
        
        // テスト用座標（自宅から200m離れた位置）
        const homeLatitude = parseFloat(process.env.HOME_LATITUDE);
        const homeLongitude = parseFloat(process.env.HOME_LONGITUDE);
        
        if (isNaN(homeLatitude) || isNaN(homeLongitude)) {
            console.error('HOME_LATITUDE または HOME_LONGITUDE が設定されていません');
            return false;
        }
        
        // 約200m南に移動した座標
        const testLatitude = homeLatitude - 0.0018;
        const testLongitude = homeLongitude;
        
        const event = createMockEvent('POST', 'location-check', {
            latitude: testLatitude,
            longitude: testLongitude,
            timestamp: Date.now()
        });
        
        const context = {};
        const response = await handler(event, context);
        logTestResult('Location Check API Test', response);
        
        return response.statusCode === 200;
    } catch (error) {
        console.error('Location Check API Test Failed:', error.message);
        return false;
    }
}

/**
 * エラーハンドリングテスト
 */
async function testErrorHandling() {
    try {
        const { handler } = require('./location-check');
        
        // 無効な座標でテスト
        const event = createMockEvent('POST', 'location-check', {
            latitude: 'invalid',
            longitude: 'invalid'
        });
        
        const context = {};
        const response = await handler(event, context);
        logTestResult('Error Handling Test', response);
        
        return response.statusCode === 400;
    } catch (error) {
        console.error('Error Handling Test Failed:', error.message);
        return false;
    }
}

/**
 * CORSテスト
 */
async function testCORS() {
    try {
        const { handler } = require('./devices');
        const event = createMockEvent('OPTIONS', 'devices');
        const context = {};
        
        const response = await handler(event, context);
        logTestResult('CORS Test', response);
        
        return response.statusCode === 200 && 
               response.headers['Access-Control-Allow-Origin'];
    } catch (error) {
        console.error('CORS Test Failed:', error.message);
        return false;
    }
}

/**
 * 全テストを実行
 */
async function runAllTests() {
    console.log('🧪 SwitchBot API テスト開始\n');
    
    const tests = [
        { name: 'CORS', fn: testCORS },
        { name: 'Devices API', fn: testDevicesAPI },
        { name: 'Test Aircon API', fn: testAirconAPI },
        { name: 'Location Check API', fn: testLocationCheckAPI },
        { name: 'Error Handling', fn: testErrorHandling }
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`\n⏳ Running ${test.name}...`);
        try {
            const result = await test.fn();
            results.push({ name: test.name, passed: result });
            console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASSED' : 'FAILED'}`);
        } catch (error) {
            results.push({ name: test.name, passed: false, error: error.message });
            console.log(`❌ ${test.name}: FAILED (${error.message})`);
        }
    }
    
    // 結果サマリー
    console.log('\n📊 テスト結果サマリー');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    console.log('='.repeat(50));
    console.log(`合計: ${passed}/${total} テスト通過`);
    
    if (passed === total) {
        console.log('🎉 すべてのテストが成功しました！');
    } else {
        console.log('⚠️  一部のテストが失敗しました。設定を確認してください。');
    }
    
    return passed === total;
}

// スクリプトとして実行された場合
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    createMockEvent,
    testDevicesAPI,
    testAirconAPI,
    testLocationCheckAPI,
    testErrorHandling,
    testCORS,
    runAllTests
};
