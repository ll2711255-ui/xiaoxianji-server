/**
 * HTTP 请求封装（基于 uni.request）
 *
 * 特性：
 *   - 自动附加 Authorization: Bearer {token}
 *   - 401 自动刷新 token 后重放原请求
 *   - 并发刷新保护（同一时刻只有一个刷新请求）
 *   - baseURL 从环境变量读取（.env.development / .env.production）
 *   - 请求/响应拦截器
 *
 * 使用方式：
 *   import { get, post, put, del, upload } from '@/utils/request'
 *
 *   const res = await get('/products', { pageSize: 20 })
 *   const res = await post('/orders', { productId: '...' })
 *   const url = await upload('/upload/image', filePath)
 */

// ========== 基础配置 ==========

/** API 基础地址（从环境变量读取） */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.xuaioxianji.top'

/** 请求超时（毫秒） */
const TIMEOUT = 15000

/** Token 存储键名（约定：snake_case，小程序端无前缀以区分 PC 端 admin_ 前缀） */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRES_AT: 'token_expires_at'
}

// ========== Token 管理 ==========

/** 是否正在刷新 token（并发锁） */
let _refreshing = false
/** 等待刷新完成的请求队列 */
let _refreshQueue = []

function getAccessToken() {
  return uni.getStorageSync(STORAGE_KEYS.ACCESS_TOKEN) || ''
}

function getRefreshToken() {
  return uni.getStorageSync(STORAGE_KEYS.REFRESH_TOKEN) || ''
}

export function saveTokens(accessToken, refreshToken) {
  uni.setStorageSync(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  if (refreshToken) {
    uni.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
  }
}

export function clearTokens() {
  uni.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN)
  uni.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
  uni.removeStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT)
}

export function isLoggedIn() {
  return !!getAccessToken()
}

/**
 * 刷新 access_token（带并发锁）
 * @returns {Promise<string>} 新的 access_token
 */
async function refreshAccessToken() {
  // 如果已有刷新在进行中，返回一个等待其完成的 Promise
  if (_refreshing) {
    return new Promise((resolve, reject) => {
      _refreshQueue.push({ resolve, reject })
    })
  }

  _refreshing = true
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    _refreshing = false
    clearTokens()
    return Promise.reject(new Error('无 refresh_token，需要重新登录'))
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + '/api/auth/refresh-token',
      method: 'POST',
      data: { refreshToken },
      timeout: TIMEOUT,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.success) {
          const { accessToken, refreshToken: newRefreshToken } = res.data.data
          saveTokens(accessToken, newRefreshToken || refreshToken)
          _refreshQueue.forEach(q => q.resolve(accessToken))
          _refreshQueue = []
          resolve(accessToken)
        } else {
          clearTokens()
          const err = new Error('Token 刷新失败，请重新登录')
          _refreshQueue.forEach(q => q.reject(err))
          _refreshQueue = []
          reject(err)
        }
      },
      fail: (err) => {
        clearTokens()
        const error = new Error('Token 刷新网络错误')
        _refreshQueue.forEach(q => q.reject(error))
        _refreshQueue = []
        reject(error)
      },
      complete: () => {
        _refreshing = false
      }
    })
  })
}

// ========== 核心请求方法 ==========

/**
 * 发起 HTTP 请求
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} path - API 路径（如 /products），自动拼接 BASE_URL
 * @param {object} data - 请求数据
 * @param {object} options
 * @param {boolean} options.skipAuth - 跳过 token 附加（登录接口）
 * @param {boolean} options._retried - 内部标记：是否已重试过（防无限递归）
 * @returns {Promise<object>} 响应 data 字段
 */
export function request(method, path, data = {}, options = {}) {
  const { skipAuth = false } = options

  return new Promise((resolve, reject) => {
    const doRequest = (token) => {
      const header = { 'Content-Type': 'application/json' }
      if (token) {
        header['Authorization'] = 'Bearer ' + token
      }

      const isGet = method === 'GET'
      let url = BASE_URL + '/api' + path

      // GET 请求将 data 转为 query string
      if (isGet && data && Object.keys(data).length > 0) {
        const query = Object.keys(data)
          .filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '')
          .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
          .join('&')
        if (query) url += '?' + query
      }

      uni.request({
        url,
        method,
        header,
        data: isGet ? undefined : data,
        timeout: TIMEOUT,
        success: async (res) => {
          // 401 → 尝试刷新 token 后重试（仅一次）
          if (res.statusCode === 401 && !skipAuth && !options._retried) {
            options._retried = true
            try {
              const newToken = await refreshAccessToken()
              doRequest(newToken)
            } catch (refreshErr) {
              // 刷新失败 → 跳转登录页
              const pages = getCurrentPages()
              const currentPage = pages[pages.length - 1]
              if (currentPage && currentPage.route !== 'pages/login/login') {
                uni.navigateTo({ url: '/pages/login/login' })
              }
              reject(refreshErr)
            }
            return
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            const msg = (res.data && res.data.message) || `请求失败 (${res.statusCode})`
            reject(new Error(msg))
          }
        },
        fail: (err) => {
          console.error(`[request] ${method} ${path} 网络错误:`, err)
          reject(new Error('网络请求失败，请检查网络连接'))
        }
      })
    }

    // 决定是否需要附加 token
    const needAuth = !skipAuth && isLoggedIn()
    const token = needAuth ? getAccessToken() : null
    doRequest(token)
  })
}

// ========== 便捷方法 ==========

/** GET 请求 */
export function get(path, data = {}, options = {}) {
  return request('GET', path, data, options)
}

/** POST 请求 */
export function post(path, data = {}, options = {}) {
  return request('POST', path, data, options)
}

/** PUT 请求 */
export function put(path, data = {}, options = {}) {
  return request('PUT', path, data, options)
}

/** DELETE 请求 */
export function del(path, data = {}, options = {}) {
  return request('DELETE', path, data, options)
}

/** PATCH 请求 */
export function patch(path, data = {}, options = {}) {
  return request('PATCH', path, data, options)
}

/**
 * 上传文件
 * @param {string} path - API 路径（如 /upload/image）
 * @param {string} filePath - 本地文件路径
 * @param {object} formData - 额外表单字段
 * @returns {Promise<string>} 上传后的文件 URL
 */
export function upload(path, filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken()
    uni.uploadFile({
      url: BASE_URL + '/api' + path,
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
            const data = JSON.parse(res.data)
            if (data.success && data.data) {
              resolve(data.data.url || data.data)
            } else {
              resolve(data)
            }
          } catch (e) {
            resolve(res.data)
          }
        } else if (res.statusCode === 401) {
          refreshAccessToken().then(() => {
            upload(path, filePath, formData).then(resolve).catch(reject)
          }).catch(() => {
            clearTokens()
            reject(new Error('登录已过期，请重新登录'))
          })
        } else {
          reject(new Error('上传失败 (' + res.statusCode + ')'))
        }
      },
      fail: (err) => {
        console.error('[request] 上传失败:', err)
        reject(new Error('上传失败，请检查网络'))
      }
    })
  })
}
