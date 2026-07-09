<template>
  <div
    class="order-card"
    :class="{ 'order-card--urgent': isUrgent }"
    @click="$emit('click', order)"
    @longpress="onLongPress"
  >
    <!-- 顶行：订单号 + 状态 -->
    <div class="card-top">
      <span class="card-order-no">{{ order.orderNo }}</span>
      <el-tag :type="statusType" size="small" effect="dark">
        {{ statusLabel }}
      </el-tag>
    </div>

    <!-- 中间：商品摘要 + 金额 -->
    <div class="card-body">
      <div class="card-items">
        <template v-if="order.items && order.items.length">
          <span v-for="(item, i) in order.items.slice(0, 3)" :key="i" class="card-item-tag">
            {{ item.productName || item.name }}×{{ item.quantity || 1 }}
          </span>
          <span v-if="order.items.length > 3" class="card-item-more">
            +{{ order.items.length - 3 }}件
          </span>
        </template>
        <span v-else class="card-no-items">线下订单 — 待称重录入</span>
      </div>
      <div class="card-amount">
        <span class="card-amount-symbol">¥</span>
        <span class="card-amount-value">{{ formatMoney(order.actualAmount || order.payAmount || 0) }}</span>
      </div>
    </div>

    <!-- 底行：类型 + 号码牌 + 时间 + 操作 -->
    <div class="card-bottom">
      <div class="card-meta">
        <el-tag size="small" :type="order.type === 'offline' ? 'warning' : 'info'" effect="plain">
          {{ order.type === 'offline' ? '线下' : order.type === 'pickup' ? '自取' : '配送' }}
        </el-tag>
        <span v-if="order.cardNumber" class="card-number">🏷 {{ order.cardNumber }}</span>
        <span class="card-time">{{ formatTime(order.createTime) }}</span>
      </div>
      <div v-if="actions && actions.length" class="card-actions" @click.stop>
        <el-button
          v-for="btn in actions"
          :key="btn.action"
          :type="btn.type || 'primary'"
          size="small"
          round
          @click="$emit('action', { order, action: btn.action })"
        >
          {{ btn.label }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  order: { type: Object, required: true },
  actions: { type: Array, default: () => [] },  // [{ label, action, type }]
  isUrgent: { type: Boolean, default: false }     // 紧急订单高亮
})

defineEmits(['click', 'action', 'longpress'])

const statusLabel = computed(() => {
  const m = {
    pending: '待支付', paid: '待接单', accepted: '已接单',
    weighed: '已称重', processing: '处理中', ready: '待取货',
    delivering: '配送中', completed: '已完成', cancelled: '已取消'
  }
  return m[props.order.status] || props.order.status || '未知'
})

const statusType = computed(() => {
  const m = {
    pending: 'warning', paid: 'danger', accepted: 'primary',
    weighed: '', processing: '', ready: 'success',
    delivering: '', completed: 'info', cancelled: 'info'
  }
  return m[props.order.status] || ''
})

function formatMoney(fen) { return (fen / 100).toFixed(2) }

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return Math.floor(diffMs / 60000) + '分钟前'
  if (diffMs < 86400000 && d.getDate() === now.getDate()) {
    return '今天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function onLongPress() {
  // 长按触发快捷操作菜单
  // （emit 到父组件处理，父组件可弹 ActionSheet）
}
</script>

<style scoped>
.order-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition: transform 0.1s, box-shadow 0.15s;
  border-left: 3px solid transparent;
}
.order-card:active {
  transform: scale(0.985);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.order-card--urgent {
  border-left-color: #F56C6C;
  background: #FFF5F5;
}

/* 顶行 */
.card-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.card-order-no {
  font-size: 15px; font-weight: 700; color: #222;
  font-family: 'SF Mono', 'Menlo', monospace;
}

/* 中间 */
.card-body {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 10px; gap: 12px;
}
.card-items {
  flex: 1; display: flex; flex-wrap: wrap; gap: 6px;
  min-height: 24px;
}
.card-item-tag {
  background: #f0f0f0; color: #555;
  font-size: 12px; padding: 2px 8px; border-radius: 4px;
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.card-item-more {
  font-size: 12px; color: #999; line-height: 24px;
}
.card-no-items {
  font-size: 12px; color: #999; font-style: italic;
}
.card-amount {
  flex-shrink: 0; text-align: right;
}
.card-amount-symbol {
  font-size: 13px; font-weight: 600; color: #D4420A;
}
.card-amount-value {
  font-size: 20px; font-weight: 700; color: #D4420A;
}

/* 底行 */
.card-bottom {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px;
}
.card-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.card-number {
  font-size: 12px; color: #666;
}
.card-time {
  font-size: 12px; color: #999;
}
.card-actions {
  display: flex; gap: 6px;
}
.card-actions .el-button {
  min-height: 32px; /* iOS 触摸 44px 推荐底线，32px 是兼顾视觉 */
  font-size: 13px;
}
</style>
