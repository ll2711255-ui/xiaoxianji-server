<template>
  <div class="mobile-orders">
    <!-- 顶栏：扫码 + 状态筛选 -->
    <div class="orders-header">
      <h3 class="page-title">订单</h3>
      <el-button type="primary" circle size="small" @click="onScan">
        <el-icon :size="18"><Camera /></el-icon>
      </el-button>
    </div>

    <!-- 状态筛选选项卡 -->
    <el-tabs v-model="tabIndex" @tab-change="loadOrders" type="capsule" class="orders-tabs">
      <el-tab-pane v-for="(t, i) in tabs" :key="i" :label="`${t} (${tabCounts[i] || 0})`" :name="i" />
    </el-tabs>

    <!-- 订单卡片列表 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <div v-else-if="orders.length === 0" class="empty-state">
      <el-icon :size="48"><Document /></el-icon>
      <p>暂无订单</p>
    </div>

    <OrderCard
      v-for="order in orders"
      :key="order.orderNo"
      :order="order"
      :actions="getActions(order)"
      :is-urgent="order.status === 'paid'"
      @click="onOrderClick"
      @action="onAction"
    />

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <el-button text :loading="loadingMore" @click="loadMore">加载更多</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import OrderCard from '@/components/mobile/OrderCard.vue'
import { useScanner } from '@/composables/useScanner'
import { useNotification } from '@/composables/useNotification'

const router = useRouter()
const { scan } = useScanner()
const { notify } = useNotification()

const tabs = ['待接单', '已接单', '处理中', '待取货', '已完成']
const statusMap = ['paid', 'accepted,weighed,processing,delivering', 'accepted,weighed,processing', 'ready', 'completed']

const tabIndex = ref(0)
const orders = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const tabCounts = reactive({})
const page = ref(1)

// 新订单轮询
let _pollTimer = null
let _lastPaidCount = 0

const ORDER_ACTIONS = {
  paid: [
    { label: '接单', action: 'accept', type: 'primary' }
  ],
  accepted: [
    { label: '称重', action: 'weigh', type: 'warning' }
  ],
  weighed: [
    { label: '备货完成', action: 'ready', type: 'success' }
  ],
  ready: [
    { label: '已取货', action: 'complete', type: 'info' }
  ]
}

function getActions(order) {
  return ORDER_ACTIONS[order.status] || []
}

async function loadOrders() {
  loading.value = true
  page.value = 1
  try {
    const status = statusMap[tabIndex.value]
    const res = await api.get('/merchant/orders', { status, page: 1, pageSize: 20, type: 'delivery,pickup' })
    orders.value = (res && res.data && res.data.orders) || []
    hasMore.value = orders.value.length >= 20
  } catch (err) {
    console.error('加载订单失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const status = statusMap[tabIndex.value]
    const res = await api.get('/merchant/orders', { status, page: page.value, pageSize: 20, type: 'delivery,pickup' })
    const newOrders = (res && res.data && res.data.orders) || []
    orders.value.push(...newOrders)
    hasMore.value = newOrders.length >= 20
  } catch (err) {
    page.value--
  } finally {
    loadingMore.value = false
  }
}

function onOrderClick(order) {
  router.push('/mobile/orders/' + order.orderNo)
}

async function onAction({ order, action }) {
  // 称重：跳转到称重页面（需要输入实际重量，不能简单发 POST）
  if (action === 'weigh') {
    router.push('/mobile/weigh?orderNo=' + order.orderNo)
    return
  }

  try {
    const res = await api.post(`/merchant/orders/${order.orderNo}/${action}`)
    if (res && res.success) {
      ElMessage.success(action === 'accept' ? '已接单' : '操作成功')
      loadOrders()
    } else {
      ElMessage.error((res && res.message) || '操作失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '操作失败')
  }
}

async function onScan() {
  const result = await scan({ hint: '扫描订单条形码' })
  if (result && result.text) {
    router.push('/mobile/orders/' + result.text)
  }
}

// 轮询新订单（前台活跃时）
function startPoll() {
  _pollTimer = setInterval(async () => {
    try {
      const res = await api.get('/merchant/orders', { status: 'paid', pageSize: 200, type: 'delivery,pickup' })
      const currentCount = (res && res.data && res.data.orders) ? res.data.orders.length : 0
      if (_lastPaidCount > 0 && currentCount > _lastPaidCount) {
        const delta = currentCount - _lastPaidCount
        notify('🔔 新订单提醒', `有 ${delta} 个新订单等待接单`, {
          vibrate: true,
          sound: true,
          onClick: () => router.push('/mobile/orders')
        })
      }
      _lastPaidCount = currentCount
      tabCounts[0] = currentCount
    } catch (_) { /* 静默失败 */ }
  }, 30000)
}

onMounted(() => {
  loadOrders()
  startPoll()
})

onUnmounted(() => {
  if (_pollTimer) clearInterval(_pollTimer)
})
</script>

<style scoped>
.mobile-orders { padding-bottom: 12px; }

.orders-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.page-title {
  font-size: 20px; font-weight: 700; color: #222; margin: 0;
}

.orders-tabs {
  margin-bottom: 12px;
}
.orders-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.orders-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 60px 0; color: #999; gap: 12px;
}

.load-more {
  text-align: center; padding: 16px 0;
}
</style>
