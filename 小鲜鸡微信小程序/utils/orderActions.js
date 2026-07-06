/**
 * 订单操作权限 & 按钮文案
 *
 * 集中管理所有订单状态可执行的操作判定逻辑，
 * 商家订单列表页和详情页共享同一套规则。
 */

const { getStatusText } = require('./util');

/** 操作按钮文案 */
const ACTION_LABELS = {
  accept: '确认接单',
  process: '开始处理',
  deliver: '开始配送',
  ready: '处理完成',
  complete: '确认完成'
};

/**
 * 获取线上订单可执行的操作权限
 * @param {object} order - 订单原始数据
 * @returns {object} 权限布尔值 + 文案
 */
function getOnlineOrderActions(order) {
  const item = (order.items && order.items[0]) || {};
  const refundInfo = order.refundInfo || {};
  const isRefundFailed = (refundInfo.status === 'failed' || order.refundStatus === 'failed');

  return {
    canAccept:      order.status === 'paid',
    canReject:      order.status === 'paid',
    canWeigh:       order.status === 'accepted',
    canProcess:     order.status === 'weighed',
    canProcessDone: order.status === 'processing',
    canDeliver:     order.status === 'ready' && order.type === 'delivery',
    canReady:       false,
    canPickup:      order.status === 'ready' && order.type === 'pickup',
    canComplete:    ['delivering', 'ready'].includes(order.status),
    canRetryRefund: isRefundFailed,
    canCancel:      false,  // 列表页无取消
    canMarkPaid:    false,
    completeLabel:  ACTION_LABELS.complete,
    statusText:     isRefundFailed ? '退款异常'
                  : order.status === 'paid' ? '待接单'
                  : getStatusText(order.status, order.type)
  };
}

/**
 * 获取线下订单可执行的操作权限
 * @param {object} order - 订单原始数据
 * @returns {object}
 */
function getOfflineOrderActions(order) {
  return {
    canAccept:    false,
    canWeigh:     false,
    canProcess:   order.status === 'paid',
    canReady:     order.status === 'processing',
    canComplete:  order.status === 'ready' && order.paymentType !== 'unpaid',
    canCancel:    order.status === 'processing' || order.status === 'ready',
    canMarkPaid:  order.status === 'ready' && order.paymentType === 'unpaid',
    canPrint:     true,
    completeLabel: '确认完成'
  };
}

/**
 * 获取商家订单详情页的完整操作权限
 * @param {object} order
 * @returns {object}
 */
function getDetailOrderActions(order) {
  if (order.type === 'offline') {
    return {
      canAccept:    false,
      canWeigh:     false,
      canProcess:   order.status === 'paid',
      canReady:     order.status === 'processing',
      canComplete:  order.status === 'ready' && order.paymentType !== 'unpaid',
      canCancel:    order.status === 'processing' || order.status === 'ready',
      canMarkPaid:  order.status === 'ready' && order.paymentType === 'unpaid',
      canPrint:     true,  // 线下订单随时可补打小票
      completeLabel: '确认完成'
    };
  }

  // 线上订单
  const item = (order.items && order.items[0]) || {};
  return {
    canAccept:    order.status === 'paid',
    canWeigh:     order.status === 'accepted',
    canProcess:   order.status === 'weighed',
    canProcessDone: order.status === 'processing',
    canDeliver:   order.status === 'ready' && order.type === 'delivery',
    canPickup:    order.status === 'ready' && order.type === 'pickup',
    canComplete:  order.status === 'delivering',
    canCancel:    true,  // 详情页可取消
    canMarkPaid:  false,
    completeLabel: '配送完成'
  };
}

/**
 * 【已废弃】执行订单操作（旧云函数模式）
 * 各页面已改为直接调用 api.post('/merchant/orders/:orderNo/:action')
 * @deprecated
 */
// eslint-disable-next-line no-unused-vars
async function performOrderAction(orderNo, action, { callFunction, onSuccess }) {
  const labels = ACTION_LABELS;
  const title = labels[action] || '操作确认';

  return new Promise((resolve, reject) => {
    wx.showModal({
      title,
      content: `确定要${title}吗？`,
      success: async (res) => {
        if (!res.confirm) return resolve(false);
        try {
          await callFunction('updateOrderStatus', { orderNo, action });
          wx.showToast({ title: '操作成功', icon: 'success' });
          if (onSuccess) onSuccess();
          resolve(true);
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
          reject(err);
        }
      }
    });
  });
}

module.exports = {
  ACTION_LABELS,
  getOnlineOrderActions,
  getOfflineOrderActions,
  getDetailOrderActions,
  performOrderAction
};
