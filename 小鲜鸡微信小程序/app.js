const { STORAGE_KEYS } = require('./utils/auth');
const { QQ_MAP_KEY } = require('./utils/constants');
const { STORAGE_KEYS_API } = require('./utils/config');

App({
  globalData: {
    userInfo: null,
    role: '',
    merchantId: '',
    openid: '',
    phone: '',
    accessToken: '',
    cartVersion: 0,
    useMock: false,   // true=本地 mock 模式，false=真实 API
    isDev: false,     // 生产模式：真实微信支付 + 真实后端 API
    qqmapKey: QQ_MAP_KEY,
    apiBaseUrl: ''    // 默认空 → config.js 自动走 https://www.xuaioxianji.top
                      // 开发调试：若域名被墙，在 devtools 中改为 'http://159.75.0.194'
                      //           并勾选"不校验合法域名"
  },

  onLaunch() {
    // 恢复缓存的鉴权信息到 globalData（秒开用）
    const cachedOpenid = wx.getStorageSync(STORAGE_KEYS.openid);
    const cachedPhone = wx.getStorageSync(STORAGE_KEYS.phone);
    const cachedRole = wx.getStorageSync(STORAGE_KEYS.role);
    const cachedMerchantId = wx.getStorageSync(STORAGE_KEYS.merchantId);
    const cachedAccessToken = wx.getStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN);

    if (cachedOpenid) this.globalData.openid = cachedOpenid;
    if (cachedPhone) this.globalData.phone = cachedPhone;
    if (cachedRole) this.globalData.role = cachedRole;
    if (cachedMerchantId) this.globalData.merchantId = cachedMerchantId;
    if (cachedAccessToken) this.globalData.accessToken = cachedAccessToken;

    // 静默登录：获取 JWT token
    this.silentLogin();

    // 启动健康检查：确认服务器基础设施正常（延迟执行，不阻塞启动）
    setTimeout(() => this.healthCheck(), 3000);
  },

  /**
   * 启动时健康检查：验证服务器 MySQL/Redis/微信支付 状态
   * 仅在非 mock 模式下执行
   */
  async healthCheck() {
    if (this.globalData.useMock) return;
    try {
      const config = require('./utils/config');
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: config.API_BASE_URL + '/api/health',
          method: 'GET',
          timeout: 5000,
          success: (r) => resolve(r),
          fail: reject
        });
      });
      if (res.statusCode === 200 && res.data) {
        const h = res.data;
        console.log('[健康检查] 服务状态:', h.status, JSON.stringify(h.services));
        if (h.status === 'degraded') {
          const failed = Object.entries(h.services)
            .filter(([, v]) => v === 'error')
            .map(([k]) => k)
            .join('、');
          console.warn('[健康检查] ⚠️ 服务降级，不可用组件:', failed);
        }
      }
    } catch (_) {
      console.warn('[健康检查] 服务器不可达，请检查网络');
    }
  },

  /**
   * 静默登录：通过 wx.login 获取 code → POST /api/auth/wx-login → 得到 JWT token
   * 无感获取，不阻塞、不跳转、不弹窗
   */
  async silentLogin() {
    // Mock 模式：使用本地 mock 数据
    if (this.globalData.useMock) {
      const { getHttpMockResponse } = require('./utils/mock');
      const result = getHttpMockResponse('POST', '/auth/wx-login', {});
      if (result && result.success && result.data) {
        const d = result.data;
        this.globalData.openid = d.openid || '';
        this.globalData.accessToken = d.accessToken || '';
        if (d.phone) this.globalData.phone = d.phone;
        wx.setStorageSync(STORAGE_KEYS.openid, d.openid || '');
        wx.setStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN, d.accessToken || '');
        wx.setStorageSync(STORAGE_KEYS_API.REFRESH_TOKEN, d.refreshToken || '');
        if (d.phone) wx.setStorageSync(STORAGE_KEYS.phone, d.phone);
        console.log('[静默登录 mock] openid:', d.openid);
      }
      return;
    }

    // 如已有有效 token，跳过静默登录
    if (this.globalData.accessToken) {
      console.log('[静默登录] 已有 token，跳过');
      return;
    }

    // 真实 API 模式：wx.login → POST /api/auth/wx-login
    try {
      const code = await new Promise((resolve, reject) => {
        wx.login({
          success: (res) => resolve(res.code),
          fail: reject
        });
      });

      const config = require('./utils/config');
      const { REQUEST_TIMEOUT } = config;

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: config.API_BASE_URL + '/api/auth/wx-login',
          method: 'POST',
          data: { code },
          timeout: REQUEST_TIMEOUT,
          success: (r) => resolve(r),
          fail: reject
        });
      });

      if (res.statusCode === 200 && res.data && res.data.success) {
        const d = res.data.data;
        this.globalData.openid = d.openid || '';
        this.globalData.accessToken = d.accessToken || '';
        if (d.phone) this.globalData.phone = d.phone;

        wx.setStorageSync(STORAGE_KEYS.openid, d.openid || '');
        wx.setStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN, d.accessToken || '');
        wx.setStorageSync(STORAGE_KEYS_API.REFRESH_TOKEN, d.refreshToken || '');
        if (d.phone) wx.setStorageSync(STORAGE_KEYS.phone, d.phone);

        console.log('[静默登录] openid:', d.openid);
      } else {
        console.warn('[静默登录] 失败:', res.data && res.data.message || res.statusCode);
      }
    } catch (err) {
      console.warn('[静默登录] 网络错误（后端未部署时忽略）:', err.message || err);
    }
  }
});
