/**
 * 距離計算ユーティリティ
 * ハーバシンの公式による距離計算とトリガー判定
 */

/**
 * 座標の妥当性を検証
 * @param {number} latitude - 緯度
 * @param {number} longitude - 経度
 * @returns {boolean} 座標が有効かどうか
 */
function validateCoordinates(latitude, longitude) {
    return !isNaN(latitude) &&
           !isNaN(longitude) &&
           latitude >= -90 &&
           latitude <= 90 &&
           longitude >= -180 &&
           longitude <= 180;
}

/**
 * ハーバシンの公式による2点間の距離計算
 * @param {number} lat1 - 地点1の緯度
 * @param {number} lon1 - 地点1の経度
 * @param {number} lat2 - 地点2の緯度
 * @param {number} lon2 - 地点2の経度
 * @returns {number} 距離（メートル）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    // 入力値の検証
    if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
        throw new Error('無効な座標が指定されました');
    }

    const R = 6371000; // 地球半径（メートル）

    // 度をラジアンに変換
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    // ハーバシンの公式
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    // 結果の妥当性チェック（0～地球半周程度）
    if (distance < 0 || distance > 20003931) {
        throw new Error('距離計算で異常値が検出されました');
    }

    return distance;
}

/**
 * 距離ベースのトリガー判定
 * @param {number} currentLat - 現在位置の緯度
 * @param {number} currentLon - 現在位置の経度
 * @param {number} homeLat - 自宅の緯度
 * @param {number} homeLon - 自宅の経度
 * @param {number} threshold - しきい値距離（メートル）
 * @returns {Object} 判定結果
 */
function shouldTriggerControl(currentLat, currentLon, homeLat, homeLon, threshold) {
    try {
        const distance = calculateDistance(currentLat, currentLon, homeLat, homeLon);
        const shouldTrigger = distance > threshold;

        return {
            distance: Math.round(distance),
            threshold,
            shouldTrigger,
            withinRange: !shouldTrigger
        };
    } catch (error) {
        throw new Error(`トリガー判定エラー: ${error.message}`);
    }
}

/**
 * 座標情報を文字列表現に変換（デバッグ用）
 * @param {number} latitude - 緯度
 * @param {number} longitude - 経度
 * @returns {string} 座標の文字列表現
 */
function formatCoordinates(latitude, longitude) {
    if (!validateCoordinates(latitude, longitude)) {
        return '無効な座標';
    }
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * 距離を人間が読みやすい形式に変換
 * @param {number} distance - 距離（メートル）
 * @returns {string} フォーマット済み距離
 */
function formatDistance(distance) {
    if (isNaN(distance) || distance < 0) {
        return '不明';
    }

    if (distance < 1000) {
        return `${Math.round(distance)}m`;
    } else {
        return `${(distance / 1000).toFixed(1)}km`;
    }
}

/**
 * 複数地点の中心座標を計算
 * @param {Array} coordinates - 座標配列 [{lat, lon}, ...]
 * @returns {Object} 中心座標 {lat, lon}
 */
function calculateCenterPoint(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        throw new Error('座標配列が空です');
    }

    let totalLat = 0;
    let totalLon = 0;
    let validCount = 0;

    for (const coord of coordinates) {
        if (validateCoordinates(coord.lat, coord.lon)) {
            totalLat += coord.lat;
            totalLon += coord.lon;
            validCount++;
        }
    }

    if (validCount === 0) {
        throw new Error('有効な座標が見つかりません');
    }

    return {
        lat: totalLat / validCount,
        lon: totalLon / validCount
    };
}

module.exports = {
    validateCoordinates,
    calculateDistance,
    shouldTriggerControl,
    formatCoordinates,
    formatDistance,
    calculateCenterPoint
};
