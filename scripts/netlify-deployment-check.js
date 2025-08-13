#!/usr/bin/env node

/**
 * Netlify Functions デプロイメント前チェックツール
 * ローカルとNetlify環境の違いを検証
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Netlify Functions デプロイメントチェック');
console.log('==========================================');
console.log('');

// 1. API ファイルの dotenv 使用状況チェック
const apiDir = path.join(__dirname, '../api');
const apiFiles = fs.readdirSync(apiDir).filter(file => file.endsWith('.js'));

console.log('📁 API ファイル dotenv チェック:');
apiFiles.forEach(file => {
    const filePath = path.join(apiDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasDotenv = content.includes('require(\'dotenv\')') || content.includes('require("dotenv")');
    const hasExportsHandler = content.includes('exports.handler');

    console.log(`   ${file}: ${hasDotenv ? '❌ dotenv使用' : '✅ Netlify対応'} | ${hasExportsHandler ? '✅ handler' : '❌ handler不足'}`);
});

console.log('');

// 2. 環境変数依存関係チェック
console.log('🔑 必要な環境変数:');
const requiredEnvVars = [
    'SWITCHBOT_TOKEN',
    'SWITCHBOT_SECRET',
    'AIRCON_DEVICE_ID',
    'HOME_LATITUDE',
    'HOME_LONGITUDE',
    'TRIGGER_DISTANCE'
];

requiredEnvVars.forEach(envVar => {
    const exists = process.env[envVar];
    console.log(`   ${envVar}: ${exists ? '✅ 設定済み' : '❌ 未設定'}`);
});

console.log('');

// 3. Netlify 固有の推奨事項
console.log('💡 **Netlify Functions 推奨事項**');
console.log('');
console.log('✅ **修正済み:**');
console.log('   - dotenv 削除（Netlify は環境変数を自動注入）');
console.log('   - 診断機能の簡素化（タイムアウト対策）');
console.log('   - エアコン制御コマンドを setAll に修正');
console.log('');
console.log('🔧 **次の手順:**');
console.log('1. Netlify ダッシュボードで環境変数を設定');
console.log('2. git push でデプロイメント実行');
console.log('3. Netlify Functions ログで動作確認');
console.log('');
console.log('🌐 **環境変数設定先:**');
console.log('   Netlify Dashboard > Site settings > Environment variables');
console.log('');
console.log('📊 **ローカル vs Netlify の違い:**');
console.log('   ローカル: .env ファイル + dotenv');
console.log('   Netlify: 環境変数設定 + 自動注入');
console.log('   制限: Netlify Functions は 10秒タイムアウト');
