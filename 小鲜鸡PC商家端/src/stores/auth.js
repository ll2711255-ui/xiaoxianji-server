/**
 * 认证 Pinia Store
 *
 * JWT Token 管理 + 登录/登出 + 角色信息
 * 登录成功后持久化到 localStorage，刷新页面后从 localStorage 恢复。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEYS = {
  TOKEN: 'merchant_token',
  REFRESH_TOKEN: 'merchant_refresh_token',
  USER_INFO: 'merchant_user_info',
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(STORAGE_KEYS.TOKEN) || '')
  const refreshToken = ref(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '')

  // userInfo: { id, username, role, displayName }
  const userInfo = ref(initUserInfo())

  function initUserInfo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_INFO)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  // ========== 工具：解码 JWT 负载（不验签，仅读取） ==========
  function decodeJwtPayload(t) {
    try {
      const parts = t.split('.')
      if (parts.length !== 3) return null
      // base64url → base64 → UTF-8
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const json = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''))
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  // ========== Getters ==========
  const isLoggedIn = computed(() => !!token.value)
  /** 当前 token 是否为商家端签发（source === 'merchant'），用于路由守卫拦截顾客 token */
  const isMerchantToken = computed(() => {
    if (!token.value) return false
    const payload = decodeJwtPayload(token.value)
    return payload?.source === 'merchant'
  })
  const isAdmin = computed(() => userInfo.value?.role === 'admin')
  const isManager = computed(() => userInfo.value?.role === 'manager')
  const isStaff = computed(() => userInfo.value?.role === 'staff')
  const canManageAccounts = computed(() => ['admin', 'manager'].includes(userInfo.value?.role))

  // ========== Actions ==========

  function setAuth(t, rt, info) {
    token.value = t
    refreshToken.value = rt
    userInfo.value = info
    localStorage.setItem(STORAGE_KEYS.TOKEN, t)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, rt)
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(info))
  }

  function clearAuth() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
  }

  /**
   * 从 localStorage 恢复登录状态（app 启动时调用）
   */
  function initFromStorage() {
    const t = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (t) {
      token.value = t
      refreshToken.value = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || ''
      userInfo.value = initUserInfo()
    }
  }

  return {
    token, refreshToken, userInfo,
    isLoggedIn, isMerchantToken, isAdmin, isManager, isStaff, canManageAccounts,
    setAuth, clearAuth, initFromStorage,
  }
})
