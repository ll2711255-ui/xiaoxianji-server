/**
 * 平台判断工具
 *
 * uni-app 条件编译辅助：
 *   - 编译时：使用 #ifdef / #ifndef 条件编译指令（推荐）
 *   - 运行时：使用本模块的 getPlatform() 函数
 *
 * 使用方式：
 *   import { getPlatform, isWeixin, isAlipay, isToutiao } from '@/utils/platform'
 *
 *   const { name } = getPlatform()
 *   if (isWeixin()) { /* 微信特有逻辑 *!/ }
 */

/**
 * 获取当前运行平台信息
 * @returns {{ name: string, isWeixin: boolean, isAlipay: boolean, isToutiao: boolean }}
 */
export function getPlatform() {
  // #ifdef MP-WEIXIN
  return { name: 'weixin', isWeixin: true, isAlipay: false, isToutiao: false }
  // #endif

  // #ifdef MP-ALIPAY
  return { name: 'alipay', isWeixin: false, isAlipay: true, isToutiao: false }
  // #endif

  // #ifdef MP-TOUTIAO
  return { name: 'toutiao', isWeixin: false, isAlipay: false, isToutiao: true }
  // #endif

  // #ifdef H5
  return { name: 'h5', isWeixin: false, isAlipay: false, isToutiao: false }
  // #endif

  return { name: 'unknown', isWeixin: false, isAlipay: false, isToutiao: false }
}

/** 是否微信小程序 */
export function isWeixin() {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
}

/** 是否支付宝小程序 */
export function isAlipay() {
  // #ifdef MP-ALIPAY
  return true
  // #endif
  return false
}

/** 是否抖音小程序 */
export function isToutiao() {
  // #ifdef MP-TOUTIAO
  return true
  // #endif
  return false
}

// ========== 支付 Provider 映射 ==========

/**
 * 编译时常量：当前平台对应的支付 provider 名称
 *
 * 使用方式（编译时自动选择）：
 *   import { PAY_PROVIDER, currentProvider } from '@/utils/platform'
 *   // currentProvider 在编译后就确定了，运行时不会有分支开销
 *
 * 使用方式（运行时判断）：
 *   uni.requestPayment({ provider: PAY_PROVIDER[process.env.UNI_PLATFORM] })
 */
export const PAY_PROVIDER = {
  'mp-weixin': 'wxpay',
  'mp-alipay': 'alipay',
  'mp-toutiao': 'toutiao'
}

/**
 * 编译时确定的当前平台支付 provider
 * 通过条件编译，编译产物中只有一个值
 */
// #ifdef MP-WEIXIN
export const currentProvider = 'wxpay'
// #endif
// #ifdef MP-ALIPAY
export const currentProvider = 'alipay'
// #endif
// #ifdef MP-TOUTIAO
export const currentProvider = 'toutiao'
// #endif
// #ifndef MP-WEIXIN
// #ifndef MP-ALIPAY
// #ifndef MP-TOUTIAO
export const currentProvider = 'wxpay'
// #endif
// #endif
// #endif
