<template>
  <el-tooltip v-if="props.cancelReason" :content="'取消原因：' + props.cancelReason + '  |  取消方：' + cancelByLabel" placement="top">
    <el-tag :type="tagType" :size="size" disable-transitions>
      {{ text }}
    </el-tag>
  </el-tooltip>
  <el-tag v-else :type="tagType" :size="size" disable-transitions>
    {{ text }}
  </el-tag>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  type: { type: String, default: 'online' },
  size: { type: String, default: 'default' },
  cancelReason: { type: String, default: '' },
  cancelBy: { type: String, default: '' },
})

const cancelByLabel = computed(() => {
  const map = { user: '用户', merchant: '商家', system: '系统超时' }
  return map[props.cancelBy] || props.cancelBy
})

const tagType = computed(() => {
  if (props.type === 'offline') {
    const map = { pending: 'info', processing: 'warning', ready: '', completed: 'success', cancelled: 'danger' }
    return map[props.status] || 'info'
  }
  const map = { pending: 'info', paid: '', accepted: 'warning', weighed: 'warning', processing: '', ready: 'success', delivering: '', completed: 'success', cancelled: 'danger', refundFailed: 'danger' }
  return map[props.status] || 'info'
})

const text = computed(() => {
  if (props.type === 'offline') {
    const map = { pending: '待处理', processing: '处理中', ready: '待取货', completed: '已完成', cancelled: '已取消' }
    return map[props.status] || props.status
  }
  const map = {
    pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重',
    processing: '处理中', ready: '待取货', delivering: '配送中', completed: '已完成',
    cancelled: '已取消', refundFailed: '退款异常'
  }
  return map[props.status] || props.status
})
</script>
