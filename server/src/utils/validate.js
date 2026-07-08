/**
 * 输入校验工具
 * 在参数进入业务逻辑前做格式/长度/字符白名单检查
 * SQL 注入防不住这里，但可以提前拦截恶意输入、减少数据库压力
 */

/** 订单号格式：1位大写字母 + 5位数字 */
const ORDER_NO_PATTERN = /^[A-Z]\d{5}$/;

/**
 * 校验订单号格式
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrderNo(orderNo) {
  if (!orderNo || typeof orderNo !== 'string') {
    return { valid: false, error: '订单号不能为空' };
  }
  if (!ORDER_NO_PATTERN.test(orderNo)) {
    return { valid: false, error: '订单号格式不合法' };
  }
  return { valid: true };
}

/** 搜索关键词最大长度 */
const KEYWORD_MAX_LEN = 50;

/**
 * 校验搜索关键词
 * @returns {{ valid: boolean, error?: string }}
 */
function validateKeyword(keyword) {
  if (keyword === undefined || keyword === null || keyword === '') {
    return { valid: true }; // 空值放行
  }
  if (typeof keyword !== 'string') {
    return { valid: false, error: '关键词格式不合法' };
  }
  if (keyword.length > KEYWORD_MAX_LEN) {
    return { valid: false, error: `关键词不能超过 ${KEYWORD_MAX_LEN} 个字符` };
  }
  return { valid: true };
}

/** 分页 pageSize 上限 */
const PAGE_SIZE_MAX = 100;

/**
 * 校验分页参数
 */
function validatePageSize(pageSize) {
  const n = parseInt(pageSize, 10);
  if (isNaN(n) || n < 1) return { valid: true, value: 20 }; // 默认 20
  if (n > PAGE_SIZE_MAX) {
    return { valid: false, error: `pageSize 不能超过 ${PAGE_SIZE_MAX}` };
  }
  return { valid: true, value: n };
}

module.exports = {
  ORDER_NO_PATTERN,
  KEYWORD_MAX_LEN,
  PAGE_SIZE_MAX,
  validateOrderNo,
  validateKeyword,
  validatePageSize,
};
