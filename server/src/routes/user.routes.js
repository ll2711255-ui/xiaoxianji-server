/**
 * 用户路由 /api/user/*
 *
 * 头像上传 → 保存文件 → 立即生效 → 后台异步审核
 * 选择「微信头像」免审，但 chooseAvatar 也允许相册/拍照
 * → 图片先上线，media_check_async 后台审核，违规由回调回退
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
 * 上传头像 → 立即生效 + 后台异步审核
 *
 * 流程：
 *   1. 接收文件 → 保存到磁盘 → 立即更新 avatar_url（用户即时看到）
 *   2. 后台提交 media_check_async（不阻塞返回）
 *   3. 审核通过 → 无需操作（头像已在线）
 *   4. 审核违规 → 微信回调 → 回退为默认头像
 *
 * 小程序调用：
 *   uni.uploadFile({ url: '.../api/user/avatar', filePath, name: 'avatar', header: { Authorization: 'Bearer ...' } })
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
      if (!req.user.openid) {
        return res.status(400).json({
          success: false,
          message: '用户信息异常，请重新登录',
        });
      }

      // 3. 保存图片到磁盘
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = 'avatar_' + req.user.id + '_' + Date.now() + ext;
      const filePath = path.join(AVATAR_DIR, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      // 4. 构造公网 HTTPS URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.xuaioxianji.top';
      const avatarUrl = protocol + '://' + host + '/uploads/avatars/' + filename;

      // 5. 后台提交异步内容安全检测（不阻塞响应）
      let traceId = '';
      let reviewStatus = 'unchecked';
      try {
        const checkResult = await submitImageCheck(avatarUrl, req.user.openid);
        if (checkResult.success) {
          traceId = checkResult.traceId;
          reviewStatus = 'pending';
        } else {
          logger.warn('[user] media_check_async 提交失败，头像直接生效:', req.user.openid);
        }
      } catch (err) {
        logger.error('[user] media_check_async 异常:', err.message);
      }

      // 6. 立即更新头像 + 记录审核追踪信息
      await db.execute(
        'UPDATE users SET avatar_url = ?, avatar_trace_id = ?, avatar_review_status = ? WHERE id = ?',
        [avatarUrl, traceId, reviewStatus, req.user.id]
      );

      logger.info('[user] 头像上传成功:', filename,
        '(' + (req.file.size / 1024).toFixed(1) + 'KB)',
        'trace_id:', traceId || '(无)');

      res.json({
        success: true,
        code: 200,
        data: { url: avatarUrl },
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
