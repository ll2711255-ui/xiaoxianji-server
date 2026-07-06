/**
 * HTTP API 请求封装（JWT 鉴权 + 自动刷新 + Mock 降级）
 *
 * 使用方式：
 *   const api = require('../../utils/api');
 *   const products = await api.get('/products');
 *   const result = await api.post('/orders', { ... });
 *   const url = await api.upload('/upload/image', filePath);
 *
 * 特性：
 *   - 自动附加 Authorization: Bearer <access_token>
 *   - 401 时自动用 refresh_token 换新 token，重放原请求
 *   - 并发刷新保护（同一时刻只有一个刷新请求）
 *   - Mock 模式下走本地 mock 数据，不发起真实网络请求
 *   - 请求超时 15 秒
 */

const config = require('./config');
const { REQUEST_TIMEOUT, STORAGE_KEYS_API } = config;
// ⚠️ API_BASE_URL 是 getter，不能解构（解构会立即求值固化），必须通过 config.API_BASE_URL 访问

// ========== Token 管理 ==========

/** 是否正在刷新 token（并发锁） */
let _refreshing = false;
/** 等待刷新完成的请求队列 */
let _refreshQueue = [];

function getAccessToken() {
  return wx.getStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN) || '';
}

function getRefreshToken() {
  return wx.getStorageSync(STORAGE_KEYS_API.REFRESH_TOKEN) || '';
}

function saveTokens(accessToken, refreshToken) {
  wx.setStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    wx.setStorageSync(STORAGE_KEYS_API.REFRESH_TOKEN, refreshToken);
  }
}

function clearTokens() {
  wx.removeStorageSync(STORAGE_KEYS_API.ACCESS_TOKEN);
  wx.removeStorageSync(STORAGE_KEYS_API.REFRESH_TOKEN);
  wx.removeStorageSync(STORAGE_KEYS_API.TOKEN_EXPIRES_AT);
}

function isLoggedIn() {
  return !!getAccessToken();
}

/**
 * 刷新 access_token（带并发锁）
 * @returns {Promise<string>} 新的 access_token
 */
function refreshAccessToken() {
  // 如果已有刷新在进行中，返回一个等待其完成的 Promise
  if (_refreshing) {
    return new Promise((resolve, reject) => {
      _refreshQueue.push({ resolve, reject });
    });
  }

  _refreshing = true;
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    _refreshing = false;
    clearTokens();
    return Promise.reject(new Error('无 refresh_token，需要重新登录'));
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: config.API_BASE_URL + '/api/auth/refresh-token',
      method: 'POST',
      data: { refreshToken },
      timeout: REQUEST_TIMEOUT,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.success) {
          const { accessToken, refreshToken: newRefreshToken } = res.data.data;
          saveTokens(accessToken, newRefreshToken || refreshToken);
          // 通知所有排队请求
          _refreshQueue.forEach(q => q.resolve(accessToken));
          _refreshQueue = [];
          resolve(accessToken);
        } else {
          clearTokens();
          const err = new Error('Token 刷新失败，请重新登录');
          _refreshQueue.forEach(q => q.reject(err));
          _refreshQueue = [];
          reject(err);
        }
      },
      fail: (err) => {
        clearTokens();
        const error = new Error('Token 刷新网络错误');
        _refreshQueue.forEach(q => q.reject(error));
        _refreshQueue = [];
        reject(error);
      },
      complete: () => {
        _refreshing = false;
      }
    });
  });
}

// ========== 核心请求 ==========

/**
 * 发起 HTTP 请求（内部方法）
 * @param {string} method - GET / POST / PUT / DELETE
 * @param {string} path - API 路径（如 /products），自动拼接 API_BASE_URL
 * @param {object} data - 请求数据（GET 转为 query string，其他为 JSON body）
 * @param {boolean} skipAuth - 跳过 token 附加（登录接口等）
 * @returns {Promise<object>} 响应 data 字段
 */
