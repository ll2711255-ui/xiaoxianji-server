/**
 * 认证路由
 *   POST /api/v1/auth/wechat-login   — 小程序 wx.login → JWT
 *   POST /api/v1/auth/password-login  — 手机号+密码登录（Web/收银）
 *   POST /api/v1/auth/refresh         — 刷新 JWT
 */
import { Router, Request, Response } from 'express';
import { code2Session } from '../services/wechat';
import { md5 } from '../utils/crypto';
import { signToken } from '../utils/jwt';
import { success, fail } from '../utils/response';
import { queryOne } from '../models/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ---------- 小程序微信登录 ----------
router.post('/wechat-login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      fail(res, '缺少登录凭证 code');
      return;
    }

    // 调微信 code2session
    const session = await code2Session(code);
    const { openid } = session;

    // 查库：是否存在该用户
    let user = await queryOne<any>(
      'SELECT id, role, merchant_id, nick_name, avatar_url, phone FROM users WHERE openid = ?',
      [openid],
    );

    if (!user) {
      // 新用户 → 自动注册
      const result = await queryOne<any>(
        'INSERT INTO users (openid, role, merchant_id) VALUES (?, ?, ?)',
        [openid, 'customer', 1],
      );
      // MySQL 的 INSERT 不直接返回 id，再查一次
      user = await queryOne<any>('SELECT id, role, merchant_id, nick_name, avatar_url, phone FROM users WHERE openid = ?', [openid]);
    }

    const token = signToken({
      userId: user.id,
      openid,
      role: user.role,
      merchantId: user.merchant_id || 1,
    });

    success(res, {
      token,
      user: {
        id: user.id,
        nickName: user.nick_name,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('[auth] wx-login 失败:', err.message);
    fail(res, err.message || '登录失败');
  }
});

// ---------- 手机号密码登录（Web/收银） ----------
router.post('/password-login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      fail(res, '手机号和密码不能为空');
      return;
    }

    const passwordHash = md5(password);

    const user = await queryOne<any>(
      `SELECT id, openid, phone, role, merchant_id, nick_name, avatar_url
       FROM users
       WHERE phone = ? AND password_hash = ? AND role IN ('staff', 'merchant', 'admin')`,
      [phone, passwordHash],
    );

    if (!user) {
      fail(res, '账号或密码错误');
      return;
    }

    // 更新最后登录时间
    await queryOne('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken({
      userId: user.id,
      openid: user.openid,
      role: user.role,
      merchantId: user.merchant_id || 1,
    });

    success(res, {
      token,
      user: {
        id: user.id,
        nickName: user.nick_name,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('[auth] password-login 失败:', err.message);
    fail(res, '登录失败，请稍后重试');
  }
});

// ---------- 刷新 Token ----------
router.post('/refresh', authMiddleware, (req: Request, res: Response) => {
  const { user } = req;
  if (!user) {
    fail(res, '登录已过期', 401, 401);
    return;
  }

  const token = signToken({
    userId: user.userId,
    openid: user.openid,
    role: user.role,
    merchantId: user.merchantId,
  });

  success(res, { token });
});

export default router;
