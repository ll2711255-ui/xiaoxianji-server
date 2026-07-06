/**
 * 统一 API 响应格式
 *
 * 成功: { success: true, data: {...} }
 * 失败: { success: false, error: '错误描述', code: 'ERROR_CODE' }
 * 分页: { success: true, data: [...], pagination: { page, pageSize, total, totalPages } }
 */

function success(data = {}) {
  return { success: true, ...data };
}

function error(message, code = 'ERROR') {
  return { success: false, error: message, code };
}

function paginated(data, { page, pageSize, total }) {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Express 路由级别的快捷响应方法
 * 注入到 res 对象上
 */
function responseMiddleware(req, res, next) {
  res.ok = (data = {}) => res.json(success(data));
  res.okPaginated = (data, pagination) => res.json(paginated(data, pagination));
  res.fail = (message, code, statusCode = 400) =>
    res.status(statusCode).json(error(message, code));
  res.failUnauthorized = (message = '未登录') =>
    res.status(401).json(error(message, 'UNAUTHORIZED'));
  res.failForbidden = (message = '无权限') =>
    res.status(403).json(error(message, 'FORBIDDEN'));
  res.failNotFound = (message = '资源不存在') =>
    res.status(404).json(error(message, 'NOT_FOUND'));
  res.failServerError = (message = '服务器内部错误') =>
    res.status(500).json(error(message, 'SERVER_ERROR'));
  next();
}

module.exports = {
  success,
  error,
  paginated,
  responseMiddleware,
};
