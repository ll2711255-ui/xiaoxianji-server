const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    // ---- 用户信息 ----
    avatarUrl: '',
    nickName: '',
    phone: '',
    maskedPhone: '',
    hasLogin: false,
    isLoggedIn: false,

    // ---- 登录弹窗 ----
    showLoginModal: false,
    agreedProtocol: false,
    showAgreementTip: false,

    // ---- 进行中订单角标数 ----
    ongoingCount: 0,

    // ---- 商家端入口 ----
    isMerchant: false,

    // ---- 其他状态 ----
    notificationEnabled: false,
    appVersion: '',
    isDev: false
  },

  onShow() {
    this.loadUserInfo();
    this.fetchOngoingCount();
  },

  // ====================================================================
  // 用户信息加载
  // ====================================================================

  loadUserInfo() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    const phone = wx.getStorageSync(auth.STORAGE_KEYS.phone) || app.globalData.phone || '';

    const role = wx.getStorageSync(auth.STORAGE_KEYS.role) || app.globalData.role || wx.getStorageSync('merchant_role') || '';
    const isMerchant = role === 'merchant' || role === 'admin';

    const avatarUrl = userInfo.avatarUrl || '';
    const nickName = userInfo.nickName || '';
    const maskedPhone = phone ? this.formatPhone(phone) : '';
    const hasLogin = !!(nickName || phone);
    const isLoggedIn = !!phone;

    this.setData({ avatarUrl, nickName, phone, maskedPhone, hasLogin, isLoggedIn, isMerchant });
  },

  formatPhone(p) {
    if (!p || p.length < 8) return p || '';
    return p.slice(0, 3) + '****' + p.slice(7);
  },

  // ====================================================================
  // 进行中订单数量
  // ====================================================================

  async fetchOngoingCount() {
    try {
      const res = await api.get('/orders', {
        status: 'pending,paid,accepted,weighed,processing,delivering,ready',
        pageSize: 99
      });
      const orders = (res && res.data && res.data.orders) || [];
      const count = (res && res.data && res.data.total !== undefined) ? res.data.total : orders.length;
      this.setData({ ongoingCount: count });
    } catch (err) {
      console.error('[mine] 获取进行中订单数失败:', err);
    }
  },

  // ====================================================================
  // 登录弹窗
  // ====================================================================

  onShowLoginModal() {
    this.setData({ showLoginModal: true, agreedProtocol: false, showAgreementTip: false });
  },

  onMaskTap() {
    this.setData({ showLoginModal: false });
  },

  stopPropagation() {},

  onCloseModal() {
    this.setData({ showLoginModal: false });
  },

  onToggleAgreement() {
    this.setData({ agreedProtocol: !this.data.agreedProtocol, showAgreementTip: false });
  },

  onViewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '小鲜鸡重视您的隐私。我们仅在您授权后获取手机号用于订单服务，不会向第三方泄露您的个人信息。',
      showCancel: false
    });
  },

  onViewService() {
    wx.showModal({
      title: '服务协议',
      content: '使用小鲜鸡服务即表示您同意遵守平台规则，包括但不限于订单、配送、售后等相关条款。',
      showCancel: false
    });
  },

  /**
   * 手机号一键登录 — open-type="getPhoneNumber" 回调
   */
  onGetPhoneNumber(e) {
    if (!this.data.agreedProtocol) {
      this.setData({ showAgreementTip: true });
      return;
    }

    const app = getApp();

    // 模拟器兜底：getPhoneNumber 在开发者工具中无 code
    if (!e.detail.code) {
      this.handleLoginSuccess('13800008888', 'mock_openid');
      return;
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '授权已取消', icon: 'none' });
      return;
    }

    // 真机：调用 REST API 解密手机号
    wx.showLoading({ title: '登录中...', mask: true });
    api.post('/auth/wx-phone', { phoneCode: e.detail.code }, true)
      .then(res => {
        wx.hideLoading();
        const d = (res && res.data) || res || {};
        if (d.phone) {
          this.handleLoginSuccess(d.phone, d.openid || '');
        } else {
          wx.showToast({ title: (res && res.message) || '登录失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('[mine] 手机号登录失败:', err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
  },

  handleLoginSuccess(phone, openid) {
    const app = getApp();
    app.globalData.phone = phone;
    if (openid && openid !== 'mock_openid') {
      app.globalData.openid = openid;
    }
    wx.setStorageSync(auth.STORAGE_KEYS.phone, phone);
    if (openid && openid !== 'mock_openid') {
      wx.setStorageSync(auth.STORAGE_KEYS.openid, openid);
    }

    this.setData({
      phone, maskedPhone: this.formatPhone(phone),
      hasLogin: true, isLoggedIn: true,
      showLoginModal: false, agreedProtocol: false, showAgreementTip: false
    });

    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  // ====================================================================
  // 头像 & 昵称（微信原生组件）
  // ====================================================================

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (!avatarUrl) return;

    const userInfo = { nickName: this.data.nickName, avatarUrl };
    wx.setStorageSync('userInfo', userInfo);
    if (getApp().globalData) {
      getApp().globalData.userInfo = userInfo;
    }
    this.setData({ avatarUrl, hasLogin: true });

    // 上传至自建后端
    const app = getApp();
    if (!app.globalData.useMock) {
      api.upload('/upload/image', avatarUrl)
        .then(url => {
          const updated = { nickName: this.data.nickName, avatarUrl: url };
          wx.setStorageSync('userInfo', updated);
          if (getApp().globalData) getApp().globalData.userInfo = updated;
          this.setData({ avatarUrl: url });
        })
        .catch(err => {
          console.error('[mine] 头像上传失败:', err);
        });
    }
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value;
    if (!nickName) return;

    const userInfo = wx.getStorageSync('userInfo') || {};
    userInfo.nickName = nickName;
    wx.setStorageSync('userInfo', userInfo);
    if (getApp().globalData) getApp().globalData.userInfo = userInfo;
    this.setData({ nickName, hasLogin: true });
  },

  // ====================================================================
  // 订单快捷入口
  // ====================================================================

  onOrderTap(e) {
    const tab = e.currentTarget.dataset.tab;
    wx.navigateTo({ url: '/pages/orders/orders?tab=' + tab });
  },

  // ====================================================================
  // 功能列表
  // ====================================================================

  onAddressManage() {
    wx.navigateTo({ url: '/pages/mine/address/address' });
  },

  onScanPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: (res) => {
        const params = {};
        const parts = res.result.split('&');
        parts.forEach(part => {
          const [key, value] = part.split('=');
          if (key && value) params[key] = value;
        });

        if (params.orderNo && params.token) {
          wx.navigateTo({
            url: '/pages/pickup/pickup?orderNo=' + params.orderNo + '&token=' + params.token
          });
        } else {
          wx.showToast({ title: '无效的取货码', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码已取消', icon: 'none' });
      }
    });
  },

  // ====================================================================
  // 商家端入口
  // ====================================================================

  onMerchantEntry() {
    if (this.data.isMerchant) {
      wx.navigateTo({ url: '/pages/merchant/orders/orders' });
    } else {
      wx.navigateTo({ url: '/pages/merchantLogin/merchantLogin' });
    }
  },

  // ====================================================================
  // 其他列表
  // ====================================================================

  onContactService() {
    wx.makePhoneCall({
      phoneNumber: '4000000000',
      fail: () => { wx.showToast({ title: '拨号失败', icon: 'none' }); }
    });
  },

  onAbout() {
    const version = this.data.appVersion || '1.0.0';
    wx.showModal({
      title: '小鲜鸡', content: '新鲜鸡肉，品质保证\n版本 ' + version, showCancel: false
    });
  },

  /**
   * 清除模拟订单数据（仅开发模式可见）
   */
  onClearMockData() {
    wx.showModal({
      title: '清除模拟数据',
      content: '将清除所有模拟创建的订单，恢复为初始种子数据。确定继续？',
      confirmText: '确认清除',
      confirmColor: '#A83108',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const result = await api.post('/dev/clear-mock-orders');
          wx.showToast({ title: (result && result.message) || '已清除', icon: 'success', duration: 2000 });
        } catch (err) {
          console.error('清除模拟数据失败:', err);
          wx.showToast({ title: '清除失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 清除全部测试数据（仅开发模式可见）
   */
  onClearTestData() {
    wx.showModal({
      title: '清除全部测试数据',
      content: '将清空所有订单（含线上+线下），重置全部号码牌为 idle 状态。此操作不可恢复，确定继续？',
      confirmText: '确认清除全部',
      confirmColor: '#A83108',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const result = await api.post('/dev/clear-test-data');
          wx.showToast({ title: (result && result.message) || '已清除', icon: 'success', duration: 2500 });
        } catch (err) {
          console.error('清除测试数据失败:', err);
          wx.showToast({ title: '清除失败', icon: 'none' });
        }
      }
    });
  },

  // ====================================================================
  // 退出登录
  // ====================================================================

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新授权登录，确定要退出吗？',
      success: (res) => {
        if (!res.confirm) return;

        auth.clearAuth();
        wx.removeStorageSync('merchant_role');

        this.setData({
          avatarUrl: '', nickName: '', phone: '', maskedPhone: '',
          hasLogin: false, isLoggedIn: false, isMerchant: false, ongoingCount: 0
        });

        wx.showToast({ title: '已退出', icon: 'success' });
      }
    });
  },

  // ====================================================================
  // TabBar
  // ====================================================================

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/' + key + '/' + key });
  },

  // ====================================================================
  // 生命周期
  // ====================================================================

  onLoad() {
    let version = '1.0.0';
    try {
      const accountInfo = wx.getAccountInfoSync();
      if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) {
        version = accountInfo.miniProgram.version;
      }
    } catch (_) {}
    const app = getApp();
    const isDev = app && app.globalData && app.globalData.isDev;
    this.setData({ appVersion: version, isDev });
  }
});
