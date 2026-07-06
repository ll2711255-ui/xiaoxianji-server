const { STORAGE_KEYS } = require('../../utils/auth');
const api = require('../../utils/api');

Page({
  data: {
    phone: '',
    password: '',
    submitting: false
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async onSubmit() {
    const { phone, password } = this.data;

    if (!phone || phone.length < 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      // POST /api/auth/merchant-login（skipAuth=true，因为尚未登录）
      const res = await api.post('/auth/merchant-login', { phone, password }, true);

      this.setData({ submitting: false });

      if (res && res.success) {
        const d = res.data;

        // 保存 JWT token + 角色信息
        wx.setStorageSync(STORAGE_KEYS.role, d.role);
        wx.setStorageSync(STORAGE_KEYS.merchantId, d.merchantId);
        if (d.userInfo) {
          wx.setStorageSync(STORAGE_KEYS.userInfo, d.userInfo);
        }

        // 保存 access_token（后续请求自动携带）
        if (d.accessToken) {
          api.saveTokens(d.accessToken, d.refreshToken);
        }

        const app = getApp();
        if (app && app.globalData) {
          app.globalData.role = d.role;
          app.globalData.merchantId = d.merchantId;
          app.globalData.userInfo = d.userInfo;
          app.globalData.accessToken = d.accessToken || '';
        }

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/merchant/orders/orders' });
        }, 1800);
      } else {
        wx.showToast({ title: (res && res.message) || '账号或密码错误', icon: 'none' });
      }
    } catch (err) {
      this.setData({ submitting: false });
      console.error('商家登录失败:', err);
      wx.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  }
});
