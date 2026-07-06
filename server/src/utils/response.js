/**
 * 统一响应格式
 */
function success(data = {}, message = '成功') {
  return {
    success: true,
    code: 200,
    message,
    data,
  };
}

function error(message = '服务器内部错误', code = 500) {
  return {
    success: false,
    code,
    message,
    data: null,
  };
}

function paginated(rows, total, page, pageSize) {
  return {
    success: true,
    code: 200,
    message: '成功',
    data: {
      list: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

module.exports = { success, error, paginated };
