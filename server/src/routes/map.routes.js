/**
 * 地图服务代理路由 /api/map/*
 *
 * 小程序端调用腾讯地图 WebService API 需要 API Key 开启 WebService 功能 +
 * 绑定小程序 AppID。当 Key 未开启该功能时，小程序直接调用会返回
 * "此key未开启WebserviceAPI功能"。
 *
 * 此路由作为服务端代理：用服务器 IP 白名单方式调用腾讯地图 API，
 * 绕过小程序端 Key 的 WebService 权限限制。
 */
const router = require('express').Router();
const axios = require('axios');
const logger = require('../utils/logger');

const MAP_BASE = 'https://apis.map.qq.com';
const MAP_KEY = process.env.TENCENT_MAP_KEY || process.env.VITE_TENCENT_MAP_KEY || '';
const TIMEOUT = 8000;

/**
 * GET /api/map/geocode?address=xxx
 *
 * 地址解析（地址文本 → GPS 坐标），代理腾讯地图 geocoder API。
 * 公开接口，无需登录（地址解析不涉及用户数据）。
 */
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, code: 400, message: '缺少 address 参数' });
    }

    if (!MAP_KEY) {
      return res.status(500).json({
        success: false, code: 500,
        message: '服务端未配置 TENCENT_MAP_KEY，请在 .env 中设置'
      });
    }

    const url = `${MAP_BASE}/ws/geocoder/v1`;
    const response = await axios.get(url, {
      params: { key: MAP_KEY, address: address.trim() },
      timeout: TIMEOUT,
    });

    const data = response.data;
    if (data && data.status === 0 && data.result) {
      const loc = data.result.location || {};
      return res.json({
        success: true, code: 200,
        data: {
          latitude: loc.lat,
          longitude: loc.lng,
          title: data.result.title || address,
          province: (data.result.address_component || {}).province || '',
          city: (data.result.address_component || {}).city || '',
          district: (data.result.address_component || {}).district || '',
        }
      });
    }

    // 非 0 状态：把腾讯地图的错误消息透传给小程序端
    const errMsg = (data && data.message) || '地址解析失败';
    logger.warn('[map] 地理编码失败: ' + errMsg);
    return res.json({
      success: false, code: 200,
      message: errMsg,
    });
  } catch (err) {
    logger.error('[map] 地理编码请求异常: ' + (err.message || err));
    res.status(500).json({ success: false, code: 500, message: '地图服务暂不可用' });
  }
});

/**
 * GET /api/map/distance?from=lat,lng&to=lat,lng
 *
 * 驾车距离计算，代理腾讯地图 direction API。
 * 公开接口，无需登录。
 *
 * 三级降级策略：
 *   ① 腾讯地图驾车距离（真实路网）→ ② Haversine 直线距离（兜底）
 * 确保任何情况下都能返回一个可用距离，不阻塞下单流程。
 */
router.get('/distance', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !from.trim()) {
      return res.status(400).json({ success: false, code: 400, message: '缺少 from 参数' });
    }
    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, code: 400, message: '缺少 to 参数' });
    }

    // 解析坐标
    const fromParts = from.trim().split(',');
    const toParts = to.trim().split(',');
    const fromLat = parseFloat(fromParts[0]);
    const fromLng = parseFloat(fromParts[1]);
    const toLat = parseFloat(toParts[0]);
    const toLng = parseFloat(toParts[1]);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return res.status(400).json({ success: false, code: 400, message: '坐标格式错误，应为 lat,lng' });
    }

    // ① 优先腾讯地图驾车距离
    if (MAP_KEY) {
      try {
        const url = `${MAP_BASE}/ws/direction/v1/driving`;
        const response = await axios.get(url, {
          params: { key: MAP_KEY, from: from.trim(), to: to.trim(), output: 'json' },
          timeout: TIMEOUT,
        });

        const data = response.data;
        if (data && data.status === 0 && data.result && data.result.routes) {
          const route = data.result.routes[0];
          return res.json({
            success: true, code: 200,
            data: {
              distance: Math.round(route.distance / 10) / 100,   // 米 → 公里，保留两位
              duration: Math.ceil(route.duration / 60),           // 秒 → 分钟，向上取整
              method: 'driving',                                   // 真实驾车距离
            }
          });
        }

        // 腾讯 API 返回非 0 状态（如配额超限）→ 记录日志后降级
        logger.warn('[map] 驾车距离API失败(' + (data && data.status) + '): ' + ((data && data.message) || 'unknown') + ' → 降级为直线距离');
      } catch (apiErr) {
        logger.warn('[map] 驾车距离API请求异常: ' + (apiErr.message || apiErr) + ' → 降级为直线距离');
      }
    }

    // ② Haversine 直线距离兜底
    const haversineDist = calcHaversineKm(fromLat, fromLng, toLat, toLng);
    logger.info('[map] 直线距离兜底: ' + haversineDist + 'km (from ' + fromLat + ',' + fromLng + ' to ' + toLat + ',' + toLng + ')');
    return res.json({
      success: true, code: 200,
      data: {
        distance: haversineDist,
        duration: Math.ceil(haversineDist * 3),   // 粗略估算：城市道路 ≈ 3分钟/公里
        method: 'haversine',                        // 直线距离估算
      }
    });
  } catch (err) {
    logger.error('[map] 距离计算请求异常: ' + (err.message || err));
    res.status(500).json({ success: false, code: 500, message: '地图服务暂不可用' });
  }
});

/**
 * Haversine 公式计算两点直线距离（公里）
 */
function calcHaversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

module.exports = router;
