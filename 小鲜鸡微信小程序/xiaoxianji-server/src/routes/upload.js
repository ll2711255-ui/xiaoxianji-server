const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

// 本地存储配置
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload/image
router.post('/image', auth(), upload.single('file'), (req, res) => {
  if (!req.file) return res.fail('请选择文件');
  const url = `/uploads/${req.file.filename}`;
  res.ok({ url, filename: req.file.filename });
});

// GET /api/upload/sign — OSS上传签名（生产环境使用）
router.get('/sign', auth(), (req, res) => {
  // TODO: 实现阿里云 OSS 临时签名
  res.ok({ sign: 'oss-signature-placeholder', region: process.env.OSS_REGION, bucket: process.env.OSS_BUCKET });
});

module.exports = router;
