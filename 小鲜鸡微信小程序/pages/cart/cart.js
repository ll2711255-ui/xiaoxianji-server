const { formatMoney } = require('../../utils/util');

Page({
  data: {
    cartItems: [],
    checkedTotalDisplay: '0.00',
    allChecked: false,
    checkedCount: 0,
    isEmpty: true
  },

  onShow() {
    this.loadCart();
  },

  loadCart() {
    const cart = wx.getStorageSync('cart') || [];
    const items = cart.map((item, index) => ({
      ...item,
      // 兜底：旧数据可能没有 cartKey / checked
      cartKey: item.cartKey || `${item.productId}_${item.spec?.type || ''}_${item.spec?.weight || ''}_${item.spec?.processing || ''}_${item.spec?.delivery || ''}_${index}`,
      checked: item.checked !== false,
      priceDisplay: formatMoney(item.price),
      subtotalDisplay: formatMoney(item.price * item.quantity)
    }));

    const checkedItems = items.filter(i => i.checked);
    const checkedTotal = checkedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const allChecked = items.length > 0 && checkedItems.length === items.length;

    this.setData({
      cartItems: items,
      checkedTotalDisplay: formatMoney(checkedTotal),
      allChecked,
      checkedCount: checkedItems.length,
      isEmpty: items.length === 0
    });
  },

  // 切换单个商品勾选
  onCheckItem(e) {
    const index = e.currentTarget.dataset.index;
    const checked = !!e.detail.value;
    const cart = wx.getStorageSync('cart') || [];

    if (index < 0 || index >= cart.length) return;

    cart[index].checked = checked;
    wx.setStorageSync('cart', cart);
    this.loadCart();
  },

  // 全选 / 取消全选
  onCheckAll(e) {
    const checked = !!e.detail.value;
    const cart = wx.getStorageSync('cart') || [];

    cart.forEach(item => { item.checked = checked; });
    wx.setStorageSync('cart', cart);
    this.loadCart();
  },

  // 数量变更
  onQuantityChange(e) {
    const index = e.currentTarget.dataset.index;
    const delta = parseInt(e.currentTarget.dataset.delta);
    const cart = wx.getStorageSync('cart') || [];

    if (index < 0 || index >= cart.length) return;

    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }

    wx.setStorageSync('cart', cart);
    const app = getApp();
    app.globalData.cartVersion = Date.now();
    this.loadCart();
  },

  // 删除商品
  onDeleteItem(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          const cart = wx.getStorageSync('cart') || [];
          cart.splice(index, 1);
          wx.setStorageSync('cart', cart);
          const app = getApp();
          app.globalData.cartVersion = Date.now();
          this.loadCart();
        }
      }
    });
  },

  // 去结算 — 只传勾选的商品
  onCheckout() {
    const checkedItems = this.data.cartItems.filter(i => i.checked);
    if (checkedItems.length === 0) {
      wx.showToast({ title: '请至少勾选一件商品', icon: 'none' });
      return;
    }
    // 将勾选商品写入 checkoutItems，结算页读取此 key
    wx.setStorageSync('checkoutItems', checkedItems);
    wx.navigateTo({ url: '/pages/checkout/checkout?from=cart' });
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/' + key + '/' + key });
  }
});
