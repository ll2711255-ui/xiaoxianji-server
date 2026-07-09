/**
 * 鉴权状态管理 — Pinia Store
 *
 * 替代原小程序的 app.globalData（userInfo / openid / role / merchantId / phone / accessToken）
 * 所有鉴权相关状态集中管理，Vue 组件通过 useAuthStore() 读写
 *
 * 使用方式：
 *   import { useAuthStore } from '@/stores/auth'
 *   const authStore = useAuthStore()
 *   authStore.openid       // 只读
 *   authStore.isLoggedIn   // computed
 *   authStore.restoreAuth() // 从 storage 恢复
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLoginCode, saveLoginInfo } from '@/utils/auth'
import { post, isLoggedIn } from '@/utils/request'

export const useAuthStore = defineStore('auth', () => {
  // ========== State ==========
  const openid = ref('')
  const phone = ref('')
  const userInfo = ref(null)
  const role = ref('')
  const merchantId = ref('')
  const useMock = ref(false)

  // ========== Getters ==========
  const isLoggedInState = computed(() => !!openid.value || isLoggedIn())
  const isMerchant = computed(() => ['admin', 'manager', 'employee'].includes(role.value))
  const isAdmin = computed(() => role.value === 'admin')

  // ========== Actions ==========

  /**
   * 从 storage 恢复鉴权信息到 state（App.vue onLaunch 调用）
   */
  function restoreAuth() {
    openid.value = uni.getStorageSync('openid') || ''
    phone.value = uni.getStorageSync('phone') || ''
    role.value = uni.getStorageSync('role') || ''
    merchantId.value = uni.getStorageSync('merchantId') || ''
    try {
      const cached = uni.getStorageSync('userInfo')
      if (cached) userInfo.value = cached
    } catch (_) {}
  }

  /**
   * 静默登录：uni.login 获取 code → POST /api/auth/wx-login → 得到 JWT
   * 无感获取，不阻塞、不跳转
   */
  async function silentLogin() {
    // 如已有有效 token，跳过
    if (isLoggedIn()) {
      console.log('[静默登录] 已有 token，跳过')
      return
    }

    // 如已有 openid，也算半登录状态
    if (openid.value) {
      console.log('[静默登录] 已有 openid，跳过')
      return
    }

    try {
      const code = await getLoginCode()
      if (!code) {
        console.warn('[静默登录] 获取 code 失败')
        return
      }

      const res = await post('/auth/wx-login', { code }, { skipAuth: true })

      if (res && res.success && res.data) {
        const d = res.data
        saveLoginInfo({
          accessToken: d.accessToken || '',
          refreshToken: d.refreshToken || '',
          openid: d.openid || '',
          phone: d.phone || '',
          nickName: d.nickName || '',
          avatarUrl: d.avatarUrl || ''
        })
        console.log('[静默登录] 成功, openid:', d.openid)
      } else {
        console.warn('[静默登录] 失败:', (res && res.message) || '未知错误')
      }
    } catch (err) {
      console.warn('[静默登录] 网络错误:', err.message || err)
    }
  }

  /**
   * 重置状态（退出登录）
   */
  function $reset() {
    openid.value = ''
    phone.value = ''
    userInfo.value = null
    role.value = ''
    merchantId.value = ''
  }

  return {
    openid, phone, userInfo, role, merchantId, useMock,
    isLoggedInState, isMerchant, isAdmin,
    restoreAuth, silentLogin, $reset
  }
})
