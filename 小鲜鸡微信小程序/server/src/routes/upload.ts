/**
 * 文件上传路由
 *
 *   POST /api/v1/upload/image — 上传图片到腾讯云 COS
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { success, fail } from '../utils/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Multer 配置：本地临时存储
const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, '../../uploads'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的图片格式'));
    }
  },
});

router.post('/image', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      fail(res, '请选择文件');
      return;
    }

    // 开发阶段：返回本地路径
    // 生产环境：上传到腾讯云 COS 并返回 CDN URL
    const localUrl = `/uploads/${req.file.filename}`;

    // TODO: 对接腾讯云 COS SDK
    // const cosUrl = await uploadToCos(req.file.path, req.file.filename);

    success(res, {
      url: localUrl,
      fileId: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (err: any) {
    fail(res, '上传失败：' + err.message);
  } finally {
    // 生产环境：上传 COS 成功后删除本地临时文件
  }
});

export default router;
