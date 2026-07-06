const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    merchantName: '小鲜鸡商家',
    pendingCount: 0,
    activeCount: 0,
    loading: true
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.loadStats();
  },

  async loadStats() {
    this.setData({ loading: true });
    try {
      const [paidRes, activeRes] = await Promise.all([
        api.get('/merchant/orders', { status: 'paid', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'accepted', pageSize: 200, type: 'online' })
      ]);
      this.setData({
        pendingCount: ((paidRes && paidRes.data && paidRes.data.orders) || []).length,
        activeCount: ((activeRes && activeRes.data && activeRes.data.orders) || []).length,
        loading: false
      });
    } catch (err) {
      console.error('加载统计数据失败:', err);
      this.setData({ loading: false });
    }
  },

  onGoOrders() {
    wx.navigateTo({ url: '/pages/merchant/orders/orders' });
  },

  onGoNumbers() {
    wx.navigateTo({ url: '/pages/merchant/numbers/numbers' });
  },

  onGoOffline() {
    wx.navigateTo({ url: '/pages/merchant/offline/offline' });
  },

  onLogout() {
    wx.showModal({
      title: '退出商家模式',
      content: '确定要退出吗？退出后需重新登录。',
      success: (res) => {
        if (res.confirm) {
          auth.clearAuth();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