function request(method, path, data = {}, skipAuth = false) {
  const app = getApp();
  const useMock = app && app.globalData && app.globalData.useMock;

  // Mock 模式：走本地 mock
  if (useMock) {
    const { getHttpMockResponse } = require('./mock');
    const mockRes = getHttpMockResponse(method, path, data);
    if (mockRes) return Promise.resolve(mockRes);
    console.warn(`[api] Mock 未覆盖 ${method} ${path}，返回空`);
    return Promise.resolve(null);
  }

  // 真实请求
  return new Promise((resolve, reject) => {
    const doRequest = (token) => {
      const header = { 'Content-Type': 'application/json' };
      if (token) {
        header['Authorization'] = 'Bearer ' + token;
      }

      const isGet = method === 'GET';
      let url = config.API_BASE_URL + '/api' + path;

      // GET 请求将 data 转为 query string
      if (isGet && data && Object.keys(data).length > 0) {
        const query = Object.keys(data)
          .filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '')
          .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
          .join('&');
        if (query) url += '?' + query;
      }

      wx.request({
        url,
        method,
        header,
        data: isGet ? undefined : data,
        timeout: REQUEST_TIMEOUT,
        success: async (res) => {
          // 401 → 尝试刷新 token 后重试（仅一次，防无限递归）
          if (res.statusCode === 401 && !skipAuth && !this._retried) {
            this._retried = true;
            try {
              const newToken = await refreshAccessToken();
              // 重试原请求
              doRequest(newToken);
            } catch (refreshErr) {
              // 刷新失败 → 清除登录态 → 跳转登录页
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              if (currentPage && currentPage.route !== 'pages/login/login') {
                wx.navigateTo({ url: '/pages/login/login' });
              }
              reject(refreshErr);
            }
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            const msg = (res.data && res.data.message) || `请求失败 (${res.statusCode})`;
            reject(new Error(msg));
          }
        },
        fail: (err) => {
          console.error(`[api] ${method} ${path} 网络错误:`, err);
          reject(new Error('网络请求失败，请检查网络连接'));
        }
      });
    };

    // 决定是否需要附加 token
    const needAuth = !skipAuth && isLoggedIn();
    const token = needAuth ? getAccessToken() : null;
    doRequest(token);
  });
}

// ========== 公开方法 ==========

/** GET 请求 */
function get(path, data = {}) {
  return request('GET', path, data);
}

/** POST 请求 */
function post(path, data = {}, skipAuth = false) {
  return request('POST', path, data, skipAuth);
}

/** PUT 请求 */
function put(path, data = {}) {
  return request('PUT', path, data);
}

/** DELETE 请求 */
function del(path, data = {}) {
  return request('DELETE', path, data);
}

/** PATCH 请求 */
function patch(path, data = {}) {
  return request('PATCH', path, data);
}

/**
 * 上传文件
 * @param {string} path - API 路径
 * @param {string} filePath - 本地文件路径
 * @param {object} formData - 额外表单字段
 * @returns {Promise<string>} 上传后的文件 URL
 */
function upload(path, filePath, formData = {}) {
  const app = getApp();
  const useMock = app && app.globalData && app.globalData.useMock;

  if (useMock) {
    // Mock 模式返回临时路径
    return Promise.resolve(filePath);
  }

  return new Promise((resolve, reject) => {
    const token = getAccessToken();
    wx.uploadFile({
      url: config.API_BASE_URL + '/api' + path,
      filePath,
      name: 'file',
      formData,
      header: {
        'Authorization': token ? 'Bearer ' + token : ''
      },
      timeout: 30000,
      success: (res) => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(res.data);
            if (data.success && data.data) {
              resolve(data.data.url || data.data);
            } else {
              resolve(data);
            }
          } catch (e) {
            resolve(res.data);
          }
        } else if (res.statusCode === 401) {
          refreshAccessToken().then(() => {
            upload(path, filePath, formData).then(resolve).catch(reject);
          }).catch(() => {
            clearTokens();
            reject(new Error('登录已过期，请重新登录'));
          });
        } else {
          reject(new Error('上传失败 (' + res.statusCode + ')'));
        }
      },
      fail: (err) => {
        console.error('[api] 上传失败:', err);
        reject(new Error('上传失败，请检查网络'));
      }
    });
  });
}

// ========== 兼容层 ==========

