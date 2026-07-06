const api = require('../../../utils/api');

Page({
  data: {
    addresses: [],
    selectMode: false
  },

  onLoad(options) {
    if (options.select === 'true') {
      this.setData({ selectMode: true });
    }
  },

  onShow() {
    this.loadAddresses();
  },

  async loadAddresses() {
    try {
      const res = await api.get('/addresses');
      this.setData({ addresses: (res && res.data && res.data.addresses) || [] });
    } catch (err) {
      console.error('加载地址失败:', err);
    }
  },

  onManualAdd() {
    wx.navigateTo({ url: '/pages/mine/address/form' });
  },

  onEditAddress(e) {
    const id = e.currentTarget.dataset.id;
    const address = this.data.addresses.find(a => a._id === id);
    if (!address) return;

    wx.setStorageSync('_editingAddress', address);
    wx.navigateTo({ url: '/pages/mine/address/form?mode=edit' });
  },

  async onSetDefault(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.put('/addresses/' + id, { isDefault: true });
      this.loadAddresses();
      wx.showToast({ title: '已设为默认地址', icon: 'success' });
    } catch (err) {
      console.error('设置默认地址失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async onDeleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.del('/addresses/' + id);
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadAddresses();
          } catch (err) {
            console.error('删除地址失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onAddressLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const address = this.data.addresses.find(a => a._id === id);
    if (!address) return;

    const itemList = address.isDefault
      ? ['编辑地址', '删除地址']
      : ['设为默认', '编辑地址', '删除地址'];

    wx.showActionSheet({
      itemList,
      success: async (res) => {
        if (address.isDefault) {
          if (res.tapIndex === 0) this.onEditAddress(e);
          else if (res.tapIndex === 1) this.onDeleteAddress(e);
        } else {
          if (res.tapIndex === 0) this.onSetDefault(e);
          else if (res.tapIndex === 1) this.onEditAddress(e);
          else if (res.tapIndex === 2) this.onDeleteAddress(e);
        }
      }
    });
  },

  onSelectAddress(e) {
    if (!this.data.selectMode) return;
    const id = e.currentTarget.dataset.id;
    const address = this.data.addresses.find(a => a._id === id);
    if (address) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({ address });
      }
      wx.navigateBack();
    }
  }
});
