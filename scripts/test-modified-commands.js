#!/usr/bin/env node

/**
 * 修正されたエアコン制御のテスト
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// test-aircon.js から関数をインポート
const { sendAirconCommand } = require('../api/test-aircon.js');

console.log('🧪 修正されたエアコン制御テスト');
console.log('==============================');
console.log('');

async function testModifiedCommands() {
    try {
        console.log('✅ 修正版エアコンOFF制御（setAll使用）');
        const offResult = await sendAirconCommand('off');
        console.log('結果:', {
            success: offResult.success,
            action: offResult.action,
            deviceId: offResult.deviceIdMasked,
            apiStatus: offResult.response?.statusCode
        });

        console.log('\n⏰ 5秒待機...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n✅ 修正版エアコンON制御（setAll使用）');
        const onResult = await sendAirconCommand('on');
        console.log('結果:', {
            success: onResult.success,
            action: onResult.action,
            deviceId: onResult.deviceIdMasked,
            apiStatus: onResult.response?.statusCode
        });

        console.log('\n🎯 修正完了！');
        console.log('SwitchBotアプリと同じようにエアコンが動作するはずです');

    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
}

testModifiedCommands();
