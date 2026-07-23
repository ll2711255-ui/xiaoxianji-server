<template>
  <MobileLayout v-if="isMobile" />
  <router-view v-else />
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { detectMobile, getPlatform, isTauri } from '@/utils/platform'
import { useNotification } from '@/composables/useNotification'
import { useBackgroundFetch } from '@/composables/useBackgroundFetch'
import { useAuthStore } from '@/stores/auth'
const MobileLayout = defineAsyncComponent(() => import('@/layouts/MobileLayout.vue'))

const isMobile = ref(detectMobile())
const { notify, requestPermission } = useNotification()
const { startPoll, stopPoll } = useBackgroundFetch()
const authStore = useAuthStore()

/**
 * 移动端初始化：
 *   1. 请求通知权限
 *   2. 启动前台轮询（每30秒检查新订单，有则推送通知）
 */
async function initMobile() {
  // 请求通知权限
  const granted = await requestPermission()
  console.log('[mobile] 通知权限:', granted ? '已授权' : '未授权')

  // 启动前台轮询
  if (authStore.isLoggedIn) {
    startPoll(async () => {
      try {
        const api = (await import('@/utils/api')).default
        const res = await api.get('/merchant/orders', { status: 'paid', pageSize: 200, type: 'delivery,pickup' })
        const count = (res && res.data && res.data.orders) ? res.data.orders.length : 0
        if (count > 0) {
          // 更新 MobileLayout 角标
          // （通过 window 全局事件桥接）
          window.dispatchEvent(new CustomEvent('new-order-count', { detail: { count } }))
        }
      } catch (err) {
        console.error('[mobile] 轮询失败:', err)
      }
    }, 30000)
  }
}

onMounted(async () => {
  // 完整平台检测（Tauri 环境从 plugin-os 获取准确值）
  if (isTauri && !isMobile.value) {
    try {
      const platform = await getPlatform()
      isMobile.value = platform.isMobile
    } catch (_) { /* 保持 detectMobile 结果 */ }
  }

  if (isMobile.value) {
    await initMobile()
  }

  // 监听 resize（Web 环境响应式切换）
  window.addEventListener('resize', () => {
    if (!isTauri) {
      isMobile.value = detectMobile()
    }
  })
})

onUnmounted(() => {
  stopPoll()
  window.removeEventListener('resize', () => {})
})
</script>
