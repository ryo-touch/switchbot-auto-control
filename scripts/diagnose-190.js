#!/usr/bin/env node

/**
 * SwitchBot API 190エラー詳細診断ツール
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const crypto = require('crypto');

// 環境変数取得
const token = process.env.SWITCHBOT_TOKEN;
const secret = process.env.SWITCHBOT_SECRET;
const deviceId = process.env.AIRCON_DEVICE_ID;

console.log('🔍 SwitchBot API 190エラー診断開始');
console.log('====================================');

if (!token || !secret || !deviceId) {
    console.error('❌ 環境変数が不足しています');
    console.log('Token:', token ? `${token.substring(0, 8)}...` : '未設定');
    console.log('Secret:', secret ? `${secret.substring(0, 8)}...` : '未設定');
    console.log('DeviceId:', deviceId || '未設定');
    process.exit(1);
}

console.log('✅ 環境変数確認');
console.log(`Token: ${token.substring(0, 8)}...`);
console.log(`Secret: ${secret.substring(0, 8)}...`);
console.log(`DeviceId: ${deviceId}`);
console.log('');

// 署名生成関数
function generateSignature(token, secret, timestamp, nonce) {
    const data = token + timestamp + nonce;
    return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64');
}

// 1. デバイス一覧の確認
async function testDevicesList() {
    console.log('📋 ステップ1: デバイス一覧取得');

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = generateSignature(token, secret, timestamp, nonce);

    try {
        const response = await fetch('https://api.switch-bot.com/v1.1/devices', {
            method: 'GET',
            headers: {
                'Authorization': token,
                'sign': signature,
                't': timestamp,
                'nonce': nonce,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log(`HTTP Status: ${response.status}`);
        console.log(`API Status: ${data.statusCode}`);
        console.log(`Message: ${data.message}`);

        if (data.statusCode === 100 && data.body) {
            // 赤外線デバイスを確認
            const infraredDevices = data.body.infraredRemoteList || [];
            console.log(`\n📱 赤外線デバイス一覧 (${infraredDevices.length}件):`);

            infraredDevices.forEach((device, index) => {
                console.log(`  ${index + 1}. ${device.deviceName}`);
                console.log(`     ID: ${device.deviceId}`);
                console.log(`     Type: ${device.remoteType}`);
                console.log(`     Hub: ${device.hubDeviceId}`);

                if (device.deviceId === deviceId) {
                    console.log('     ✅ 設定されたデバイスIDと一致');
                } else {
                    console.log('     ⚠️  設定されたデバイスIDと不一致');
                }
                console.log('');
            });

            if (!infraredDevices.find(d => d.deviceId === deviceId)) {
                console.log('❌ 設定されたデバイスIDが見つかりません！');
                console.log(`設定ID: ${deviceId}`);
                console.log('利用可能なID:');
                infraredDevices.forEach(d => console.log(`  - ${d.deviceId} (${d.deviceName})`));
                return false;
            }
        }

        return data.statusCode === 100;

    } catch (error) {
        console.error('❌ デバイス一覧取得エラー:', error.message);
        return false;
    }
}

// 2. デバイス状態取得（190エラーの詳細確認）
async function testDeviceStatus() {
    console.log('🔍 ステップ2: デバイス状態取得（190エラー詳細）');

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = generateSignature(token, secret, timestamp, nonce);

    try {
        const url = `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`;
        console.log(`URL: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'sign': signature,
                't': timestamp,
                'nonce': nonce,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log(`HTTP Status: ${response.status}`);
        console.log(`API Status: ${data.statusCode}`);
        console.log(`Message: ${data.message}`);
        console.log(`Body:`, JSON.stringify(data.body, null, 2));

        if (data.statusCode === 190) {
            console.log('\n🔍 190エラー詳細分析:');
            console.log('- wrong deviceId: デバイスIDが認識されない');
            console.log('- 考えられる原因:');
            console.log('  1. デバイスIDが間違っている');
            console.log('  2. デバイスがオフライン');
            console.log('  3. 赤外線学習が不完全');
            console.log('  4. Hub2とエアコンの通信問題');
        }

        return { success: data.statusCode === 100 || data.statusCode === 190, data };

    } catch (error) {
        console.error('❌ デバイス状態取得エラー:', error.message);
        return { success: false, error };
    }
}

// 3. テスト制御コマンド送信
async function testCommand() {
    console.log('🎮 ステップ3: テスト制御コマンド送信');

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = generateSignature(token, secret, timestamp, nonce);

    try {
        const url = `https://api.switch-bot.com/v1.1/devices/${deviceId}/commands`;
        console.log(`URL: ${url}`);

        const command = {
            command: 'turnOff',
            parameter: 'default',
            commandType: 'command'
        };

        console.log('Command:', JSON.stringify(command, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'sign': signature,
                't': timestamp,
                'nonce': nonce,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(command)
        });

        const data = await response.json();

        console.log(`HTTP Status: ${response.status}`);
        console.log(`API Status: ${data.statusCode}`);
        console.log(`Message: ${data.message}`);
        console.log(`Body:`, JSON.stringify(data.body, null, 2));

        if (data.statusCode === 100) {
            console.log('✅ コマンド送信成功 - Hub2への指示は完了');
            console.log('⚠️ ただし、物理的にエアコンが動作するかは別問題');
        } else if (data.statusCode === 190) {
            console.log('❌ コマンド送信も190エラー - デバイスID問題が確定');
        }

        return { success: data.statusCode === 100, data };

    } catch (error) {
        console.error('❌ コマンド送信エラー:', error.message);
        return { success: false, error };
    }
}

// 診断実行
async function runDiagnosis() {
    console.log('⏱️  診断開始 - ' + new Date().toISOString());
    console.log('');

    // ステップ1: デバイス一覧
    const step1 = await testDevicesList();
    console.log('');

    if (!step1) {
        console.log('❌ ステップ1失敗: デバイス一覧取得に問題があります');
        return;
    }

    // ステップ2: デバイス状態
    const step2 = await testDeviceStatus();
    console.log('');

    // ステップ3: コマンド送信
    const step3 = await testCommand();
    console.log('');

    // 総合判定
    console.log('📊 診断結果サマリー');
    console.log('==================');
    console.log(`デバイス一覧: ${step1 ? '✅' : '❌'}`);
    console.log(`デバイス状態: ${step2.success ? '✅' : '❌'}`);
    console.log(`コマンド送信: ${step3.success ? '✅' : '❌'}`);

    if (step2.data?.statusCode === 190) {
        console.log('\n🎯 190エラー解決の推奨手順:');
        console.log('1. SwitchBotアプリでエアコンの学習をやり直す');
        console.log('2. Hub2とエアコンの距離・角度を調整');
        console.log('3. Hub2の再起動');
        console.log('4. エアコンの電源がONになっていることを確認');
        console.log('5. デバイスIDの再確認（アプリで確認）');
    }
}

runDiagnosis().catch(console.error);
