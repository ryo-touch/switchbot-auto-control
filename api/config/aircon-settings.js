/**
 * エアコン設定ファイル
 * 季節や好みに応じて温度・モードを調整できます
 *
 * 🔧 設定変更方法:
 * 1. 下記の SEASONAL_SETTINGS オブジェクトを編集
 * 2. temperature（温度）を変更: 16-30度の範囲で設定
 * 3. mode（モード）を変更: 下記の AIRCON_MODES から選択
 * 4. fanSpeed（風量）を変更: 下記の FAN_SPEEDS から選択
 *
 * 💡 使用例:
 * 夏を涼しくしたい → summer.on.temperature を 24 に変更
 * 冬を暖かくしたい → winter.on.temperature を 25 に変更
 *
 * 🌡️ 推奨温度:
 * 夏（冷房）: 26-28度
 * 冬（暖房）: 20-24度
 * 春秋（自動）: 22-26度
 */

/**
 * エアコンのモード定数
 * SwitchBot API parameter: 温度,モード,風量,電源
 * モード: 1=自動, 2=冷房, 3=暖房, 4=送風, 5=除湿
 * 風量: 1=低, 2=中, 3=高, 4=自動
 */
const AIRCON_MODES = {
    AUTO: 1,
    COOL: 2,
    HEAT: 3,
    FAN: 4,
    DEHUMIDIFY: 5
};

const FAN_SPEEDS = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    AUTO: 4
};

/**
 * 季節別エアコン設定
 * 現在の月に基づいて自動的に季節を判定します
 */
const SEASONAL_SETTINGS = {
    // 春（3-5月）
    spring: {
        on: {
            temperature: 27,
            mode: AIRCON_MODES.AUTO,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'on'
        },
        off: {
            temperature: 27,
            mode: AIRCON_MODES.AUTO,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'off'
        }
    },

    // 夏（6-8月）
    summer: {
        on: {
            temperature: 27,
            mode: AIRCON_MODES.COOL,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'on'
        },
        off: {
            temperature: 27,
            mode: AIRCON_MODES.COOL,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'off'
        }
    },

    // 秋（9-11月）
    autumn: {
        on: {
            temperature: 28,
            mode: AIRCON_MODES.AUTO,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'on'
        },
        off: {
            temperature: 28,
            mode: AIRCON_MODES.AUTO,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'off'
        }
    },

    // 冬（12-2月）
    winter: {
        on: {
            temperature: 22,
            mode: AIRCON_MODES.HEAT,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'on'
        },
        off: {
            temperature: 22,
            mode: AIRCON_MODES.AUTO,
            fanSpeed: FAN_SPEEDS.AUTO,
            power: 'off'
        }
    }
};

/**
 * 現在の季節を取得
 * @returns {string} 季節名 (spring, summer, autumn, winter)
 */
function getCurrentSeason() {
    const month = new Date().getMonth() + 1; // 0-11 -> 1-12

    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter'; // 12, 1, 2月
}

/**
 * エアコン設定を取得
 * @param {string} action - 'on' または 'off'
 * @param {string} [season] - 季節を強制指定（省略時は現在の季節）
 * @returns {Object} エアコン設定
 */
function getAirconSettings(action, season = null) {
    const currentSeason = season || getCurrentSeason();
    const settings = SEASONAL_SETTINGS[currentSeason];

    if (!settings || !settings[action]) {
        throw new Error(`Invalid season (${currentSeason}) or action (${action})`);
    }

    return {
        ...settings[action],
        season: currentSeason
    };
}

/**
 * SwitchBot APIのparameter文字列を生成
 * @param {string} action - 'on' または 'off'
 * @param {string} [season] - 季節を強制指定
 * @returns {string} parameter文字列 (例: "26,2,2,on")
 */
function generateAirconParameter(action, season = null) {
    const settings = getAirconSettings(action, season);
    return `${settings.temperature},${settings.mode},${settings.fanSpeed},${settings.power}`;
}

/**
 * デバッグ用: 全季節の設定を表示
 * @returns {Object} 全設定
 */
function getAllSettings() {
    return {
        currentSeason: getCurrentSeason(),
        modes: AIRCON_MODES,
        fanSpeeds: FAN_SPEEDS,
        settings: SEASONAL_SETTINGS
    };
}

module.exports = {
    AIRCON_MODES,
    FAN_SPEEDS,
    SEASONAL_SETTINGS,
    getCurrentSeason,
    getAirconSettings,
    generateAirconParameter,
    getAllSettings
};
