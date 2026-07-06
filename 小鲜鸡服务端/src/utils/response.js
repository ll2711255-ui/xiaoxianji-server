/**
 * 统一 API 响应格式
 * { success: true, data: {...} }
 * { success: false, message: '...' }
 */

function success(data = {}) {
  return { success: true, data }
}

function fail(message = '操作失败') {
  return { success: false, message }
}

function list(items, total) {
  return { success: true, data: { items, total } }
}

module.exports = { success, fail, list }