/**
 * 兼容旧的 callFunction 调用方式（逐步废弃）
 * 自动映射云函数名 → REST API 路径
 */
const CLOUD_TO_REST_MAP = {
  // Auth
  'login':       { method: 'POST', path: '/auth/wx-login' },
  'wxLogin':     { method: 'POST', path: '/auth/wx-login' },
  'merchantLogin': { method: 'POST', path: '/auth/merchant-login' },
  // Products
  'getProducts': { method: 'GET',  path: '/products', dataFn: mapProductQuery },
  'getProductDetail': { method: 'GET', path: (d) => '/products/' + d.productId },
  'addProduct':  { method: 'POST', path: '/products', dataFn: mapProductPayload },
  'updateProduct': { method: 'PUT', path: (d) => '/products/' + d.productId, dataFn: mapProductPayload },
  'updateProductStatus': { method: 'PATCH', path: (d) => '/products/' + d.productId + '/status', dataFn: mapStatusPayload },
  // Categories
  'addCategory': { method: 'POST', path: '/categories' },
  'deleteCategory': { method: 'DELETE', path: (d) => '/categories/' + d.categoryId },
  'updateCategorySort': { method: 'PUT',  path: '/categories/sort', dataFn: (d) => ({ sorts: d.categories }) },
  // Banners（通过 /api/store/banners 访问）
  'getBanners':  { method: 'GET',  path: '/store/banners' },
  'saveBanners': { method: 'PUT',  path: '/store/banners', dataFn: (d) => ({ banners: d.banners }) },
  // Orders
  'getOrders':   { method: 'GET',  path: '/orders', dataFn: mapOrderQuery },
  'getOrderDetail': { method: 'GET', path: (d) => '/orders/' + d.orderNo },
  'createOrder': { method: 'POST', path: '/orders' },
  'retryPayment': { method: 'POST', path: (d) => '/orders/' + d.orderNo + '/pay' },
  'cancelOrder': { method: 'POST', path: (d) => '/orders/' + d.orderNo + '/cancel' },
  // Merchant Orders
  'getMerchantOrders': { method: 'GET', path: '/merchant/orders', dataFn: mapMerchantOrderQuery },
  'createOfflineOrder': { method: 'POST', path: '/merchant/offline-orders' },
  'updateOrderStatus': { method: 'POST', path: (d) => '/merchant/orders/' + d.orderNo + '/' + d.action },
  'completeOrder': { method: 'POST', path: (d) => '/merchant/orders/' + d.orderNo + '/complete' },
  // Pai Numbers
  'getPaiNumbers': { method: 'GET', path: '/pai-numbers' },
  // Store
  'getStoreConfig': { method: 'GET', path: '/store' },
  // Addresses
  'getAddresses': { method: 'GET', path: '/addresses' },
  // Dashboard
  'getDashboard': { method: 'GET', path: '/dashboard' },
  // Store Config
  'getStoreConfig': { method: 'GET', path: '/store' },
  'updateStoreConfig': { method: 'PUT', path: '/store' },
  // Addresses
  'addAddress': { method: 'POST', path: '/addresses' },
  'updateAddress': { method: 'PUT', path: (d) => '/addresses/' + d.addressId },
  'deleteAddress': { method: 'DELETE', path: (d) => '/addresses/' + d.addressId },
  // Pickup
  'getPickupStatus': { method: 'GET', path: (d) => '/pickup/status/' + d.orderNo },
  // Pai Numbers
  'releaseTag': { method: 'POST', path: (d) => '/pai-numbers/' + d.number + '/release' },
  // Dev Tools
  'clearMockOrders': { method: 'POST', path: '/dev/clear-mock-orders' },
  'clearTestData': { method: 'POST', path: '/dev/clear-test-data' },
  // Refund
  'refundOrder': { method: 'POST', path: (d) => '/merchant/orders/' + d.orderNo + '/refund' },
  // Weigh
  'submitWeigh': { method: 'POST', path: (d) => '/merchant/orders/' + d.orderNo + '/weigh' },
  // Card Code
  'getCardCode': { method: 'GET', path: (d) => '/pai-numbers/' + d.cardNumber + '/code' },
  // Mock Pay (dev only)
  'mockPay': { method: 'POST', path: (d) => '/orders/' + d.orderNo + '/pay', dataFn: (d) => ({ mockPay: true }) },
  'payCallback': { method: 'POST', path: (d) => '/orders/' + d.outTradeNo + '/pay', dataFn: (d) => ({ mockPay: true, mockPaySuccess: true }) },
};

