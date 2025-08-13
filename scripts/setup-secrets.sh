#!/bin/bash

# GitHub Secretsセットアップスクリプト
#
# 使用方法:
# 1. GitHub CLIをインストール: gh auth login
# 2. このスクリプトを実行: ./setup-secrets.sh
# 3. 各環境変数の値を入力

echo "🔐 GitHub Secrets セットアップ"
echo "================================"

# リポジトリ確認
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "リポジトリ: $REPO"
echo ""

# SwitchBot設定
echo "📱 SwitchBot API設定"
read -p "SWITCHBOT_TOKEN: " SWITCHBOT_TOKEN
read -s -p "SWITCHBOT_SECRET: " SWITCHBOT_SECRET
echo ""
read -p "AIRCON_DEVICE_ID: " AIRCON_DEVICE_ID
echo ""

# 位置情報設定
echo "📍 位置情報設定"
read -p "HOME_LATITUDE: " HOME_LATITUDE
read -p "HOME_LONGITUDE: " HOME_LONGITUDE
read -p "TRIGGER_DISTANCE (default: 100): " TRIGGER_DISTANCE
TRIGGER_DISTANCE=${TRIGGER_DISTANCE:-100}
echo ""

# Netlify設定
echo "🌐 Netlify設定"
read -p "NETLIFY_AUTH_TOKEN: " NETLIFY_AUTH_TOKEN
read -p "NETLIFY_SITE_ID: " NETLIFY_SITE_ID
echo ""

# GitHub Secretsに設定
echo "⚙️  GitHub Secretsに設定中..."

gh secret set SWITCHBOT_TOKEN --body "$SWITCHBOT_TOKEN"
gh secret set SWITCHBOT_SECRET --body "$SWITCHBOT_SECRET"
gh secret set AIRCON_DEVICE_ID --body "$AIRCON_DEVICE_ID"
gh secret set HOME_LATITUDE --body "$HOME_LATITUDE"
gh secret set HOME_LONGITUDE --body "$HOME_LONGITUDE"
gh secret set TRIGGER_DISTANCE --body "$TRIGGER_DISTANCE"
gh secret set NETLIFY_AUTH_TOKEN --body "$NETLIFY_AUTH_TOKEN"
gh secret set NETLIFY_SITE_ID --body "$NETLIFY_SITE_ID"

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "設定された環境変数:"
echo "- SWITCHBOT_TOKEN"
echo "- SWITCHBOT_SECRET"
echo "- AIRCON_DEVICE_ID"
echo "- HOME_LATITUDE"
echo "- HOME_LONGITUDE"
echo "- TRIGGER_DISTANCE"
echo "- NETLIFY_AUTH_TOKEN"
echo "- NETLIFY_SITE_ID"
