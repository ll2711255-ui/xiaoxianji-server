const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    policyChecked: true,
    submitting: false
  },

  /**
   * chooseAvatar 按钮回调 — 微信原生获取头像
   */
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ avatarUrl });
    }
  },

  /**
   * type="nickname" input 失焦回调 — 微信原生获取昵称
   */
  onNicknameBlur(e) {
    const nickName = e.detail.value;
    if (nickName) {
      this.setData({ nickName });
    }
  },

  /**
   * 登录确认 — wx.login → POST /api/auth/wx-login → 缓存 JWT → 进入首页
   */
  async onLoginConfirm() {
    const { avatarUrl, nickName, policyChecked } = this.data;

    if (!policyChecked) {
      wx.showToast({ title: '请先阅读并同意服务协议', icon: 'none' });
      return;
    }

    if (!avatarUrl || !nickName) {
      wx.showToast({ title: '请设置头像和昵称', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '登录中...', mask: true });

    try {
      // 1. 获取微信登录 code
      const code = await new Promise((resolve, reject) => {
        wx.login({
          success: (res) => resolve(res.code),
          fail: reject
        });
      });

      // 2. 上传头像（非 mock 模式）
      let finalAvatarUrl = avatarUrl;
      const app = getApp();
      if (!app.globalData.useMock && avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          const uploadedUrl = await api.upload('/upload/image', avatarUrl);
          if (uploadedUrl) finalAvatarUrl = uploadedUrl;
        } catch (uploadErr) {
          console.warn('头像上传失败，使用临时路径:', uploadErr);
        }
      }

      // 3. 调用 wx-login API（携带用户信息）
      const res = await api.post('/auth/wx-login', {
        code,
        nickName,
        avatarUrl: finalAvatarUrl
      }, true);

      if (res && res.success) {
        this.saveAndEnter(res.data);
      } else {
        throw new Error((res && res.message) || '登录失败');
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('登录失败:', err);

      // 降级方案：本地兜底，跳过 API 直接进入
      const app = getApp();
      if (!app.globalData.useMock) {
        this.saveAndEnter({
          openid: app.globalData.openid || '',
          nickName: this.data.nickName,
          avatarUrl: this.data.avatarUrl,
          accessToken: '',
          refreshToken: ''
        });
        return;
      }

      wx.showToast({ title: err.message || '登录失败，请重试', icon: 'none' });
    }
  },

  /**
   * 保存登录信息到本地缓存 → 进入首页
   */
  saveAndEnter(data) {
    wx.hideLoading();
    this.setData({ submitting: false });

    // 仅当有有效 token 时才保存
    if (!data.accessToken && !data.refreshToken) {
      console.warn('[login] 未获取到 token，跳过保存，使用本地兜底信息');
    }

    // 使用 auth 工具统一保存
    auth.saveLoginInfo({
      accessToken: data.accessToken || '',
      refreshToken: data.refreshToken || '',
      openid: data.openid || '',
      nickName: data.nickName || this.data.nickName,
      avatarUrl: data.avatarUrl || this.data.avatarUrl,
      phone: data.phone || '',
      role: data.role || 'customer'
    });

    // 跳转首页
    wx.redirectTo({ url: '/pages/index/index' });
  },

  /**
   * 微信手机号一键登录（兜底方式）
   */
  onWechatLogin(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') return;

    wx.showLoading({ title: '登录中...', mask: true });
    api.post('/auth/wx-phone', { code: e.detail.code }, true)
      .then(res => {
        wx.hideLoading();
        if (res && res.success) {
          const d = res.data;
          if (d.phone) {
            wx.setStorageSync('phone', d.phone);
            getApp().globalData.phone = d.phone;
          }
          wx.redirectTo({ url: '/pages/index/index' });
        } else {
          wx.showToast({ title: (res && res.message) || '登录失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('手机号登录失败:', err);
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      });
  },

  /**
   * 协议勾选
   */
  onTogglePolicy() {
    this.setData({ policyChecked: !this.data.policyChecked });
  }
});
