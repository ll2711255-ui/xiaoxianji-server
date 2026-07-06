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
  if (authStore.accessToken && !config.skipAuth) {
    config.headers.Authorization = 'Bearer ' + authStore.accessToken
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
          const { accessToken, refreshToken } = res.data.data
          authStore.saveTokens(accessToken, refreshToken || authStore.refreshToken)
          _refreshQueue.forEach(q => q.resolve(accessToken))
          _refreshQueue = []
          config.headers.Authorization = 'Bearer ' + accessToken
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
   * 上传文件
   */
  async upload(path, file) {
    if (USE_MOCK) {
      return { success: true, data: { url: URL.createObjectURL(file) } }
    }
    const formData = new FormData()
    formData.append('file', file)
    const authStore = useAuthStore()
    const headers = { 'Content-Type': 'multipart/form-data' }
    if (authStore.accessToken) {
      headers.Authorization = 'Bearer ' + authStore.accessToken
    }
    const res = await axios.post(API_BASE_URL + '/api' + path, formData, { headers, timeout: 30000 })
    return res.data
  }
}

export default api
