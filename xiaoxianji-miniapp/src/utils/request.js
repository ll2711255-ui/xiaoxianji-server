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

function getTokenExpiry() {
  return parseInt(uni.getStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT)) || 0
}

/**
 * 从 JWT token 中解码过期时间（exp 字段）
 * JWT: header.payload.signature，每段都是 base64url
 */
function decodeJwtExp(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return 0
    // base64url → base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(_b64Decode(base64))
    return (payload.exp || 0) * 1000 // 秒 → 毫秒
  } catch (_) {
    return 0
  }
}

/** Mini-program 兼容的 base64 解码（不用 atob，部分旧版不支持） */
function _b64Decode(str) {
  // 去掉填充符 '='（它在 charset 里不存在，indexOf 返回 -1 会破坏位运算）
  // 填充符不携带数据，去掉后按实际字符解码即可
  str = str.replace(/=+$/, '')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  for (let i = 0; i < str.length; i += 4) {
    const a = chars.indexOf(str[i] || 'A')
    const b = chars.indexOf(str[i + 1] || 'A')
    const c = chars.indexOf(str[i + 2] || 'A')
    const d = chars.indexOf(str[i + 3] || 'A')
    output += String.fromCharCode((a << 2) | (b >> 4))
    if (c !== -1) output += String.fromCharCode(((b & 15) << 4) | (c >> 2))
    if (d !== -1) output += String.fromCharCode(((c & 3) << 6) | d)
  }
  return decodeURIComponent(escape(output))
}

export function saveTokens(accessToken, refreshToken) {
  uni.setStorageSync(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  if (refreshToken) {
    uni.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
  }
  // 从 JWT 解码过期时间，存到本地
  const exp = decodeJwtExp(accessToken)
  if (exp > 0) {
    uni.setStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT, exp)
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
 * 确保 Token 新鲜：过期前 5 分钟提前刷新，避免发出 401 请求
 * → 微信运行时的「请求重入检测」不允许在同一 URL 上换 Token 重试，
 *    所以必须提前刷新，不发会 401 的请求
 */
async function ensureFreshToken() {
  const token = getAccessToken()
  if (!token) return token

  let expMs = getTokenExpiry()

  // 自愈：旧代码存的 token_expires_at 可能为 0（base64 解码 bug 导致），
  //       此时直接从 JWT 重新解码，避免不必要的刷新触发微信「请求重入检测」
  if (!expMs || expMs <= 0) {
    const decodedExp = decodeJwtExp(token)
    if (decodedExp > 0) {
      uni.setStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT, decodedExp)
      expMs = decodedExp
    }
  }

  // token 有效且距过期 > 5 分钟，直接返回
  if (expMs > 0 && Date.now() < expMs - 5 * 60 * 1000) {
    return token
  }

  // 接近过期 → 提前刷新
  try {
    const newToken = await refreshAccessToken()
    return newToken
  } catch (_) {
    // 刷新失败，返回旧 token 让请求正常发（服务器可能还认）
    return token
  }
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

      // 所有写请求加 _t 时间戳，确保每次请求 URL 唯一
      // 微信运行时会缓存「首次请求」的 URL+参数，后续同 URL 换了 token
      // 就会触发「请求重入时，参数与首次请求时不一致」拦截
      // 加上时间戳后每次 URL 都不同，彻底绕过此检测
      if (options._isRetry) {
        url += (url.includes('?') ? '&' : '?') + '_retry=' + Date.now()
      } else if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
        url += (url.includes('?') ? '&' : '?') + '_t=' + Date.now()
      }

      uni.request({
        url,
        method,
        header,
        data: isGet ? undefined : data,
        timeout: TIMEOUT,
        success: async (res) => {
          // 401 → 刷新 token 后重试（仅一次）
          // 重试时 URL 追加 _retry 参数，避免微信运行时「请求重入检测」拦截
          if (res.statusCode === 401 && !skipAuth && !options._retried) {
            options._retried = true
            options._isRetry = true
            try {
              const newToken = await refreshAccessToken()
              setTimeout(() => doRequest(newToken), 100)
            } catch (refreshErr) {
              // 刷新失败（token 过期 / refresh_token 缺失）→ 清空登录态，引导重新登录
              console.warn('[request] token 刷新失败，已清除登录态，请重新登录')
              const pages = getCurrentPages()
              const currentPage = pages[pages.length - 1]
              if (currentPage && currentPage.route !== 'pages/mine/mine') {
                uni.switchTab({ url: '/pages/mine/mine' })
              }
              reject(new Error('登录已过期，请重新登录'))
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
    if (needAuth) {
      // 提前刷新即将过期的 token，避免 401 触发微信「请求重入检测」
      ensureFreshToken().then(token => doRequest(token)).catch(() => doRequest(getAccessToken()))
    } else {
      doRequest(null)
    }
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
export function upload(path, filePath, formData = {}, _isRetry = false) {
  return new Promise((resolve, reject) => {
    // 上传前也做 token 新鲜度检查
    const doUpload = (token) => {
      let url = BASE_URL + '/api' + path
      // 每次上传加 _t 时间戳，避免微信「请求重入检测」拦截
      url += (url.includes('?') ? '&' : '?') + '_t=' + Date.now()

      uni.uploadFile({
        url,
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
          } else if (res.statusCode === 401 && !_isRetry) {
            refreshAccessToken().then(() => {
              setTimeout(() => upload(path, filePath, formData, true).then(resolve).catch(reject), 100)
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
    }

    // 提前刷新即将过期的 token
    if (isLoggedIn()) {
      ensureFreshToken().then(t => doUpload(t)).catch(() => doUpload(getAccessToken()))
    } else {
      doUpload('')
    }
  })
}
