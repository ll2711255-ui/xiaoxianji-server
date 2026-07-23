/**
 * 用户路由 /api/user/*
 *
 * 头像上传 → 保存文件 → 更新 DB
 * 微信 chooseAvatar 返回的头像已由微信审核，无需额外内容安全检测
 */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
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
 * 上传头像（微信 chooseAvatar → 直接保存，无需内容安全检测）
 *
 * 流程：
 *   1. 接收文件 → 保存到磁盘
 *   2. 更新 users.avatar_url
 *   3. 返回头像 URL
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

      // 5. 直接更新用户头像（微信头像已审核，无需额外检测）
      await db.execute(
        'UPDATE users SET avatar_url = ? WHERE id = ?',
        [avatarUrl, req.user.id]
      );

      logger.info('[user] 头像上传成功:', filename,
        '(' + (req.file.size / 1024).toFixed(1) + 'KB)');

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
