/**
 * 图片上传路由 /api/upload/*
 *
 * 小程序调用 wx.uploadFile → POST /api/upload/image
 * 文件存储于 server/uploads/ 目录
 * 通过 Nginx 或 Express 静态服务对外访问
 */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// 上传目录（可通过环境变量覆盖）
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * 简易 multipart 文件解析（免依赖，仅解析单文件）
 * 对小程序 wx.uploadFile 的 multipart/form-data 格式做最简解析
 */
function parseMultipart(buffer, boundary) {
  // boundary 在 Content-Type 中形如 "multipart/form-data; boundary=----WebKitFormBoundary..."
  const boundaryDelimiter = '--' + boundary;
  const endDelimiter = boundaryDelimiter + '--';
  const str = buffer.toString('binary');
  const parts = str.split(boundaryDelimiter);

  const result = { fields: {}, file: null };

  for (const part of parts) {
    if (part === '--\r\n' || part === '--' || part.trim() === '') continue;
    if (part.startsWith(endDelimiter)) continue;

    // 分离 header 与 body
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerSection = part.substring(0, headerEnd);
    let bodySection = part.substring(headerEnd + 4);

    // 去掉末尾的 \r\n
    if (bodySection.endsWith('\r\n')) {
      bodySection = bodySection.substring(0, bodySection.length - 2);
    }

    // 解析 Content-Disposition
    const nameMatch = headerSection.match(/name="([^"]+)"/);
    const filenameMatch = headerSection.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);

    if (filenameMatch) {
      // 文件字段
      const buf = Buffer.from(bodySection, 'binary');
      result.file = {
        fieldname: nameMatch ? nameMatch[1] : 'file',
        originalname: filenameMatch[1],
        mimetype: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        buffer: buf,
        size: buf.length,
      };
    } else if (nameMatch) {
      // 普通表单字段
      result.fields[nameMatch[1]] = bodySection;
    }
  }

  return result;
}

/**
 * POST /api/upload/image — 上传单张图片（需登录）
 *
 * 小程序调用：
 *   wx.uploadFile({ url: '...', filePath, name: 'file', formData: {...} })
 *
 * 返回：{ success: true, data: { url: '/uploads/xxx.jpg' } }
 */
router.post('/image', verifyToken, (req, res) => {
  // 收集 raw body buffer
  const chunks = [];

  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({
          success: false, code: 400,
          message: '请求格式需为 multipart/form-data',
        });
      }

      // 提取 boundary
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        return res.status(400).json({
          success: false, code: 400,
          message: '缺少 boundary 参数',
        });
      }
      const boundary = boundaryMatch[1].replace(/^"|"$/g, '');

      const parsed = parseMultipart(buffer, boundary);

      if (!parsed.file || parsed.file.size === 0) {
        return res.status(400).json({
          success: false, code: 400,
          message: '未收到上传文件',
        });
      }

      // 校验文件类型（仅允许图片）
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
      if (!allowedTypes.includes(parsed.file.mimetype)) {
        return res.status(400).json({
          success: false, code: 400,
          message: `不支持的文件类型: ${parsed.file.mimetype}`,
        });
      }

      // 校验文件大小（最大 5MB）
      const maxSize = 5 * 1024 * 1024;
      if (parsed.file.size > maxSize) {
        return res.status(400).json({
          success: false, code: 400,
          message: '文件过大，请上传小于 5MB 的图片',
        });
      }

      // 生成唯一文件名
      const ext = path.extname(parsed.file.originalname) || '.jpg';
      const safeName = Date.now() + '_' + Math.random().toString(36).substring(2, 10) + ext;
      const filePath = path.join(UPLOAD_DIR, safeName);

      // 写入磁盘
      fs.writeFileSync(filePath, parsed.file.buffer);

      // 构造完整访问 URL（协议 + 域名 + 路径）
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.xuaioxianji.top';
      const url = protocol + '://' + host + '/uploads/' + safeName;

      logger.info('[upload] 图片上传成功:', safeName, `(${(parsed.file.size / 1024).toFixed(1)}KB)`);

      res.json({
        success: true,
        code: 200,
        data: { url },
      });
    } catch (err) {
      logger.error('[upload] 上传失败:', err.message);
      res.status(500).json({
        success: false, code: 500,
        message: '上传失败，请重试',
      });
    }
  });

  req.on('error', (err) => {
    logger.error('[upload] 读取请求失败:', err.message);
    res.status(500).json({
      success: false, code: 500,
      message: '上传失败',
    });
  });
});

module.exports = router;
