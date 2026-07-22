/**
 * 用户路由 /api/user/*
 *
 * 头像上传 → 异步内容安全检测 → 保存文件 → 标记待审核 → 回调生效
 */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const { submitImageCheck } = require('../utils/secCheck');
const db = require('../config/db');
const logger = require('../utils/logger');

// 头像上传目录
const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');

// 确保目录存在
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

// multer 配置：内存存储 → 方便传给 imgSecCheck
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG/PNG/WEBP/GIF/BMP 格式'));
    }
  },
});

/**
 * POST /api/user/avatar
 * 上传头像（含微信异步内容安全检测 media_check_async v2）
 *
 * 流程：
 *   1. 接收文件 → 保存到磁盘
 *   2. 构造公网 HTTPS URL
 *   3. 提交 media_check_async 检测任务
 *   4. 标记 avatar_review_status = 'pending' + 记录 trace_id
 *   5. 返回头像 URL + 审核中状态
 *   6. 微信异步回调 → 审核通过自动生效 / 违规替换为默认头像
 *
 * 小程序调用：
 *   uni.uploadFile({ url: '.../api/user/avatar', filePath, name: 'avatar', header: { Authorization: 'Bearer ...' } })
 *
 * 返回：
 *   成功提交 → { success: true, data: { url: '...', reviewStatus: 'pending' } }
 *   检测服务不可用 → { success: false, code: 'CONTENT_RISK', message: '...' }
 */
router.post(
  '/avatar',
  verifyToken,
  upload.single('avatar'),
  async (req, res) => {
    try {
      // 1. 文件存在性检查
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的头像',
        });
      }

      // 2. 用户身份检查（openid 来自 JWT）
      const openid = req.user.openid;
      if (!openid) {
        return res.status(400).json({
          success: false,
          message: '用户信息异常，请重新登录',
        });
      }

      // 3. 测试模式：URL 加 ?test_risk=1 模拟违规拦截，用于提审录屏
      if (req.query.test_risk) {
        logger.info('[user] 🧪 测试模式 — 模拟 content security 违规拦截');
        return res.status(200).json({
          success: false,
          code: 'CONTENT_RISK',
          message: '您上传的内容含违规信息，请重新选择头像',
        });
      }

      // 4. 保存图片到磁盘
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = 'avatar_' + req.user.id + '_' + Date.now() + ext;
      const filePath = path.join(AVATAR_DIR, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      // 5. 构造公网 HTTPS URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.xuaioxianji.top';
      const avatarUrl = protocol + '://' + host + '/uploads/avatars/' + filename;

      // 6. 提交异步内容安全检测（media_check_async v2）
      const checkResult = await submitImageCheck(avatarUrl, openid);

      if (!checkResult.success) {
        // API 提交失败 → 按拦截处理（异步检测场景下不默认放行）
        // 删除已保存的文件
        try { fs.unlinkSync(filePath); } catch (_) { /* best effort */ }
        logger.warn('[user] media_check_async 提交失败，拦截上传, openid:', openid);
        return res.status(200).json({
          success: false,
          code: 'CONTENT_RISK',
          message: checkResult.reason || '内容安全检测服务暂时不可用，请稍后重试',
        });
      }

      // 7. 记录待审核状态 + trace_id（回调时匹配）
      await db.execute(
        'UPDATE users SET avatar_pending_url = ?, avatar_trace_id = ?, avatar_review_status = ? WHERE id = ?',
        [avatarUrl, checkResult.traceId, 'pending', req.user.id]
      );

      logger.info('[user] 头像已提交审核:', filename,
        'trace_id:', checkResult.traceId,
        '(' + (req.file.size / 1024).toFixed(1) + 'KB)');

      res.json({
        success: true,
        code: 200,
        data: {
          url: avatarUrl,
          reviewStatus: 'pending',
        },
      });

    } catch (err) {
      // multer 文件类型/大小校验失败
      if (err.message && err.message.includes('只支持')) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '文件过大，请上传小于 5MB 的图片',
        });
      }

      logger.error('[user] 头像上传失败:', err.message);
      res.status(500).json({
        success: false,
        message: '上传失败，请稍后重试',
      });
    }
  }
);

module.exports = router;
