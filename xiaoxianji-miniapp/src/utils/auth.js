/**
 * 鉴权工具 — 登录态管理（uni-app 版）
 *
 * 迁移自原微信小程序的 utils/auth.js
 * 主要变更：
 *   - wx.login → uni.login（uni-app 统一 API）
 *   - wx.setStorageSync → uni.setStorageSync
 *   - getApp().globalData → Pinia Store（stores/auth.js）
 *   - 增加平台条件编译（微信/支付宝/抖音登录差异）
 *
 * 使用方式：
 *   import { saveLoginInfo, getLoginInfo, requireLogin, checkMerchant, clearAuth } from '@/utils/auth'
 */

import { saveTokens } from './request'

/** Storage 键名 */
export const STORAGE_KEYS = {
  openid: 'openid',
  role: 'role',
  userInfo: 'userInfo',
  merchantId: 'merchantId',
  phone: 'phone'
}

/**
 * 保存登录信息到 storage + Pinia Store
 * @param {object} result — 登录接口返回的数据
 */
export function saveLoginInfo(result) {
  // 使用动态 import 避免循环依赖
  const { useAuthStore } = require('@/stores/auth')
  const authStore = useAuthStore()

  // JWT tokens（通过 request.js 的 saveTokens，避免循环导入）
  if (result.accessToken) {
    saveTokens(result.accessToken, result.refreshToken || '')
  }

  // 用户标识
  if (result.openid) {
    uni.setStorageSync(STORAGE_KEYS.openid, result.openid)
    authStore.openid = result.openid
  }

  // 手机号
  if (result.phone) {
    uni.setStorageSync(STORAGE_KEYS.phone, result.phone)
    authStore.phone = result.phone
  }

  // 用户资料
  if (result.nickName || result.avatarUrl || result.userInfo) {
    const userInfo = result.userInfo || {
      nickName: result.nickName || '',
      avatarUrl: result.avatarUrl || ''
    }
    uni.setStorageSync(STORAGE_KEYS.userInfo, userInfo)
    authStore.userInfo = userInfo
  }

  // 角色 & 商家ID
  if (result.role) {
    uni.setStorageSync(STORAGE_KEYS.role, result.role)
    authStore.role = result.role
  }

  if (result.merchantId) {
    uni.setStorageSync(STORAGE_KEYS.merchantId, result.merchantId)
    authStore.merchantId = result.merchantId
  }
}

/**
 * 获取当前登录信息
 * @returns {{ openid: string, phone: string, userInfo: object|null, role: string, merchantId: string, accessToken: string }}
 */
export function getLoginInfo() {
  return {
    openid: uni.getStorageSync(STORAGE_KEYS.openid) || '',
    phone: uni.getStorageSync(STORAGE_KEYS.phone) || '',
    userInfo: uni.getStorageSync(STORAGE_KEYS.userInfo) || null,
    role: uni.getStorageSync(STORAGE_KEYS.role) || '',
    merchantId: uni.getStorageSync(STORAGE_KEYS.merchantId) || '',
    accessToken: uni.getStorageSync('access_token') || '',
    refreshToken: uni.getStorageSync('refresh_token') || ''
  }
}

/**
 * 检查是否已登录（有 access_token 或 openid）
 * 未登录时跳转登录页，返回 false
 * @returns {boolean}
 */
export function requireLogin() {
  const accessToken = uni.getStorageSync('access_token')
  const openid = uni.getStorageSync(STORAGE_KEYS.openid)
  if (!accessToken && !openid) {
    uni.navigateTo({ url: '/pages/login/login' })
    return false
  }
  return true
}

/**
 * 检查商家权限
 * 若不是 merchant/admin/manager/employee，弹出提示后跳转首页
 * @returns {boolean}
 */
export function checkMerchant() {
  const role = uni.getStorageSync(STORAGE_KEYS.role)
  const merchantRoles = ['admin', 'manager', 'employee']
  if (!merchantRoles.includes(role)) {
    uni.showToast({ title: '无访问权限', icon: 'none', duration: 2000 })
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/index/index' })
    }, 2000)
    return false
  }
  return true
}

/**
 * 手机号脱敏
 * @param {string} phone
 * @returns {string} 如 138****8888
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone || ''
  return phone.slice(0, 3) + '****' + phone.slice(7)
}

/**
 * 清除登录态
 */
export function clearAuth() {
  Object.values(STORAGE_KEYS).forEach(key => uni.removeStorageSync(key))
  uni.removeStorageSync('access_token')
  uni.removeStorageSync('refresh_token')
  uni.removeStorageSync('token_expires_at')

  try {
    const { useAuthStore } = require('@/stores/auth')
    const authStore = useAuthStore()
    authStore.$reset()
  } catch (e) { /* ignore */ }
}

/**
 * uni.login 封装 — 获取平台 code
 *
 * 三方小程序登录差异：
 *   - 微信：uni.login → code（用于 wx.login 换取 openid）
 *   - 支付宝：uni.login → authCode（需 my.getAuthCode 替代）
 *   - 抖音：uni.login → code（类似微信，需后端适配）
 *
 * @returns {Promise<string>} login code / authCode
 */
export function getLoginCode() {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.login({
      provider: 'weixin',
      success: (res) => resolve(res.code),
      fail: reject
    })
    // #endif

    // #ifdef MP-ALIPAY
    uni.login({
      provider: 'alipay',
      scopes: 'auth_user',
      success: (res) => resolve(res.authCode || res.code),
      fail: reject
    })
    // #endif

    // #ifdef MP-TOUTIAO
    uni.login({
      provider: 'toutiao',
      success: (res) => resolve(res.code),
      fail: reject
    })
    // #endif

    // H5 降级
    // #ifdef H5
    resolve('h5_no_code')
    // #endif
  })
}

/**
 * 获取当前平台对应的登录 API 路径
 *
 * 三方小程序登录接口差异：
 *   - 微信：/auth/wx-login（wx.login code → openid → JWT）
 *   - 支付宝：/auth/alipay-login（my.getAuthCode → userId → JWT）
 *   - 抖音：/auth/tt-login（tt.login code → openid → JWT）
 *
 * @returns {string} API 路径
 */
export function getLoginEndpoint() {
  // #ifdef MP-WEIXIN
  return '/auth/wx-login'
  // #endif
  // #ifdef MP-ALIPAY
  return '/auth/alipay-login'
  // #endif
  // #ifdef MP-TOUTIAO
  return '/auth/tt-login'
  // #endif
  // #ifdef H5
  return '/auth/wx-login'
  // #endif
  return '/auth/wx-login'
}

/**
 * 获取当前平台对应的手机号登录 API 路径
 * @returns {string} API 路径
 */
export function getPhoneEndpoint() {
  // #ifdef MP-WEIXIN
  return '/auth/wx-phone'
  // #endif
  // #ifdef MP-ALIPAY
  return '/auth/alipay-phone'
  // #endif
  // #ifdef MP-TOUTIAO
  return '/auth/toutiao-phone'
  // #endif
  // #ifdef H5
  return '/auth/wx-phone'
  // #endif
  return '/auth/wx-phone'
}
