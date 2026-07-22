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
    logger.info(`[map] 请求腾讯地图: address=${address.trim()}, key=${MAP_KEY.substring(0, 8)}...`);

    const response = await axios.get(url, {
      params: { key: MAP_KEY, address: address.trim() },
      timeout: TIMEOUT,
    });

    const data = response.data;
    logger.info('[map] 腾讯地图原始响应:', JSON.stringify(data));

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

    // 非 0 状态：记录完整响应
    logger.warn('[map] 地理编码失败 — status:', data && data.status, 'message:', data && data.message, 'body:', JSON.stringify(data));
    return res.json({
      success: false, code: 200,
      message: (data && data.message) || '地址解析失败',
    });
  } catch (err) {
    logger.error('[map] 地理编码请求异常:', err.message, 'response:', err.response && JSON.stringify(err.response.data));
    res.status(500).json({ success: false, code: 500, message: '地图服务暂不可用' });
  }
});

module.exports = router;
