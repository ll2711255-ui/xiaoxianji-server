const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    numbers: [],
    loading: true
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.loadNumbers();
  },

  async loadNumbers() {
    this.setData({ loading: true });
    try {
      const res = await api.get('/pai-numbers');
      this.setData({ numbers: (res && res.data && res.data.numbers) || [], loading: false });
    } catch (err) {
      console.error('加载号码牌失败:', err);
      this.setData({ loading: false });
    }
  },

  onCardTap(e) {
    const number = e.currentTarget.dataset.number;
    const card = this.data.numbers.find(c => c.number === number);
    if (!card) return;

    if (card.status === 'in_use') {
      wx.showActionSheet({
        itemList: ['释放该号码牌'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            wx.showModal({
              title: '强制释放',
              content: `确定要释放 ${number} 号牌吗？该操作不会影响已关联的订单。`,
              success: async (modalRes) => {
                if (!modalRes.confirm) return;
                try {
                  await api.post('/pai-numbers/' + number + '/release');
                  wx.showToast({ title: '已释放', icon: 'success' });
                  this.loadNumbers();
                } catch (err) {
                  wx.showToast({ title: '释放失败', icon: 'none' });
                }
              }
            });
          }
        }
      });
    }
  },

  onRefresh() {
    this.loadNumbers();
  }
});
