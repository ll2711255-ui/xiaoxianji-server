import { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response';

type Role = 'customer' | 'staff' | 'merchant' | 'admin';

/**
 * 角色权限中间件工厂
 * @param allowed 允许的角色列表
 *
 * customer  → C 端小程序
 * staff     → 收银端
 * merchant  → 管理后台 + 收银端
 * admin     → 管理后台 + 收银端 + 店员管理
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      fail(res, '请先登录', 401, 401);
      return;
    }

    if (!allowed.includes(req.user.role)) {
      fail(res, '权限不足', 403, 403);
      return;
    }

    next();
  };
}

/** 快捷导出：管理后台权限 */
export const requireAdmin = requireRole('admin', 'merchant');

/** 快捷导出：收银端权限 */
export const requireCashier = requireRole('admin', 'merchant', 'staff');
