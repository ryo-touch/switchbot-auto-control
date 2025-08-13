#!/usr/bin/env node

/**
 * エアコン赤外線コマンド修正ツール
 * SwitchBot公式ドキュメントに基づく正しいエアコン制御
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

console.log('🔧 **エアコン制御コマンド修正**');
console.log('================================');
console.log('');

console.log('📋 **問題の特定完了**');
console.log('❌ 間違い: turnOff/turnOn（単純コマンド）');
console.log('✅ 正解: setAll（エアコン専用コマンド）');
console.log('');

console.log('🎯 **SwitchBot公式仕様**');
console.log('Air Conditioner | command | setAll | {temperature},{mode},{fan speed},{power state}');
console.log('例: "26,1,3,on" = 26度、自動モード、中風量、電源ON');
console.log('');

// エアコン用のテストパターン
const airconTests = [
    {
        name: '✅ エアコンOFF（正しい方法）',
        command: 'setAll',
        parameter: '26,1,1,off',  // 26度、自動、低風量、OFF
        commandType: 'command',
        description: '温度26度、自動モード、低風量、電源OFF'
    },
    {
        name: '✅ エアコンON（正しい方法）',
        command: 'setAll',
        parameter: '26,2,2,on',   // 26度、冷房、中風量、ON
        commandType: 'command',
        description: '温度26度、冷房モード、中風量、電源ON'
    },
    {
        name: '❌ 古い方法（比較用）',
        command: 'turnOff',
        parameter: 'default',
        commandType: 'command',
        description: '従来の方法（動作しない）'
    }
];

async function testAirconCommand(testCase) {
    console.log(`\n🧪 テスト: ${testCase.name}`);
    console.log(`   説明: ${testCase.description}`);
    console.log(`   コマンド: ${testCase.command}`);
    console.log(`   パラメータ: ${testCase.parameter}`);

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = generateSignature(token, secret, timestamp, nonce);

    const requestBody = {
        command: testCase.command,
        parameter: testCase.parameter,
        commandType: testCase.commandType
    };

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
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        console.log(`   結果: HTTP ${response.status}, API ${data.statusCode}`);
        console.log(`   メッセージ: ${data.message}`);

        if (data.statusCode === 100) {
            console.log('   ✅ 送信成功 - エアコンの物理確認してください！');
            console.log('   💡 Hub2のLEDが光って、エアコンが反応するか確認');
        } else {
            console.log(`   ❌ 送信失敗 - ${data.message}`);
        }

        return data.statusCode === 100;

    } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        return false;
    }
}

async function runAirconTests() {
    console.log('🎬 **エアコン制御テスト開始**');
    console.log('');

    console.log('📝 **パラメータ説明**');
    console.log('temperature: 温度（例：26）');
    console.log('mode: 0/1=自動, 2=冷房, 3=除湿, 4=送風, 5=暖房');
    console.log('fan speed: 1=自動, 2=低, 3=中, 4=高');
    console.log('power state: on=電源ON, off=電源OFF');
    console.log('');

    for (const testCase of airconTests) {
        const success = await testAirconCommand(testCase);

        if (success) {
            console.log('\n⏰ 5秒待機中... エアコンの動作を確認してください');
            console.log('   👀 エアコンの電源ランプやディスプレイをチェック');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log('\n🎯 **次のステップ**');
    console.log('1. setAllコマンドでエアコンが物理的に動作するか確認');
    console.log('2. 動作した場合、APIコードを修正');
    console.log('3. test-aircon.js と aircon-status.js を更新');
    console.log('');
    console.log('💡 SwitchBotアプリと同じようにエアコンが動作するはず！');
}

// メイン実行
if (require.main === module) {
    runAirconTests().catch(console.error);
}

module.exports = { testAirconCommand };
