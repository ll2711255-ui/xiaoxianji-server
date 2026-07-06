/**
 * 认证 Pinia Store
 * JWT Token 管理 + 登录/登出 + 角色信息
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'admin_access_token',
  REFRESH_TOKEN: 'admin_refresh_token',
  MERCHANT_ID: 'admin_merchant_id',
  ROLE: 'admin_role',
  USER_NAME: 'admin_user_name'
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '')
  const refreshToken = ref(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '')
  const merchantId = ref(localStorage.getItem(STORAGE_KEYS.MERCHANT_ID) || '')
  const role = ref(localStorage.getItem(STORAGE_KEYS.ROLE) || '')
  const userName = ref(localStorage.getItem(STORAGE_KEYS.USER_NAME) || '')

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => role.value === 'admin' || role.value === 'manager')
  const isEmployee = computed(() => role.value === 'employee')

  function saveTokens(at, rt) {
    accessToken.value = at
    refreshToken.value = rt
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, at)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, rt)
  }

  function setUser(id, r, name) {
    merchantId.value = id
    role.value = r
    userName.value = name || ''
    localStorage.setItem(STORAGE_KEYS.MERCHANT_ID, id)
    localStorage.setItem(STORAGE_KEYS.ROLE, r)
    localStorage.setItem(STORAGE_KEYS.USER_NAME, name || '')
  }

  function clearAuth() {
    accessToken.value = ''
    refreshToken.value = ''
    merchantId.value = ''
    role.value = ''
    userName.value = ''
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
  }

  return {
    accessToken, refreshToken, merchantId, role, userName,
    isLoggedIn, isAdmin, isEmployee,
    saveTokens, setUser, clearAuth
  }
})
