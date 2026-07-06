/**
 * 鉴权工具（JWT Token 版）
 *
 * 使用方式：
 *   const auth = require('../../utils/auth');
 *   Page({ onShow() { auth.checkMerchant(); } });
 *
 *   // 登录成功后保存
 *   auth.saveLoginInfo({ accessToken, refreshToken, openid, userInfo, phone, role, merchantId });
 *
 *   // 需要登录的页面
 *   if (!auth.requireLogin()) return;
 */

const { STORAGE_KEYS_API } = require('./config');
const { clearTokens } = require('./api');

const STORAGE_KEYS = {
  openid: 'openid',
  role: 'role',
  userInfo: 'userInfo',
  merchantId: 'merchantId',
  phone: 'phone',
  // JWT tokens（与 config.js 中的 STORAGE_KEYS_API 保持一致）
  accessToken: STORAGE_KEYS_API.ACCESS_TOKEN,
  refreshToken: STORAGE_KEYS_API.REFRESH_TOKEN
};

/**
 * 保存登录信息到 storage + globalData
 * @param {object} result — 登录接口返回的数据
 *   { accessToken, refreshToken, openid, nickName, avatarUrl, phone, role, merchantId }
 */
function saveLoginInfo(result) {
  const app = getApp();

  // JWT tokens
  if (result.accessToken) {
    wx.setStorageSync(STORAGE_KEYS.accessToken, result.accessToken);
    if (app) app.globalData.accessToken = result.accessToken;
  }
  if (result.refreshToken) {
    wx.setStorageSync(STORAGE_KEYS.refreshToken, result.refreshToken);
  }

  // 用户标识
  if (result.openid) {
    wx.setStorageSync(STORAGE_KEYS.openid, result.openid);
    if (app) app.globalData.openid = result.openid;
  }

  // 手机号
  if (result.phone) {
    wx.setStorageSync(STORAGE_KEYS.phone, result.phone);
    if (app) app.globalData.phone = result.phone;
  }

  // 用户资料
  if (result.nickName || result.avatarUrl || result.userInfo) {
    const userInfo = result.userInfo || {
      nickName: result.nickName || '',
      avatarUrl: result.avatarUrl || ''
    };
    wx.setStorageSync(STORAGE_KEYS.userInfo, userInfo);
    if (app) app.globalData.userInfo = userInfo;
  }

  // 角色 & 商家ID
  if (result.role) {
    wx.setStorageSync(STORAGE_KEYS.role, result.role);
    if (app) app.globalData.role = result.role;
  }

  if (result.merchantId) {
    wx.setStorageSync(STORAGE_KEYS.merchantId, result.merchantId);
    if (app) app.globalData.merchantId = result.merchantId;
  }
}

/**
 * 获取当前登录信息
 * @returns {{ openid: string, phone: string, userInfo: object|null, role: string, merchantId: string, accessToken: string }}
 */
function getLoginInfo() {
  return {
    openid: wx.getStorageSync(STORAGE_KEYS.openid) || '',
    phone: wx.getStorageSync(STORAGE_KEYS.phone) || '',
    userInfo: wx.getStorageSync(STORAGE_KEYS.userInfo) || null,
    role: wx.getStorageSync(STORAGE_KEYS.role) || '',
    merchantId: wx.getStorageSync(STORAGE_KEYS.merchantId) || '',
    accessToken: wx.getStorageSync(STORAGE_KEYS.accessToken) || '',
    refreshToken: wx.getStorageSync(STORAGE_KEYS.refreshToken) || ''
  };
}

/**
 * 检查是否已登录（有 access_token 或 openid）
 * 未登录时跳转登录页，返回 false 中断调用方后续逻辑
 *
 * @returns {boolean} true=已登录, false=已跳转登录页
 */
function requireLogin() {
  const accessToken = wx.getStorageSync(STORAGE_KEYS.accessToken);
  const openid = wx.getStorageSync(STORAGE_KEYS.openid);
  if (!accessToken && !openid) {
    wx.navigateTo({ url: '/pages/login/login' });
    return false;
  }
  return true;
}

/**
 * 检查是否已登录（旧版兼容：跳转首页）
 * @returns {boolean}
 */
function checkLogin() {
  const accessToken = wx.getStorageSync(STORAGE_KEYS.accessToken);
  const openid = wx.getStorageSync(STORAGE_KEYS.openid);
  if (!accessToken && !openid) {
    wx.redirectTo({ url: '/pages/index/index' });
    return false;
  }
  return true;
}

/**
 * 检查商家权限
 * 在商家端每个页面的 onShow 调用
 * 若不是 merchant 或 admin，弹出提示后跳转顾客首页
 * @returns {boolean}
 */
function checkMerchant() {
  const role = wx.getStorageSync(STORAGE_KEYS.role);
  const merchantRoles = ['admin', 'manager', 'employee'];
  if (!merchantRoles.includes(role)) {
    wx.showToast({ title: '无访问权限', icon: 'none', duration: 2000 });
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/index/index' });
    }, 2000);
    return false;
  }
  return true;
}

/**
 * 手机号脱敏（可复用的纯函数，不依赖 this）
 * @param {string} phone — 原始手机号
 * @returns {string} 脱敏后手机号，如 138****8888
 */
function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

/**
 * 清除登录态
 * 清除 storage 中的鉴权信息 + 更新 app.globalData
 */
function clearAuth() {
  Object.values(STORAGE_KEYS).forEach(key => wx.removeStorageSync(key));
  // 同步清除 api.js 中的 token（调 api 模块的清除方法）
  try {
    clearTokens();
  } catch (e) { /* ignore */ }
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.openid = '';
    app.globalData.role = '';
    app.globalData.userInfo = null;
    app.globalData.merchantId = '';
    app.globalData.phone = '';
    app.globalData.accessToken = '';
  }
}

module.exports = {
  saveLoginInfo,
  getLoginInfo,
  requireLogin,
  checkLogin,
  checkMerchant,
  clearAuth,
  maskPhone,
  STORAGE_KEYS
};
