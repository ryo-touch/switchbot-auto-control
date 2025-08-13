#!/usr/bin/env node

/**
 * 物理制御診断ツール - 赤外線送信の確認
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔧 SwitchBot 物理制御診断ツール');
console.log('==============================');
console.log('');

console.log('📋 **現在の問題状況**');
console.log('');
console.log('✅ API応答: triggered=true (成功)');
console.log('✅ システム状態管理: 正常');
console.log('❌ 物理制御: エアコンが動作しない');
console.log('');

console.log('🔍 **原因分析**');
console.log('');
console.log('Hub2 → エアコンの赤外線送信が失敗している可能性:');
console.log('  1. Hub2の設置位置・角度の問題');
console.log('  2. エアコンの赤外線受信部の問題');
console.log('  3. 学習済みコマンドの不正確性');
console.log('  4. 物理的な障害物');
console.log('  5. エアコン側の受信感度低下');
console.log('');

console.log('🧪 **必須テスト手順**');
console.log('');
console.log('【テスト1: SwitchBotアプリで直接制御】');
console.log('1. SwitchBotアプリを開く');
console.log('2. エアコンデバイスを選択');
console.log('3. 「ON」ボタンをタップ');
console.log('4. エアコンが物理的に動作するか確認');
console.log('5. 「OFF」ボタンをタップ');
console.log('6. エアコンが物理的に停止するか確認');
console.log('');

console.log('🔧 **期待される結果と対応**');
console.log('');
console.log('■ アプリでも動作しない場合:');
console.log('  → Hub2の物理的な問題');
console.log('  → 学習コマンドの再設定が必要');
console.log('  → Hub2の設置位置調整が必要');
console.log('');
console.log('■ アプリでは動作する場合:');
console.log('  → APIコマンドの形式問題');
console.log('  → parameterの値確認が必要');
console.log('  → コマンドタイプの検証が必要');
console.log('');

console.log('🎯 **推奨対応順序**');
console.log('');
console.log('1. 【緊急】SwitchBotアプリでの動作確認');
console.log('2. Hub2の物理設置状況確認');
console.log('   - エアコン受信部への向き');
console.log('   - 距離（1-2m推奨）');
console.log('   - 障害物の有無');
console.log('3. 学習コマンドの再設定');
console.log('   - 「エアコンON」の再学習');
console.log('   - 「エアコンOFF」の再学習');
console.log('4. API送信コマンドの詳細確認');
console.log('');

console.log('💡 **技術的補足**');
console.log('');
console.log('statusCode: 190 → 正常（状態履歴なし）');
console.log('triggered: true → API送信成功');
console.log('物理制御失敗 → 赤外線送信の問題');
console.log('');
console.log('この組み合わせは「API層は正常、物理層で失敗」を意味します。');
console.log('');

console.log('🚨 **次のアクション**');
console.log('================');
console.log('');
console.log('1. SwitchBotアプリで同じエアコンを手動制御');
console.log('2. 物理的にエアコンが動作するかを確認');
console.log('3. 結果をもとに次の対策を決定');
console.log('');
console.log('✅ このテストが解決への第一歩です。');
console.log('');
