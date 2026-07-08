<template>
  <div>
    <h2 class="page-title">仪表盘</h2>
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <StatCard icon="List" label="新订单" :value="stats.pendingCount" color="#D4420A" @click="$router.push('/orders')" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="Loading" label="处理中" :value="stats.activeCount" color="#F5A623" @click="$router.push('/orders')" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="WarningFilled" label="待处理退款" :value="stats.refundAlertCount" color="#F56C6C" @click="$router.push('/orders')" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="Money" label="今日营收" :value="'¥' + stats.todayRevenue" color="#67C23A" />
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <StatCard icon="Document" label="今日订单" :value="stats.todayOrders" color="#409EFF" />
      </el-col>
      <el-col :span="12">
        <!-- 占位，保持对齐 -->
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <el-card>
          <template #header><span>快捷操作</span></template>
          <el-space wrap :size="12">
            <el-button type="primary" @click="$router.push('/orders')">
              <el-icon><List /></el-icon> 订单管理
            </el-button>
            <el-button type="success" @click="$router.push('/products')">
              <el-icon><Goods /></el-icon> 商品管理
            </el-button>
            <el-button type="warning" @click="$router.push('/operations')">
              <el-icon><DataAnalysis /></el-icon> 运营数据
            </el-button>
            <el-button @click="$router.push('/numbers')">
              <el-icon><CollectionTag /></el-icon> 号码牌
            </el-button>
            <el-button @click="$router.push('/settings/store')">
              <el-icon><Setting /></el-icon> 店铺设置
            </el-button>
            <el-button @click="$router.push('/banners')">
              <el-icon><PictureFilled /></el-icon> 广告管理
            </el-button>
          </el-space>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>最近订单</span></template>
          <el-table :data="recentOrders" size="small" style="width:100%" @row-click="onRowClick" row-style="cursor:pointer">
            <el-table-column prop="orderNo" label="订单号" width="150" />
            <el-table-column prop="statusText" label="状态" width="80">
              <template #default="{ row }">
                <OrderStatusTag :status="row.status" :type="row.type" />
              </template>
            </el-table-column>
            <el-table-column label="金额" width="100">
              <template #default="{ row }">¥{{ formatMoney(row.actualAmount || row.prepayAmount || 0) }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="时间" min-width="140">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import { useNotification } from '@/composables/useNotification'
import StatCard from '@/components/StatCard.vue'
import OrderStatusTag from '@/components/OrderStatusTag.vue'

const router = useRouter()
const { notify, requestPermission } = useNotification()
const stats = reactive({ pendingCount: 0, activeCount: 0, refundAlertCount: 0, todayRevenue: '0.00', todayOrders: 0 })
const recentOrders = ref([])

// 上次轮询值（用于检测增量触发通知）
let lastPendingCount = 0
let lastRefundCount = 0
let _pollTimer = null
const POLL_INTERVAL = 30000 // 30 秒轮询一次

function formatMoney(fen) { return (fen / 100).toFixed(2) }
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return d.getMonth() + 1 + '-' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function getStatusText(status, type) {
  if (type === 'offline') {
    const m = { pending: '待处理', processing: '处理中', ready: '待取货', completed: '已完成', cancelled: '已取消' }
    return m[status] || status
  }
  const m = { pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重', processing: '处理中', ready: '待取货', delivering: '配送中', completed: '已完成', cancelled: '已取消' }
  return m[status] || status
}

function onRowClick(row) {
  router.push('/orders/' + row.orderNo)
}

// 加载仪表盘数据
async function loadDashboard() {
  try {
    const [paidRes, activeRes, refundAlertRes] = await Promise.all([
      api.get('/merchant/orders', { status: 'paid', pageSize: 200, type: 'online' }),
      api.get('/merchant/orders', { status: 'accepted,weighed,processing,delivering,ready', pageSize: 200, type: 'online' }),
      api.get('/merchant/refund-alerts', { type: 'count' })
    ])
    const newPendingCount = ((paidRes && paidRes.data && paidRes.data.orders) || []).length
    const newActiveCount = ((activeRes && activeRes.data && activeRes.data.orders) || []).length
    const newRefundCount = (refundAlertRes && refundAlertRes.data && refundAlertRes.data.count) || 0

    // 检测新订单增量 → 系统通知（跳过首次加载）
    if (lastPendingCount > 0 && newPendingCount > lastPendingCount) {
      const delta = newPendingCount - lastPendingCount
      notify('新订单提醒', `有 ${delta} 个新订单待接单`)
    }
    if (lastRefundCount > 0 && newRefundCount > lastRefundCount) {
      const delta = newRefundCount - lastRefundCount
      notify('退款告警', `有 ${delta} 个新退款申请待处理`)
    }

    lastPendingCount = newPendingCount
    lastRefundCount = newRefundCount
    stats.pendingCount = newPendingCount
    stats.activeCount = newActiveCount
    stats.refundAlertCount = newRefundCount
  } catch (err) {
    console.error('加载仪表盘失败:', err)
  }

  try {
    const res = await api.get('/merchant/orders', { pageSize: 5 })
    const orders = (res && res.data && res.data.orders) || []
    recentOrders.value = orders.map(o => ({ ...o, statusText: getStatusText(o.status, o.type) }))
  } catch (err) { console.error('加载最近订单失败:', err) }
}

onMounted(async () => {
  // 请求通知权限（首次由用户手势触发）
  await requestPermission()

  // 首次加载
  await loadDashboard()

  // 启动轮询
  _pollTimer = setInterval(loadDashboard, POLL_INTERVAL)
})

onUnmounted(() => {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
})
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #333; margin-bottom: 20px; }
.stats-row { margin-bottom: 0; }
</style>
