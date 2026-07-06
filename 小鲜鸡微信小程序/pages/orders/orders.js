const api = require('../../utils/api');
const { formatMoney, getStatusText } = require('../../utils/util');
const pay = require('../../utils/pay');

Page({
  data: {
    tabIndex: 0,
    tabs: ['全部', '进行中', '已完成'],
    orders: [],
    page: 1,
    hasMore: true,
    loading: false,

    // 手机号授权（支付前检查）
    showPhoneAuth: false,
    _pendingPayOrderNo: ''
  },

  onLoad(options) {
    // 从 mine 页订单快捷入口传入的 tab 参数
    if (options && options.tab) {
      const tabMap = { pending: 0, active: 1, completed: 2, all: 0 };
      const idx = tabMap[options.tab];
      if (idx !== undefined) {
        this.setData({ tabIndex: idx });
      }
    }
  },

  onShow() {
    this.loadOrders(true);
  },

  onPullDownRefresh() {
    this.loadOrders(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadOrders();
  },

  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.tabIndex) return;
    this.setData({ tabIndex: index });
    this.loadOrders(true);
  },

  async loadOrders(reset = false) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    try {
      let params = { page, pageSize: 10 };
      if (this.data.tabIndex === 1) {
        params.status = 'pending,paid,accepted,weighed,processing,delivering,ready';
      } else if (this.data.tabIndex === 2) {
        params.status = 'completed,cancelled';
      }

      const res = await api.get('/orders', params);
      const ordersList = (res && res.data && res.data.orders) || [];

      const orders = ordersList.map(order => ({
        ...order,
        prepayDisplay: formatMoney(order.prepayAmount || 0),
        actualDisplay: formatMoney(order.actualAmount || 0),
        refundDisplay: formatMoney(order.refundAmount || 0),
        statusText: getStatusText(order.status, order.type),
        statusClass: this.getStatusClass(order.status)
      }));

      this.setData({
        orders: reset ? orders : [...this.data.orders, ...orders],
        page: page + 1,
        hasMore: ordersList.length >= 10,
        loading: false
      });
    } catch (err) {
      console.error('加载订单失败:', err);
      this.setData({ loading: false });
    }
  },

  getStatusClass(status) {
    const map = {
      pending: 'tag-orange',
      paid: 'tag-green',
      accepted: 'tag-green',
      weighed: 'tag-green',
      processing: 'tag-green',
      delivering: 'tag-green',
      ready: 'tag-green',
      completed: 'tag-gray',
      cancelled: 'tag-red'
    };
    return map[status] || 'tag-gray';
  },

  onOrderTap(e) {
    const orderNo = e.currentTarget.dataset.orderNo;
    wx.navigateTo({ url: `/pages/orders/detail/detail?orderNo=${orderNo}` });
  },

  /**
   * 列表「去支付」按钮（pending 订单）
   */
  onPayOrder(e) {
    const orderNo = e.currentTarget.dataset.orderNo;

    // 检查手机号：未绑定则弹窗授权
    const phone = wx.getStorageSync('phone') || getApp().globalData.phone;
    if (!phone) {
      this.setData({ showPhoneAuth: true, _pendingPayOrderNo: orderNo });
      return;
    }

    this._doPayOrder(orderNo);
  },

  /** 执行支付（手机号已绑定后调用） */
  _doPayOrder(orderNo) {
    wx.showLoading({ title: '获取支付参数...' });
    api.post('/orders/' + orderNo + '/pay')
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

        // 查找订单金额用于展示
        const order = this.data.orders.find(o => o.orderNo === orderNo);
        const amountDisplay = order ? order.prepayDisplay : '0.00';

        pay.callWxPay({
          orderNo,
          payment,
          amountDisplay,
          onSuccess: () => this.loadOrders(true),
          onCancel: () => this.loadOrders(true)
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取支付参数失败:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
  },

  /**
   * 列表「取消订单」按钮
   */
  onCancelOrderItem(e) {
    const orderNo = e.currentTarget.dataset.orderNo;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？退款将原路退回，1-7个工作日到账。',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '取消中...' });
        try {
          const result = await api.post('/orders/' + orderNo + '/cancel');
          wx.hideLoading();
          if (result && result.success) {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadOrders(true);
          } else {
            wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('取消失败:', err);
          wx.showToast({ title: '取消失败，请重试', icon: 'none' });
        }
      }
    });
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/' + key + '/' + key });
  },

  // ========== 手机号授权（支付前） ==========

  /**
   * 授权成功后自动继续支付
   */
  onGetPhoneForOrder(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      wx.showLoading({ title: '授权中...' });
      api.post('/auth/wx-phone', {
        phoneCode: e.detail.code
      }).then(res => {
        wx.hideLoading();
        const d = (res && res.data) || res;
        if (d.phone) {
          wx.setStorageSync('phone', d.phone);
          getApp().globalData.phone = d.phone;
          this.setData({ showPhoneAuth: false });
          wx.showToast({ title: '已绑定', icon: 'success', duration: 1000 });
          // 授权成功后继续支付
          setTimeout(() => {
            this._doPayOrder(this.data._pendingPayOrderNo);
          }, 1100);
        } else {
          wx.showToast({ title: (res && res.message) || '授权失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('手机号授权失败:', err);
        wx.showToast({ title: '授权失败，请重试', icon: 'none' });
      });
    }
  },

  onCancelPhoneAuth() {
    this.setData({ showPhoneAuth: false, _pendingPayOrderNo: '' });
  }
});
