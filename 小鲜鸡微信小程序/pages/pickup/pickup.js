const api = require('../../utils/api');

Page({
  data: {
    orderNo: '',
    token: '',
    status: '',
    cardNumber: '',
    orderDisplay: '',

    isInvalid: false,
    isLoading: true,
    isCompleted: false,
    isOffline: false,

    pollingTimer: null,
    pollFailCount: 0,
    maxPollFails: 3,
    showRefreshBtn: false
  },

  onLoad(options) {
    const orderNo = options.orderNo || '';
    const token = options.token || '';

    if (!orderNo || !token) {
      this.setData({ isInvalid: true, isLoading: false });
      return;
    }

    this.setData({ orderNo, token });

    const cached = wx.getStorageSync('pickup_' + orderNo);
    if (cached) {
      this.applyStatus(cached);
    }

    this.checkStatus();
    this.startPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    const timer = setInterval(() => {
      this.checkStatus();
    }, 5000);
    this.setData({ pollingTimer: timer });
  },

  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  async checkStatus() {
    const { orderNo, token } = this.data;
    if (!orderNo || !token) return;

    try {
      const res = await api.get('/pickup/status/' + orderNo, { token });
      const d = (res && res.data) || res || {};

      if (d.valid === false) {
        this.setData({ isInvalid: true, isLoading: false });
        this.stopPolling();
        return;
      }

      wx.setStorageSync('pickup_' + orderNo, d);

      this.applyStatus(d);
      this.setData({ pollFailCount: 0, isOffline: false, showRefreshBtn: false });

      if (d.status === 'completed' || d.status === 'done') {
        this.stopPolling();
      }
    } catch (err) {
      console.error('查询取货状态失败:', err);
      const fails = this.data.pollFailCount + 1;
      const isOffline = fails >= 1;
      const showRefreshBtn = fails >= this.data.maxPollFails;

      this.setData({ pollFailCount: fails, isOffline, showRefreshBtn, isLoading: false });

      if (showRefreshBtn) {
        this.stopPolling();
      }
    }
  },

  applyStatus(data) {
    this.setData({
      status: data.status,
      cardNumber: data.cardNumber || '',
      orderDisplay: data.orderNo || this.data.orderNo,
      isInvalid: data.status === 'invalid',
      isLoading: false,
      isCompleted: data.status === 'completed' || data.status === 'done'
    });
  },

  onRefresh() {
    this.setData({ pollFailCount: 0, showRefreshBtn: false, isOffline: false, isLoading: true });
    this.checkStatus();
    this.startPolling();
  }
});