function mapProductQuery(data) {
  const q = {};
  if (data.action === 'categories') return { __action: 'categories' }; // 特殊标记
  if (data.categoryId) q.categoryId = data.categoryId;
  if (data.pageSize) q.pageSize = data.pageSize;
  if (data.status) q.status = data.status;
  if (data.keyword) q.keyword = data.keyword;
  return q;
}

function mapProductPayload(data) {
  const p = {};
  if (data.name) p.name = data.name;
  if (data.categoryId) p.categoryId = data.categoryId;
  if (data.pricingType) p.pricingType = data.pricingType;
  if (data.sellingPoint) p.sellingPoint = data.sellingPoint;
  if (data.description) p.description = data.description;
  if (data.images) p.images = data.images;
  if (data.deliveryModes) p.deliveryModes = data.deliveryModes;
  if (data.pricePerJin !== undefined) p.pricePerJin = data.pricePerJin;
  if (data.weightOptions) p.weightOptions = data.weightOptions;
  if (data.processingFee !== undefined) p.processingFee = data.processingFee;
  if (data.processingOptions) p.processingOptions = data.processingOptions;
  if (data.unitPrice !== undefined) p.unitPrice = data.unitPrice;
  if (data.specs) p.specs = data.specs;
  return p;
}

function mapStatusPayload(data) {
  const p = {};
  if (data.status) p.status = data.status;
  if (data.outOfStock !== undefined) p.outOfStock = data.outOfStock;
  return p;
}

function mapOrderQuery(data) {
  const q = {};
  if (data.filter === 'completed') q.status = 'completed,cancelled';
  if (data.pageSize) q.pageSize = data.pageSize;
  return q;
}

function mapMerchantOrderQuery(data) {
  const q = {};
  if (data.status) q.status = data.status;
  if (data.type) q.type = data.type;
  if (data.dateFrom) q.dateFrom = data.dateFrom;
  if (data.dateTo) q.dateTo = data.dateTo;
  if (data.pageSize) q.pageSize = data.pageSize;
  return q;
}

/**
 * 旧 callFunction 兼容调用（自动映射到 REST API）
 * 已迁移的模块走 HTTP，未迁移的仍需走云函数
 * @deprecated 新代码请使用 api.get / api.post
 */
function callFunction(name, data = {}, timeout) {
  const mapping = CLOUD_TO_REST_MAP[name];
  if (!mapping) {
    // 未映射的云函数 → 降级到旧的云调用
    console.warn(`[api] 云函数 "${name}" 尚未迁移到 REST API，使用旧云调用`);
    const { callFunction: oldCallFunction } = require('./util');
    return oldCallFunction(name, data, timeout);
  }

  let path = typeof mapping.path === 'function' ? mapping.path(data) : mapping.path;
  const method = mapping.method;

  // 特殊处理：getProducts 的 categories action
  if (name === 'getProducts' && data.action === 'categories') {
    path = '/categories';
  }

  // 转换请求数据
  let reqData = data;
  if (mapping.dataFn) {
    reqData = mapping.dataFn(data);
  }

  // 对于 GET/DELETE，部分数据可能已编码在 path 中
  // 这里用 path 中的动态参数已通过 mapping.path(data) 处理
  const skipAuth = (name === 'login' || name === 'wxLogin' || name === 'merchantLogin');

  return request(method, path, reqData, skipAuth).catch(err => {
    console.error(`[api] ${name} → ${method} ${path} 失败:`, err.message || err);
    // 返回带错误信息的对象，调用方可检查 __error 字段
    return { success: false, message: err.message || '请求失败', __error: err };
  });
}

module.exports = {
  get,
  post,
  put,
  del,
  patch,
  upload,
  request,
  callFunction,
  // Token 管理
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  isLoggedIn,
  refreshAccessToken
};
