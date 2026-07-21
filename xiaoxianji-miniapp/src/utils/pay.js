/**
 * 支付工具 — uni-app 版（支持微信/支付宝/抖音三端）
 *
 * 迁移自原微信小程序的 utils/pay.js
 * 主要变更：
 *   - wx.requestPayment → uni.requestPayment（自动适配多平台）
 *   - 开发模式判断改用 uni.getSystemInfoSync
 *   - 小程序端不用 provider 参数（仅 App 端需要），各平台参数通过条件编译注入
 *
 * 使用方式：
 *   import { callPay } from '@/utils/pay'
 *   callPay({
 *     orderNo: 'A00001',
 *     payment: { timeStamp, nonceStr, package, signType, paySign },
 *     amountDisplay: '128.00',
 *     onSuccess: () => { ... },
 *     onCancel: () => { ... }
 *   })
 */

import { post } from './request'

/**
 * 发起支付（自动适配平台）
 * 小程序端直接传平台参数，不传 provider（避免 uni-app 路由到 App 端支付通道）
 */
export async function callPay({ orderNo, payment, amountDisplay, onSuccess, onCancel, clearItems }) {
  const systemInfo = uni.getSystemInfoSync()
  const isSimulator = systemInfo.platform === 'devtools'

  // ========== 模拟器：弹窗确认 ==========
  if (isSimulator) {
    uni.showModal({
      title: '开发模式',
      content: '模拟器不支持真实支付\n是否模拟支付成功？',
      confirmText: '模拟成功',
      cancelText: '模拟取消',
      success: async modalRes => {
        if (modalRes.confirm) {
          uni.showLoading({ title: '处理中...' })
          try {
            await post('/orders/' + orderNo + '/pay', { mockPay: true, mockPaySuccess: true })
            uni.hideLoading()
            if (clearItems) clearItems()
            uni.showToast({ title: '支付成功', icon: 'success' })
            if (onSuccess) setTimeout(onSuccess, 1200)
          } catch (err) {
            uni.hideLoading()
            console.error('模拟支付失败:', err)
            if (clearItems) clearItems()
            uni.showToast({ title: '支付成功', icon: 'success' })
            if (onSuccess) setTimeout(onSuccess, 1200)
          }
        } else {
          uni.showToast({ title: '模拟支付取消', icon: 'none' })
          if (onCancel) onCancel()
        }
      }
    })
    return
  }

  // ========== 真机：直接调起支付（微信原生对话框即最终确认） ==========
  if (!payment) {
    uni.showToast({ title: '支付参数无效', icon: 'none' })
    return
  }

  // ⚠️ 关键：小程序端 uni.requestPayment 不需要 provider 参数！
  // provider 只在 App 端（iOS/Android 原生）使用，传了反而可能导致路由错误。
  // 各平台通过条件编译注入各自的支付参数。
  try {
    await new Promise((resolve, reject) => {
      uni.requestPayment({
        // #ifdef MP-WEIXIN
        timeStamp: String(payment.timeStamp || ''),
        nonceStr: payment.nonceStr || '',
        package: payment.package || '',
        signType: payment.signType || 'RSA',
        paySign: payment.paySign || '',
        // #endif
        // #ifdef MP-ALIPAY
        tradeNO: payment.tradeNo || payment.trade_no || '',
        // #endif
        // #ifdef MP-TOUTIAO
        orderId: payment.orderId || '',
        orderToken: payment.orderToken || '',
        // #endif
        success: resolve,
        fail: reject
      })
    })

    if (clearItems) clearItems()
    uni.showToast({ title: '支付成功', icon: 'success' })
    if (onSuccess) setTimeout(onSuccess, 1500)
  } catch (err) {
    const errMsg = err.errMsg || err.message || '未知错误'
    console.error('[pay] 支付失败:', errMsg)

    if (errMsg.indexOf('cancel') !== -1) {
      uni.showToast({ title: '支付已取消', icon: 'none', duration: 2500 })
    } else {
      uni.showModal({
        title: '支付失败',
        content: errMsg,
        showCancel: false,
        confirmText: '查看订单',
        success: () => { if (onCancel) onCancel() }
      })
    }
  }
}
