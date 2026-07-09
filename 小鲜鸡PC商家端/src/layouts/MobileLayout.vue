<template>
  <div class="mobile-shell">
    <!-- 顶部状态栏占位（safe-area-inset-top） -->
    <div class="mobile-status-bar" />

    <!-- 页面内容区 -->
    <div class="mobile-content">
      <router-view />
    </div>

    <!-- 底部 TabBar -->
    <div class="mobile-tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="tabbar-item"
        :class="{ active: currentTab === tab.key }"
        @click="switchTab(tab)"
        @longpress="onTabLongPress(tab)"
      >
        <el-icon :size="22"><component :is="tab.icon" /></el-icon>
        <span class="tabbar-label">{{ tab.label }}</span>
        <span v-if="tab.badge" class="tabbar-badge">{{ tab.badge > 99 ? '99+' : tab.badge }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function onNewOrderCount(e) {
  const count = e.detail && e.detail.count ? e.detail.count : 0
  setBadge(count)
}

onMounted(() => {
  window.addEventListener('new-order-count', onNewOrderCount)
})

onUnmounted(() => {
  window.removeEventListener('new-order-count', onNewOrderCount)
})

const tabs = [
  { key: 'orders', label: '订单', icon: 'List', path: '/mobile/orders' },
  { key: 'weigh', label: '称重', icon: 'ScaleToOriginal', path: '/mobile/weigh' },
  { key: 'stock', label: '库存', icon: 'Goods', path: '/mobile/stock' },
  { key: 'mine', label: '我的', icon: 'UserFilled', path: '/mobile/mine' }
]

// 新订单角标（由轮询更新）
const newOrderCount = ref(0)

const currentTab = computed(() => {
  const p = route.path
  if (p.startsWith('/mobile/orders')) return 'orders'
  if (p.startsWith('/mobile/weigh')) return 'weigh'
  if (p.startsWith('/mobile/stock')) return 'stock'
  if (p.startsWith('/mobile/mine')) return 'mine'
  return 'orders'
})

function switchTab(tab) {
  router.push(tab.path)
}

function onTabLongPress(tab) {
  // 长按"订单"Tab 触发扫码
  if (tab.key === 'orders') {
    router.push('/mobile/scan')
  }
}

// 暴露角标更新方法（供全局轮询调用）
function setBadge(count) {
  const ordersTab = tabs.find(t => t.key === 'orders')
  if (ordersTab) ordersTab.badge = count > 0 ? count : 0
  newOrderCount.value = count
}

defineExpose({ setBadge })
</script>

<style scoped>
.mobile-shell {
  height: 100vh; height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--mobile-bg, #f5f6fa);
  overflow: hidden;
}

.mobile-status-bar {
  height: env(safe-area-inset-top, 0px);
  background: #D4420A;
  flex-shrink: 0;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
}

/* ====== 底部 TabBar ====== */
.mobile-tabbar {
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  flex-shrink: 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
}

.tabbar-item {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 6px 0 4px;
  color: #999;
  position: relative;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  min-height: 48px; /* 触摸友好 */
}

.tabbar-item.active {
  color: #D4420A;
}

.tabbar-label {
  font-size: 10px;
  margin-top: 2px;
  line-height: 1;
}

.tabbar-badge {
  position: absolute;
  top: 2px;
  right: 50%;
  transform: translateX(22px);
  background: #F56C6C;
  color: #fff;
  font-size: 10px;
  min-width: 16px; height: 16px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
</style>
