const api = require('../../../utils/api');
const { formatMoney, getStatusText, getRefundStatusText, getRefundStatusClass, formatWeight } = require('../../../utils/util');
const QQMapWX = require('../../../utils/qqmap-wx-jssdk');

// 初始化腾讯地图 SDK
let qqmap = null;
function getQQMap() {
  if (!qqmap) {
    const key = getApp().globalData.qqmapKey;
    if (key) {
      qqmap = new QQMapWX({ key });
    }
  }
  return qqmap;
}

Page({
  data: {
    order: null,
    orderNo: '',

    // 格式化后的展示数据
    prepayDisplay: '0.00',
    actualDisplay: '0.00',
    refundDisplay: '0.00',
    statusText: '',
    refundStatusText: '',
    refundStatusClass: '',

    // 称重信息
    weighInfo: null,

    // 取消按钮是否显示
    showCancelBtn: false,

    // 定时刷新
    pollingTimer: null
  },

  onLoad(options) {
    const orderNo = options.orderNo;
    if (!orderNo) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      return;
    }
    this.setData({ orderNo });
  },

  onShow() {
    this.loadOrder();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    const timer = setInterval(() => {
      this.loadOrder(true);
    }, 10000); // 10秒轮询
    this.setData({ pollingTimer: timer });
  },

  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  pollFailCount: 0,

  async loadOrder(silent = false) {
    if (!this.data.orderNo) return;

    try {
      const res = await api.get('/orders/' + this.data.orderNo);
      const d = (res && res.data) || res || {};
      const order = d.order;
      if (!order) return;

      this.pollFailCount = 0;

      // 预处理 items 中的格式化显示字段
      if (order.items && order.items.length > 0) {
        order.items = order.items.map(item => ({
          ...item,
          unitPriceDisplay: item.unitPrice ? formatMoney(item.unitPrice) : '--'
        }));
      }

      // 预处理重量显示
      order.actualWeightDisplay = order.actualWeight ? (order.actualWeight / 500).toFixed(2) : '';

      // 处理 weighInfo（优先）或兼容旧字段
      let weighInfo = null;
      if (order.weighInfo) {
        weighInfo = {
          ...order.weighInfo,
          actualWeightDisplay: order.weighInfo.actualWeight + '克（' + order.weighInfo.actualWeightJin + '斤）',
          actualAmountDisplay: formatMoney(order.weighInfo.actualAmount || 0),
          refundAmountDisplay: formatMoney(order.weighInfo.refundAmount || 0)
        };
      } else if (order.actualWeight) {
        weighInfo = {
          actualWeight: order.actualWeight || 0,
          actualWeightJin: ((order.actualWeight || 0) / 500).toFixed(2),
          actualWeightDisplay: (order.actualWeight || 0) + '克（' + ((order.actualWeight || 0) / 500).toFixed(2) + '斤）',
          actualAmount: order.actualAmount || 0,
          actualAmountDisplay: formatMoney(order.actualAmount || 0),
          refundAmount: order.refundAmount || 0,
          refundAmountDisplay: formatMoney(order.refundAmount || 0),
          weighPhoto: order.weighPhoto || ''
        };
      }

      // 处理 refundInfo（优先）或兼容旧 refundStatus
      let refundInfo = null;
      if (order.refundInfo) {
        refundInfo = {
          ...order.refundInfo,
          refundAmountDisplay: formatMoney(order.refundInfo.refundAmount || 0),
          statusText: getRefundStatusText(order.refundInfo.status || 'none'),
          statusClass: getRefundStatusClass(order.refundInfo.status || 'none')
        };
      }

      // 计算取消按钮是否显示
      const showCancelBtn = this.canCancel(order);

      this.setData({
        order,
        prepayDisplay: formatMoney(order.prepayAmount || 0),
        actualDisplay: formatMoney(order.actualAmount || 0),
        refundDisplay: formatMoney(order.refundAmount || 0),
        statusText: getStatusText(order.status, order.type),
        refundStatusText: getRefundStatusText(
          (refundInfo && refundInfo.status) || order.refundStatus || 'none'
        ),
        refundStatusClass: getRefundStatusClass(
          (refundInfo && refundInfo.status) || order.refundStatus || 'none'
        ),
        weighInfo,
        showCancelBtn
      });

      // 终端态订单停止轮询
      if (order.status === 'completed' || order.status === 'cancelled') {
        this.stopPolling();
      }
    } catch (err) {
      if (!silent) {
        console.error('加载订单详情失败:', err);
      }
      this.pollFailCount++;
      if (this.pollFailCount >= 3) {
        this.stopPolling();
        wx.showToast({ title: '网络不稳定，请手动刷新', icon: 'none', duration: 2000 });
      }
    }
  },

  /**
   * 判断是否可取消订单
   */
  canCancel(order) {
    if (order.status === 'cancelled' || order.status === 'completed') return false;

    const items = order.items || [];
    if (items.length === 0) return false;

    const hasOnlyExactWeight = items.every(i => i.pricingType === 'exact_weight');

    if (hasOnlyExactWeight) {
      return ['pending', 'paid', 'accepted', 'weighed'].includes(order.status);
    }
    return ['pending', 'paid'].includes(order.status);
  },

  onCancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？退款将原路退回，1-7个工作日到账。',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '取消中...' });
        try {
          const result = await api.post('/orders/' + this.data.orderNo + '/cancel');
          wx.hideLoading();
          if (result && result.success) {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadOrder();
          } else {
            wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('取消失败:', err);
          wx.showToast({ title: err.message || '取消失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 点击地址 → 腾讯地图地理编码 + 导航
   */
  navigateToAddress() {
    const { order } = this.data;
    if (!order || !order.deliveryAddress) return;

    const addr = order.deliveryAddress;
    const addressStr = (addr.province || '') + (addr.city || '') + (addr.district || '') + ' ' + (addr.detail || '');

    if (!addressStr.trim()) {
      wx.showToast({ title: '暂无收货地址', icon: 'none' });
      return;
    }

    const map = getQQMap();
    if (!map) {
      wx.showToast({ title: '地址解析失败，请手动导航', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '解析地址中...' });

    map.geocoder({
      address: addressStr.trim(),
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.location) {
          wx.openLocation({
            latitude: res.result.location.lat,
            longitude: res.result.location.lng,
            name: '收货地址',
            address: addressStr.trim(),
            scale: 16
          });
        } else {
          wx.showToast({ title: '地址解析失败，请手动导航', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '地址解析失败，请手动导航', icon: 'none' });
      }
    });
  },

  /**
   * 点击电话 → 确认后一键拨号
   */
  callPhone() {
    const { order } = this.data;
    if (!order) return;

    const phone = order.contactPhone || (order.deliveryAddress && order.deliveryAddress.phone) || '';

    if (!phone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '拨打电话',
      content: '是否拨打 ' + phone + '？',
      confirmText: '拨打',
      confirmColor: '#1DB96A',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: phone,
            fail: () => {
              wx.showToast({ title: '拨号失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  /**
   * 重新发起支付（pending 订单）
   */
  onRetryPayment() {
    wx.showLoading({ title: '获取支付参数...' });
    api.post('/orders/' + this.data.orderNo + '/pay')
      .then(res => {
        wx.hideLoading();
        const d = (res && res.data) || res || {};
        if (!d.success && d.message) {
          wx.showToast({ title: d.message, icon: 'none' });
          return;
        }
        const payment = d.payment;
        if (!payment) {
          wx.showToast({ title: '支付暂不可用', icon: 'none' });
          return;
        }

        const app = getApp();
        const isDev = app && app.globalData && app.globalData.isDev;
        if (isDev) {
          wx.showLoading({ title: '模拟支付中...' });
          api.post('/orders/' + this.data.orderNo + '/pay', { mockPay: true })
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '支付成功(模拟)', icon: 'success' });
              this.loadOrder();
            })
            .catch(() => {
              wx.hideLoading();
              wx.showToast({ title: '模拟支付失败', icon: 'none' });
            });
          return;
        }

        const ts = typeof payment.timeStamp === 'number'
          ? String(payment.timeStamp)
          : (payment.timeStamp || '');

        wx.requestPayment({
          timeStamp: ts,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'RSA',
          paySign: payment.paySign,
          success: () => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => this.loadOrder(), 1500);
          },
          fail: (err) => {
            if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
              wx.showToast({ title: '支付已取消', icon: 'none' });
            } else {
              console.error('支付失败:', err);
              wx.showToast({ title: '支付失败，请重试', icon: 'none' });
            }
          }
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取支付参数失败:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
  },

  onRefresh() {
    this.pollFailCount = 0;
    this.loadOrder();
  },

  onPreviewWeighPhoto() {
    const photo = (this.data.weighInfo && this.data.weighInfo.weighPhoto) ||
                  (this.data.order && this.data.order.weighPhoto);
    if (photo) {
      wx.previewImage({ urls: [photo], current: photo });
    }
  }
});
