/**
 * 公共支付工具 — 统一管理 wx.requestPayment 调用
 *
 * 三种模式：
 *   1. isDev     — 开发模式：直接模拟支付成功
 *   2. devtools  — 模拟器：弹窗确认后模拟
 *   3. 真机     — 真实微信支付（wx.requestPayment）
 *
 * 使用方式：
 *   const pay = require('../../utils/pay');
 *   pay.callWxPay({
 *     orderNo: 'A00001',
 *     payment: { timeStamp, nonceStr, package, signType, paySign },
 *     amountDisplay: '128.00',      // 仅用于确认弹窗展示
 *     onSuccess: () => { ... },     // 支付成功回调
 *     onCancel: () => { ... },      // 用户取消回调
 *   });
 */
const api = require('./api');

/**
 * 发起微信支付
 * @param {object} options
 * @param {string}  options.orderNo         - 订单号
 * @param {object}  options.payment         - 支付参数（prepay_id 二次签名）
 * @param {string}  options.amountDisplay   - 展示用金额（如 "128.00"）
 * @param {Function} options.onSuccess       - 支付成功回调
 * @param {Function} options.onCancel        - 用户取消/失败回调
 * @param {Array<string>} [options.orderNos] - 多订单场景（会依次支付）
 * @param {Function} [options.clearItems]    - 清购物车回调（checkout 场景）
 */
function callWxPay({ orderNo, payment, amountDisplay, onSuccess, onCancel, clearItems }) {
  const app = getApp();
  const isDev = app && app.globalData && app.globalData.isDev;

  // ========== 开发模式：模拟支付 ==========
  if (isDev) {
    wx.showLoading({ title: '模拟支付中...' });
    api.post('/orders/' + orderNo + '/pay', { mockPay: true })
      .then(() => {
        wx.hideLoading();
        if (clearItems) clearItems();
        wx.showToast({ title: '支付成功(模拟)', icon: 'success' });
        if (onSuccess) setTimeout(onSuccess, 1200);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('模拟支付失败:', err);
        wx.showToast({ title: '模拟支付失败', icon: 'none' });
      });
    return;
  }

  // ========== 模拟器（非 isDev 模式）：弹窗确认 ==========
  const systemInfo = wx.getSystemInfoSync();
  const isSimulator = systemInfo.platform === 'devtools';

  if (isSimulator) {
    wx.showModal({
      title: '开发模式',
      content: '模拟器不支持真实支付\n是否模拟支付成功？',
      confirmText: '模拟成功',
      cancelText: '模拟取消',
      success: async modalRes => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await api.post('/orders/' + orderNo + '/pay', {
              mockPay: true,
              mockPaySuccess: true
            });
            wx.hideLoading();
            if (clearItems) clearItems();
            wx.showToast({ title: '支付成功', icon: 'success' });
            if (onSuccess) setTimeout(onSuccess, 1200);
          } catch (err) {
            wx.hideLoading();
            console.error('模拟支付失败:', err);
            if (clearItems) clearItems();
            wx.showToast({ title: '支付成功', icon: 'success' });
            if (onSuccess) setTimeout(onSuccess, 1200);
          }
        } else {
          wx.showToast({ title: '模拟支付取消', icon: 'none' });
          if (onCancel) onCancel();
        }
      }
    });
    return;
  }

  // ========== 真机：微信支付 ==========
  if (!payment) {
    wx.showToast({ title: '支付参数无效', icon: 'none' });
    return;
  }

  wx.showModal({
    title: '确认支付',
    content: `确认支付 ¥${amountDisplay || '0.00'}`,
    confirmText: '开始支付',
    cancelText: '暂不支付',
    success: async modalRes => {
      if (!modalRes.confirm) {
        wx.showToast({ title: '订单已保留', icon: 'none' });
        if (onCancel) setTimeout(onCancel, 1000);
        return;
      }

      const ts = typeof payment.timeStamp === 'number'
        ? String(payment.timeStamp)
        : (payment.timeStamp || '');

      console.log('[pay] wx.requestPayment 参数:', JSON.stringify({
        timeStamp: ts,
        nonceStr: payment.nonceStr || '',
        package: payment.package || '',
        signType: payment.signType || 'RSA',
        paySign_preview: (payment.paySign || '').substring(0, 20) + '...'
      }));

      try {
        await new Promise((resolve, reject) => {
          wx.requestPayment({
            timeStamp: ts,
            nonceStr: payment.nonceStr || '',
            package: payment.package || '',
            signType: payment.signType || 'RSA',
            paySign: payment.paySign || '',
            success: resolve,
            fail: reject
          });
        });

        // 支付成功
        if (clearItems) clearItems();
        wx.showToast({ title: '支付成功', icon: 'success' });
        if (onSuccess) setTimeout(onSuccess, 1500);
      } catch (err) {
        const errMsg = err.errMsg || err.message || '未知错误';
        console.error('[pay] wx.requestPayment 失败:', errMsg, JSON.stringify(err));

        if (errMsg.indexOf('cancel') !== -1) {
          wx.showToast({ title: '支付已取消', icon: 'none', duration: 2500 });
        } else {
          wx.showModal({
            title: '支付失败',
            content: errMsg,
            showCancel: false,
            confirmText: '查看订单',
            success: () => {
              if (onCancel) onCancel();
            }
          });
        }
      }
    }
  });
}

module.exports = { callWxPay };
