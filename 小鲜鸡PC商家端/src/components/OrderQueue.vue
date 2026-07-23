<template>
  <div class="order-queue">
    <n-tabs v-model:value="activeTab" type="line" size="medium" @update:value="onTabChange">
      <n-tab-pane name="all" tab="全部" />
      <n-tab-pane name="pending" tab="待处理">
        <template #tab>
          <n-badge :value="pendingCount" :max="99" v-if="pendingCount > 0">
            <span style="padding-right:4px">待处理</span>
          </n-badge>
          <span v-else>待处理</span>
        </template>
      </n-tab-pane>
      <n-tab-pane name="active" tab="处理中">
        <template #tab>
          <n-badge :value="activeCount" :max="99" v-if="activeCount > 0">
            <span style="padding-right:4px">处理中</span>
          </n-badge>
          <span v-else>处理中</span>
        </template>
      </n-tab-pane>
      <n-tab-pane name="completed" tab="已完成" />
    </n-tabs>

    <div class="order-list" v-if="filteredOrders.length > 0">
      <div
        v-for="order in filteredOrders"
        :key="order._id"
        class="order-card"
        :class="{ 'is-online': order.type !== 'offline', 'is-offline': order.type === 'offline' }"
      >
        <div class="order-card-top">
          <n-tag :type="order.type === 'offline' ? 'warning' : 'info'" size="small">
            {{ order.type === 'offline' ? '线下' : order.type === 'pickup' ? '自取' : '配送' }}
          </n-tag>
          <span class="order-card-no">{{ order.orderNo }}</span>
          <span class="order-card-price">¥{{ formatMoney(order.actualAmount || order.payAmount) }}</span>
        </div>
        <div class="order-card-mid">
          <span v-if="order.items && order.items[0]">{{ order.items[0].productName }}</span>
          <span v-else class="no-item">无商品明细</span>
          <span class="order-card-card" v-if="order.cardNumber">
            <n-tag size="tiny" :bordered="false" type="warning">#{{ order.cardNumber }}</n-tag>
          </span>
        </div>
        <div class="order-card-bottom">
          <n-tag :type="statusTagType(order.status)" size="tiny" :bordered="false">
            {{ statusText(order.status, order.type) }}
          </n-tag>
          <span class="order-card-time">{{ formatTime(order.createTime) }}</span>
          <div class="order-card-actions">
            <n-button
              v-for="btn in getActions(order)"
              :key="btn.action"
              :type="btn.type"
              size="tiny"
              :secondary="btn.secondary"
              @click="$emit('action', order, btn.action)"
            >
              {{ btn.label }}
            </n-button>
          </div>
        </div>
      </div>
    </div>
    <n-empty v-else description="暂无订单" style="margin-top:40px" />

    <!-- 底部操作按钮 -->
    <div class="queue-footer" v-if="showFooterActions">
      <n-space>
        <n-button size="small" @click="$emit('action', null, 'processAll')" :disabled="activeCount === 0">
          全部进入处理中
        </n-button>
        <n-button size="small" type="primary" @click="$emit('action', null, 'completeReady')">
          待取货 → 完成
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NTabs, NTabPane, NBadge, NTag, NButton, NSpace, NEmpty } from 'naive-ui'

const props = defineProps({
  orders: { type: Array, default: () => [] }
})
defineEmits(['action'])

const activeTab = ref('all')

const pendingCount = computed(() => props.orders.filter(o => o.status === 'pending' && o.type === 'offline').length)
const activeCount = computed(() => props.orders.filter(o => ['processing', 'ready', 'accepted', 'weighed'].includes(o.status)).length)
const showFooterActions = computed(() => activeTab.value === 'all' || activeTab.value === 'pending' || activeTab.value === 'active')

const filteredOrders = computed(() => {
  let list = props.orders
  if (activeTab.value === 'pending') {
    list = list.filter(o => o.status === 'pending' && o.type === 'offline')
  } else if (activeTab.value === 'active') {
    list = list.filter(o => ['processing', 'ready', 'accepted', 'weighed'].includes(o.status))
  } else if (activeTab.value === 'completed') {
    list = list.filter(o => o.status === 'completed')
  }
  return list
})

function onTabChange() {}

function formatMoney(fen) { return (fen / 100).toFixed(2) }

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function statusText(status, type) {
  if (type === 'offline') {
    const map = { pending: '待处理', processing: '处理中', ready: '待取货', completed: '已完成' }
    return map[status] || status
  }
  const map = { pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重', processing: '处理中', ready: '待取货', delivering: '配送中', completed: '已完成' }
  return map[status] || status
}

function statusTagType(status) {
  const map = { pending: 'default', paid: 'info', accepted: 'info', weighed: 'warning', processing: 'warning', ready: 'success', delivering: 'info', completed: 'default' }
  return map[status] || 'default'
}

function getActions(order) {
  const actions = []
  if (!order) return actions

  if (order.type === 'offline') {
    if (order.status === 'pending') {
      actions.push({ action: 'process', label: '开始处理', type: 'warning', secondary: false })
    } else if (order.status === 'processing') {
      actions.push({ action: 'ready', label: '准备取货', type: 'success', secondary: false })
    } else if (order.status === 'ready') {
      actions.push({ action: 'complete', label: '完成', type: 'primary', secondary: false })
    }
  } else { // 线上订单 (delivery / pickup)
    if (order.status === 'paid') {
      actions.push({ action: 'accept', label: '接单', type: 'info', secondary: false })
    } else if (order.status === 'accepted') {
      actions.push({ action: 'weighNav', label: '称重', type: 'warning', secondary: false })
    } else if (order.status === 'weighed') {
      actions.push({ action: 'process', label: '处理', type: 'warning', secondary: false })
    } else if (order.status === 'processing') {
      actions.push({ action: 'ready', label: '备好', type: 'success', secondary: false })
    } else if (order.status === 'ready') {
      actions.push({ action: 'deliver', label: '配送', type: 'primary', secondary: false })
    } else if (order.status === 'delivering') {
      actions.push({ action: 'complete', label: '完成', type: 'primary', secondary: false })
    }
  }
  return actions
}
</script>

<style scoped>
.order-queue {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.order-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}
.order-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px 12px;
  border-left: 3px solid #ddd;
}
.order-card.is-online { border-left-color: #409EFF; }
.order-card.is-offline { border-left-color: #F5A623; }
.order-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.order-card-no {
  font-size: 12px;
  color: #999;
  flex: 1;
}
.order-card-price {
  font-size: 16px;
  font-weight: 700;
  color: #D4420A;
}
.order-card-mid {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  margin-bottom: 6px;
}
.no-item { color: #ccc; font-style: italic; }
.order-card-card { margin-left: auto; }
.order-card-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}
.order-card-time {
  font-size: 11px;
  color: #bbb;
  flex: 1;
}
.order-card-actions {
  display: flex;
  gap: 4px;
}
.queue-footer {
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}
</style>
