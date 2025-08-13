#!/usr/bin/env node

/**
 * 修正後のエアコン制御テスト（位置ベーストリガー）
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔧 修正後エアコン制御テスト');
console.log('============================');
console.log('');

console.log('📋 **修正内容**');
console.log('❌ 旧ロジック: 状態が"off"なら制御をスキップ');
console.log('✅ 新ロジック: 位置トリガー時は常にOFFコマンド送信');
console.log('💡 理由: 赤外線デバイスは状態不明が正常');
console.log('');

async function testLocationBasedControl() {
    try {
        const { handler } = require('../api/location-check');

        // 位置制御APIを模擬呼び出し
        const mockEvent = {
            httpMethod: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                latitude: 35.6762,
                longitude: 139.6503,
                accuracy: 5
            })
        };

        console.log('🧪 位置制御API呼び出し中...');
        const result = await handler(mockEvent, {});

        console.log('📥 API応答:', {
            statusCode: result.statusCode,
            data: JSON.parse(result.body)
        });

        const responseData = JSON.parse(result.body);

        if (responseData.triggered) {
            console.log('✅ 制御トリガー成功');
            console.log('🎯 アクション:', responseData.action);

            if (responseData.action === 'already_off') {
                console.log('❌ まだ "already_off" が返されています');
                console.log('💡 location-check.js の修正を確認してください');
            } else {
                console.log('✅ 実際の制御コマンドが送信されました');
                console.log('🔌 エアコンの物理確認を行ってください');
            }
        } else {
            console.log('ℹ️ 距離制御条件に該当しませんでした');
        }

    } catch (error) {
        console.error('❌ テストエラー:', error.message);
    }
}

testLocationBasedControl();
