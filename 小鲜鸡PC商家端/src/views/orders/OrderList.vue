<template>
  <div>
    <h2 class="page-title">订单管理</h2>

    <!-- 线上/线下切换 -->
    <el-segmented v-model="segment" :options="segmentOptions" @change="onSegmentChange" size="large" style="margin-bottom:16px" />

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-mini" v-if="segment === 'online'">
      <el-col :span="4" v-for="s in onlineStats" :key="s.key">
        <div class="stat-mini-card" :class="{ active: tabIndex === s.tabIdx }" @click="tabIndex = s.tabIdx; loadOrders()">
          <div class="stat-mini-num">{{ s.count }}</div>
          <div class="stat-mini-label">{{ s.label }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 线上 Tab -->
    <el-tabs v-if="segment === 'online'" v-model="tabIndex" @tab-change="loadOrders" type="card">
      <el-tab-pane v-for="(t, i) in onlineTabs" :key="i" :label="t + ' (' + getOnlineCount(i) + ')'" :name="i" />
    </el-tabs>

    <!-- 线下 Tab -->
    <el-tabs v-if="segment === 'offline'" v-model="offlineTab" @tab-change="loadOrders" type="card">
      <el-tab-pane v-for="(t, i) in ['待处理', '处理中', '待取货', '已完成']" :key="i" :label="t" :name="i" />
    </el-tabs>

    <el-table :data="orders" v-loading="loading" stripe style="width:100%" @row-click="onRowClick" row-style="cursor:pointer">
      <el-table-column prop="orderNo" label="订单号" width="160" />
      <el-table-column label="类型" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="row.type === 'offline' ? 'warning' : 'info'">
            {{ row.type === 'offline' ? '线下' : row.type === 'pickup' ? '自取' : '配送' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><OrderStatusTag :status="row.status" :type="row.type" size="small" :cancelReason="row.cancelReason" :cancelBy="row.cancelBy" /></template>
      </el-table-column>
      <el-table-column label="号码牌" width="80">
        <template #default="{ row }">{{ row.cardNumber || '-' }}</template>
      </el-table-column>
      <el-table-column label="商品" min-width="160">
        <template #default="{ row }">
          <span v-if="row.items && row.items.length">
            {{ row.items.map(i => i.productName + 'x' + (i.quantity || 1)).join('、') }}
          </span>
          <span v-else class="text-muted">线下订单</span>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ formatMoney(row.actualAmount || row.payAmount || 0) }}</template>
      </el-table-column>
      <el-table-column label="时间" width="160">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button-group>
            <template v-for="btn in getActions(row)" :key="btn.action">
              <el-popconfirm
                v-if="btn.action === 'cancel-accept'"
                title="确认取消接单？将全额退款给用户"
                confirm-button-text="确认取消"
                cancel-button-text="不操作"
                @confirm="onAction(row, btn.action)"
              >
                <template #reference>
                  <el-button size="small" :type="btn.type" @click.stop>{{ btn.label }}</el-button>
                </template>
              </el-popconfirm>
              <el-button v-else size="small" :type="btn.type" @click.stop="onAction(row, btn.action)">
                {{ btn.label }}
              </el-button>
            </template>
          </el-button-group>
          <el-button size="small" link type="primary" @click.stop="onRowClick(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && orders.length === 0" description="暂无订单" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import { useSocket } from '@/composables/useSocket'
import { useNotification } from '@/composables/useNotification'
import OrderStatusTag from '@/components/OrderStatusTag.vue'

const router = useRouter()
const { onNewPaidOrder } = useSocket()
const { notify } = useNotification()

const segment = ref('online')
const segmentOptions = [
  { label: '线上订单', value: 'online' },
  { label: '线下订单', value: 'offline' }
]

const onlineTabs = ['新订单', '称重挂牌', '处理中', '配送/待取货', '已完成', '退款异常']
const tabStatusMap = [
  ['paid'], ['accepted'], ['weighed', 'processing'], ['ready', 'delivering'], ['completed'], ['refundFailed']
]
const offlineStatusMap = [['pending'], ['processing'], ['ready'], ['completed']]

const tabIndex = ref(0)
const offlineTab = ref(0)
const orders = ref([])
const loading = ref(false)
const onlineStats = reactive([
  { key: 'paid', label: '新订单', count: 0, tabIdx: 0 },
  { key: 'accepted', label: '称重挂牌', count: 0, tabIdx: 1 },
  { key: 'processing', label: '处理中', count: 0, tabIdx: 2 },
  { key: 'delivering', label: '配送/待取货', count: 0, tabIdx: 3 },
  { key: 'completed', label: '已完成', count: 0, tabIdx: 4 },
  { key: 'refundFailed', label: '退款异常', count: 0, tabIdx: 5 }
])

function formatMoney(fen) { return (fen / 100).toFixed(2) }
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function getOnlineCount(i) {
  const key = ['paid', 'accepted', 'processing', 'delivering', 'completed', 'refundFailed'][i]
  const stat = onlineStats.find(s => s.key === key)
  return stat ? stat.count : 0
}

function getActions(order) {
  const s = order.status
  const t = order.type
  const actions = []

  if (t !== 'offline') {
    if (s === 'paid') {
      actions.push({ action: 'accept', label: '接单', type: 'primary' })
      actions.push({ action: 'cancel-accept', label: '取消接单', type: 'danger' })
    }
    if (s === 'accepted' || s === 'weighed') actions.push({ action: 'process', label: '开始处理', type: 'warning' })
    if (s === 'weighed' || s === 'processing') {
      actions.push({ action: 'ready', label: '备货完成', type: 'success' })
    }
    if (s === 'ready') {
      if (order.type === 'delivery') actions.push({ action: 'deliver', label: '开始配送', type: 'success' })
      else actions.push({ action: 'complete', label: '完成', type: 'success' })
    }
    if (s === 'delivering') actions.push({ action: 'complete', label: '确认送达', type: 'success' })
    if (s === 'pending') actions.push({ action: 'mark-paid', label: '标记已付', type: 'warning' })
  } else {
    if (s === 'pending') actions.push({ action: 'process', label: '开始处理', type: 'primary' })
    if (s === 'processing') actions.push({ action: 'ready', label: '待取货', type: 'success' })
    if (s === 'ready') actions.push({ action: 'complete', label: '完成', type: 'success' })
  }
  return actions
}

async function onAction(order, action) {
  // cancel-accept 已在模板中通过 el-popconfirm 确认，直接执行
  if (action !== 'cancel-accept') {
    const labels = { accept: '接单', process: '开始处理', deliver: '开始配送', ready: '标记待取货', complete: '确认完成', 'mark-paid': '标记已支付' }
    try {
      await ElMessageBox.confirm(`确定对订单 ${order.orderNo} 执行「${labels[action]}」操作吗？`, '确认操作', { type: 'info' })
    } catch { return }
  }

  try {
    const url = action === 'cancel-accept'
      ? '/merchant/orders/' + order.orderNo + '/cancel-accept'
      : '/merchant/orders/' + order.orderNo + '/' + action
    const res = await api.post(url, action === 'cancel-accept' ? { reason: '商家取消接单' } : undefined)
    if (res && res.success) {
      ElMessage.success((res && res.message) || '操作成功')
      loadOrders()
      loadStats()
    } else {
      ElMessage.error((res && res.message) || '操作失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '操作失败')
  }
}

function onRowClick(row) {
  router.push('/orders/' + row.orderNo)
}

function onSegmentChange() {
  if (segment.value === 'online') { tabIndex.value = 0; loadOrders(); loadStats() }
  else { offlineTab.value = 0; loadOrders() }
}

async function loadOrders() {
  loading.value = true
  try {
    let params = {}
    if (segment.value === 'online') {
      params = { status: tabStatusMap[tabIndex.value].join(','), type: 'delivery,pickup', pageSize: 50 }
    } else {
      params = { status: offlineStatusMap[offlineTab.value].join(','), type: 'offline', pageSize: 50 }
    }
    const res = await api.get('/merchant/orders', params)
    orders.value = (res && res.data && res.data.orders) || []
  } catch (err) { console.error('加载订单失败:', err) }
  loading.value = false
}

async function loadStats() {
  try {
    const results = await Promise.all([
      api.get('/merchant/orders', { status: 'paid', pageSize: 100, type: 'delivery,pickup' }),
      api.get('/merchant/orders', { status: 'accepted', pageSize: 100, type: 'delivery,pickup' }),
      api.get('/merchant/orders', { status: 'weighed,processing', pageSize: 100, type: 'delivery,pickup' }),
      api.get('/merchant/orders', { status: 'ready,delivering', pageSize: 100, type: 'delivery,pickup' }),
      api.get('/merchant/orders', { status: 'completed', pageSize: 100, type: 'delivery,pickup' }),
      api.get('/merchant/orders', { status: 'refundFailed', pageSize: 100, type: 'delivery,pickup' })
    ])
    onlineStats[0].count = ((results[0] && results[0].data && results[0].data.orders) || []).length
    onlineStats[1].count = ((results[1] && results[1].data && results[1].data.orders) || []).length
    onlineStats[2].count = ((results[2] && results[2].data && results[2].data.orders) || []).length
    onlineStats[3].count = ((results[3] && results[3].data && results[3].data.orders) || []).length
    onlineStats[4].count = ((results[4] && results[4].data && results[4].data.orders) || []).length
    onlineStats[5].count = ((results[5] && results[5].data && results[5].data.orders) || []).length
  } catch (err) { console.error('加载统计失败:', err) }
}

// 新订单推送处理
function handleNewPaidOrder(order) {
  // 更新对应统计计数
  onlineStats[0].count++
  // 如果不在"新订单"tab，弹出通知
  if (tabIndex.value !== 0) {
    notify("🔔 新订单提醒", `订单 ${order.orderNo} 已支付（¥${(order.payAmount / 100).toFixed(2)}）`, {
      vibrate: true, sound: true,
      onClick: () => { tabIndex.value = 0; loadOrders(); loadStats() },
    })
  } else {
    // 在"新订单"tab → 自动刷新列表
    loadOrders()
    loadStats()
  }
}

let _unsubNewOrder = null
onMounted(() => {
  loadOrders(); loadStats()
  _unsubNewOrder = onNewPaidOrder(handleNewPaidOrder)
})
onUnmounted(() => {
  if (_unsubNewOrder) _unsubNewOrder()
})
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #333; margin-bottom: 20px; }
.stat-mini { margin-bottom: 12px; }
.stat-mini-card {
  background: #fff; border-radius: 8px; padding: 12px; text-align: center;
  cursor: pointer; border: 2px solid transparent; transition: all 0.2s;
}
.stat-mini-card:hover, .stat-mini-card.active { border-color: #D4420A; background: #FFF8F5; }
.stat-mini-num { font-size: 22px; font-weight: 700; color: #D4420A; }
.stat-mini-label { font-size: 12px; color: #999; margin-top: 2px; }
.text-muted { color: #ccc; font-size: 12px; }
</style>
