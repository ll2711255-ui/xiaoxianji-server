const api = require('../../../utils/api');

Page({
  data: {
    isEdit: false,
    addressId: '',
    name: '',
    phone: '',
    region: ['广东省', '广州市', '天河区'],
    detail: '',
    isDefault: false,
    saving: false
  },

  onLoad(options) {
    if (options.mode === 'edit') {
      const addr = wx.getStorageSync('_editingAddress');
      if (addr) {
        wx.removeStorageSync('_editingAddress');
        this.setData({
          isEdit: true,
          addressId: addr._id,
          name: addr.name || '',
          phone: addr.phone || '',
          region: [addr.province || '广东省', addr.city || '广州市', addr.district || '天河区'],
          detail: addr.detail || '',
          isDefault: !!addr.isDefault
        });
        wx.setNavigationBarTitle({ title: '编辑地址' });
      }
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (field) { this.setData({ [field]: e.detail.value }); }
  },

  onRegionChange(e) {
    this.setData({ region: e.detail.value });
  },

  onSwitchChange(e) {
    this.setData({ isDefault: e.detail.value });
  },

  async onSave() {
    const { name, phone, region, detail, isDefault, isEdit, addressId } = this.data;

    if (!name.trim()) { wx.showToast({ title: '请输入收货人姓名', icon: 'none' }); return; }
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) { wx.showToast({ title: '请输入正确的手机号', icon: 'none' }); return; }
    if (!detail.trim()) { wx.showToast({ title: '请输入详细地址', icon: 'none' }); return; }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      province: region[0],
      city: region[1],
      district: region[2],
      detail: detail.trim(),
      isDefault
    };

    try {
      if (isEdit) {
        payload.addressId = addressId;
        await api.put('/addresses/' + addressId, payload);
      } else {
        await api.post('/addresses', payload);
      }

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ saving: false });

      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.loadAddresses) {
        prevPage.loadAddresses();
      }

      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.hideLoading();
      this.setData({ saving: false });
      console.error('保存地址失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  async onDelete() {
    const { addressId } = this.data;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.del('/addresses/' + addressId);
            wx.showToast({ title: '已删除', icon: 'success' });

            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.loadAddresses) {
              prevPage.loadAddresses();
            }

            setTimeout(() => wx.navigateBack(), 800);
          } catch (err) {
            console.error('删除地址失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
});
