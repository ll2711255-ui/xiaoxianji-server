/**
 * 内容安全回调路由 /api/sec-callback/*
 *
 * 处理微信异步内容安全检测结果推送（wxa_media_check 事件）
 *
 * 回调格式（JSON）：
 *   {
 *     "ToUserName": "gh_xxx",
 *     "FromUserName": "oOXZ43...",
 *     "CreateTime": 1234567890,
 *     "MsgType": "event",
 *     "Event": "wxa_media_check",
 *     "appid": "wx178d...",
 *     "trace_id": "xxx",
 *     "version": "2",
 *     "detail": [{
 *       "strategy": "content_model",
 *       "errcode": 0,
 *       "suggest": "pass",  // "pass" 通过 / "risky" 违规 / "review" 可疑
 *       "label": 20001,
 *       "level": 1
 *     }],
 *     "errCode": 0,
 *     "errMsg": "success"
 *   }
 *
 * 注意：此路由需要获取 raw body 用于 XML 兼容处理
 */
const router = require('express').Router();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');

// 微信消息推送 Token（与 mp.weixin.qq.com 后台配置一致）
const WX_PUSH_TOKEN = process.env.WX_PUSH_TOKEN || 'xiaoxianji2026';

// 默认头像路径（违规时替换为此头像）
const DEFAULT_AVATAR = '/uploads/avatars/default-avatar.png';

// 接收 raw body（JSON 格式）
router.use(express.json());

/**
 * GET /api/sec-callback/media-check
 * 微信消息推送 URL 验证
 * 微信配置回调地址时会发送 GET 请求验证服务器所有权
 */
router.get('/media-check', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!signature || !timestamp || !nonce || !echostr) {
    logger.warn('[sec-callback] GET 验证缺少参数:', req.query);
    return res.status(400).send('missing params');
  }

  // 字典序排序 token, timestamp, nonce → 拼接 → SHA1
  const arr = [WX_PUSH_TOKEN, timestamp, nonce].sort();
  const raw = arr.join('');
  const hash = crypto.createHash('sha1').update(raw).digest('hex');

  // 详细诊断日志（排查签名不匹配）
  logger.info('[sec-callback] GET 验证参数: ' + JSON.stringify({
    signature,
    timestamp,
    nonce,
    echostr: echostr.substring(0, 6) + '...',
    token: WX_PUSH_TOKEN,
    sorted: arr,
    raw: raw.substring(0, 40) + '...',
    computed: hash,
  }));

  if (hash === signature) {
    logger.info('[sec-callback] URL 验证通过');
    return res.send(echostr);
  }

  logger.warn('[sec-callback] URL 验证失败 — signature 不匹配');
  return res.status(403).send('signature mismatch');
});

/**
 * POST /api/sec-callback/media-check
 * 接收微信 wxa_media_check 异步检测结果
 */
router.post('/media-check', async (req, res) => {
  try {
    const body = req.body;

    logger.info('[sec-callback] 收到 content security 回调: ' + JSON.stringify({
      Event: body.Event,
      appid: body.appid,
      trace_id: body.trace_id,
      detail: body.detail,
    }));

    // 验证事件类型
    if (body.Event !== 'wxa_media_check') {
      logger.info('[sec-callback] 非 wxa_media_check 事件，忽略:', body.Event);
      return res.send('success');
    }

    const traceId = body.trace_id || '';
    if (!traceId) {
      logger.warn('[sec-callback] 缺少 trace_id');
      return res.send('success');
    }

    // 查找 trace_id 对应的用户
    const user = await db.queryOne(
      'SELECT id, avatar_url, avatar_pending_url, avatar_review_status FROM users WHERE avatar_trace_id = ? AND avatar_review_status = ?',
      [traceId, 'pending']
    );

    if (!user) {
      logger.warn('[sec-callback] 未找到 pending 状态的 trace_id:', traceId);
      return res.send('success');
    }

    // 解析检测结果
    const detail = (body.detail && body.detail[0]) || {};
    const suggest = detail.suggest || '';

    if (suggest === 'pass') {
      // ========== 审核通过 → 正式生效 ==========
      await db.execute(
        'UPDATE users SET avatar_url = ?, avatar_review_status = ?, avatar_trace_id = ?, avatar_pending_url = ? WHERE id = ?',
        [user.avatarPendingUrl, 'approved', '', '', user.id]
      );

      logger.info('[sec-callback] ✅ 头像审核通过, user:', user.id, 'trace_id:', traceId);

    } else if (suggest === 'risky' || suggest === 'review') {
      // ========== 违规或可疑 → 替换为默认头像 ==========
      // 删除违规图片文件
      if (user.avatarPendingUrl) {
        try {
          const urlPath = new URL(user.avatarPendingUrl).pathname;
          // path.join 遇到以 / 开头的参数会当作绝对路径，必须去掉前导 /
	          const filePath = path.join(__dirname, '..', '..', urlPath.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info('[sec-callback] 已删除违规头像文件:', filePath);
          }
        } catch (_) { /* best effort */ }
      }

      await db.execute(
        'UPDATE users SET avatar_url = ?, avatar_review_status = ?, avatar_trace_id = ?, avatar_pending_url = ? WHERE id = ?',
        [DEFAULT_AVATAR, 'rejected', '', '', user.id]
      );

      logger.warn('[sec-callback] ⚠️ 头像审核违规, user:', user.id,
        'suggest:', suggest, 'trace_id:', traceId,
        'label:', detail.label, 'level:', detail.level);

    } else {
      logger.warn('[sec-callback] 未知 suggest 值:', suggest, 'trace_id:', traceId);
    }

    // 必须返回纯文本 "success" 给微信
    return res.send('success');

  } catch (err) {
    logger.error('[sec-callback] 处理回调失败: ' + (err.message || err));
    return res.send('success'); // 即使出错也返回 success，避免微信重复推送
  }
});

module.exports = router;
