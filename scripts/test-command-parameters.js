#!/usr/bin/env node

/**
 * エアコンコマンドパラメータ修正ツール
 * SwitchBotアプリが成功する理由を特定
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const crypto = require('crypto');

// 環境変数取得
const token = process.env.SWITCHBOT_TOKEN;
const secret = process.env.SWITCHBOT_SECRET;
const deviceId = process.env.AIRCON_DEVICE_ID;

// 署名生成関数
function generateSignature(token, secret, timestamp, nonce) {
    const data = token + timestamp + nonce;
    return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64');
}

console.log('🔧 エアコンコマンドパラメータ分析');
console.log('==============================');
console.log('');

console.log('✅ **問題特定完了**');
console.log('SwitchBotアプリ: 物理制御成功');
console.log('我々のAPI: 物理制御失敗');
console.log('→ コマンドパラメータの問題');
console.log('');

console.log('🔍 **現在のコマンド形式**');
console.log('');
console.log('❌ 失敗パターン（現在）:');
console.log('  command: "turnOff"');
console.log('  parameter: "" (空文字列)');
console.log('  commandType: "command"');
console.log('');

console.log('🧪 **テストすべきパラメータ**');
console.log('');
console.log('SwitchBot API仕様によると、以下のパターンを試すべき:');
console.log('');

// 複数のパラメータパターンをテスト
const testPatterns = [
    {
        name: '1. defaultパラメータ',
        command: 'turnOff',
        parameter: 'default',
        commandType: 'command'
    },
    {
        name: '2. 空文字パラメータ（現在）',
        command: 'turnOff',
        parameter: '',
        commandType: 'command'
    },
    {
        name: '3. parameterなし',
        command: 'turnOff',
        commandType: 'command'
    },
    {
        name: '4. エアコン学習コマンド',
        command: 'turnOff',
        parameter: 'default',
        commandType: 'customize'
    }
];

async function testCommandPattern(pattern) {
    console.log(`\n🧪 テスト: ${pattern.name}`);
    console.log(`   コマンド: ${JSON.stringify(pattern, null, 2)}`);

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = generateSignature(token, secret, timestamp, nonce);

    try {
        const response = await fetch(`https://api.switch-bot.com/v1.1/devices/${deviceId}/commands`, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'sign': signature,
                't': timestamp,
                'nonce': nonce,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pattern)
        });

        const data = await response.json();

        console.log(`   結果: HTTP ${response.status}, API ${data.statusCode}`);
        console.log(`   メッセージ: ${data.message}`);

        if (data.statusCode === 100) {
            console.log('   ✅ 送信成功 - 物理確認してください');
        } else {
            console.log(`   ❌ 送信失敗 - ${data.message}`);
        }

        return data.statusCode === 100;

    } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('📋 **重要な注意**');
    console.log('各テストの後、実際にエアコンが動作するか物理確認してください');
    console.log('(SwitchBotアプリと同様に動作するパターンを特定)');
    console.log('');

    for (const pattern of testPatterns) {
        const success = await testCommandPattern(pattern);

        if (success) {
            console.log('\n⏰ 5秒待機中... 物理確認してください');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log('\n🎯 **次のステップ**');
    console.log('1. 上記テストで物理的に動作したパターンを特定');
    console.log('2. そのパラメータをコードに適用');
    console.log('3. 再テストで物理制御の成功を確認');
    console.log('');
    console.log('💡 SwitchBotアプリと同じ動作になるまで調整が必要です');
}

// メイン実行
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testCommandPattern };
