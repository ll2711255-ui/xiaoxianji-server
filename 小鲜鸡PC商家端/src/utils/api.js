/**
 * HTTP API 请求封装（JWT 鉴权 + 自动刷新 + Mock 降级）
 *
 * 使用方式：
 *   import api from '@/utils/api'
 *   const products = await api.get('/products')
 *   const result = await api.post('/orders', { ... })
 */

import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { getMockResponse } from './mock'

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ========== 创建 Axios 实例 ==========

const http = axios.create({
  baseURL: API_BASE_URL + '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// ========== 请求拦截器：自动附加 Token ==========

http.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token && !config.skipAuth) {
    config.headers.Authorization = 'Bearer ' + authStore.token
  }
  return config
})

// ========== 响应拦截器：401 自动刷新 ==========

let _refreshing = false
let _refreshQueue = []

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error

    // 处理特定 HTTP 错误状态码
    if (response) {
      const msg = (response.data && response.data.message) || ''
      switch (response.status) {
        case 403:
          // 顾客 token 访问商家接口 → 清除旧登录态，跳转登录页
          if (msg === '仅商家端账号可访问') {
            const authStore403 = useAuthStore()
            authStore403.clearAuth()
            if (window.__router) window.__router.push('/login')
            else window.location.href = '/login'
            return Promise.reject(new Error('请使用商家账号登录'))
          }
          // 其他权限不足（角色不足等），不清除 token
          return Promise.reject(new Error(msg || '无权限执行此操作'))
        case 429:
          return Promise.reject(new Error(msg || '请求过于频繁，请稍后重试'))
        case 500:
          return Promise.reject(new Error(msg || '服务器内部错误，请稍后重试'))
      }
    }

    if (response && response.status === 401 && !config.skipAuth && !config._retry) {
      const authStore = useAuthStore()

      if (!authStore.refreshToken) {
        authStore.clearAuth()
        if (window.__router) window.__router.push('/login')
        else window.location.href = '/login'
        return Promise.reject(error)
      }

      // 并发刷新保护
      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject })
        }).then((newToken) => {
          config.headers.Authorization = 'Bearer ' + newToken
          config._retry = true
          return http(config)
        })
      }

      _refreshing = true
      config._retry = true

      try {
        const res = await axios.post(API_BASE_URL + '/api/auth/refresh-token', {
          refreshToken: authStore.refreshToken
        })
        if (res.data && res.data.success) {
          const { accessToken, refreshToken: newRt, token } = res.data.data
          const newAccessToken = accessToken || token
          authStore.setAuth(newAccessToken, newRt || authStore.refreshToken, authStore.userInfo)
          _refreshQueue.forEach(q => q.resolve(newAccessToken))
          _refreshQueue = []
          config.headers.Authorization = 'Bearer ' + newAccessToken
          return http(config)
        } else {
          throw new Error('刷新失败')
        }
      } catch (refreshErr) {
        authStore.clearAuth()
        _refreshQueue.forEach(q => q.reject(refreshErr))
        _refreshQueue = []
        if (window.__router) window.__router.push('/login')
        else window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        _refreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ========== 公开方法 ==========

const api = {
  async get(path, params = {}) {
    if (USE_MOCK) {
      const res = getMockResponse('GET', path, params)
      if (res) return res
    }
    const res = await http.get(path, { params })
    return res.data
  },

  async post(path, data = {}, skipAuth = false) {
    if (USE_MOCK) {
      const res = getMockResponse('POST', path, data)
      if (res) return res
    }
    const config = skipAuth ? { skipAuth: true } : {}
    const res = await http.post(path, data, config)
    return res.data
  },

  async put(path, data = {}) {
    if (USE_MOCK) {
      const res = getMockResponse('PUT', path, data)
      if (res) return res
    }
    const res = await http.put(path, data)
    return res.data
  },

  async del(path, data = {}) {
    if (USE_MOCK) {
      const res = getMockResponse('DELETE', path, data)
      if (res) return res
    }
    const res = await http.delete(path, { data })
    return res.data
  },

  async patch(path, data = {}) {
    if (USE_MOCK) {
      const res = getMockResponse('PATCH', path, data)
      if (res) return res
    }
    const res = await http.patch(path, data)
    return res.data
  },

  /**
   * 上传文件（支持 401 自动刷新重试）
   */
  async upload(path, file) {
    if (USE_MOCK) {
      return { success: true, data: { url: URL.createObjectURL(file) } }
    }

    const doUpload = async (token) => {
      const headers = {}
      if (token) {
        headers.Authorization = 'Bearer ' + token
      }
      const formData = new FormData()
      formData.append('file', file)
      return axios.post(API_BASE_URL + '/api' + path, formData, { headers, timeout: 30000 })
    }

    const authStore = useAuthStore()
    const token = authStore.token

    try {
      const res = await doUpload(token)
      if (res.status === 401 && authStore.refreshToken) {
        // Token 过期 → 刷新后重试一次
        const refreshRes = await axios.post(API_BASE_URL + '/api/auth/refresh-token', {
          refreshToken: authStore.refreshToken
        })
        if (refreshRes.data && refreshRes.data.success) {
          const { accessToken, refreshToken: newRt, token } = refreshRes.data.data
          const newAccessToken = accessToken || token
          authStore.setAuth(newAccessToken, newRt || authStore.refreshToken, authStore.userInfo)
          const retryRes = await doUpload(accessToken)
          return retryRes.data
        }
        throw new Error('登录已过期')
      }
      return res.data
    } catch (err) {
      if (err.response && err.response.status === 401) {
        authStore.clearAuth()
        if (window.__router) window.__router.push('/login')
        throw new Error('登录已过期，请重新登录')
      }
      throw err
    }
  }
}

export default api
