<template>
  <div class="stat-bar">
    <div class="stat-brand">
      <span class="stat-brand-name">小鲜鸡 · 收银</span>
    </div>
    <n-space :size="24" align="center">
      <div class="stat-item">
        <span class="stat-label">今日营收</span>
        <span class="stat-value revenue">¥{{ stats.revenue }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">今日订单</span>
        <span class="stat-value">{{ stats.orderCount }} 单</span>
      </div>
      <n-divider vertical />
      <span class="stat-clock">{{ timeStr }}</span>
    </n-space>
    <n-button text color="#fff" @click="$emit('logout')" style="margin-left:auto">登出</n-button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { NSpace, NDivider, NButton } from 'naive-ui'

const props = defineProps({
  stats: { type: Object, default: () => ({ revenue: '0.00', orderCount: 0 }) }
})
defineEmits(['logout'])

const timeStr = ref('')

function updateTime() {
  const d = new Date()
  timeStr.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
let timer = null
onMounted(() => { updateTime(); timer = setInterval(updateTime, 10000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.stat-bar {
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 56px;
  background: linear-gradient(135deg, #D4420A, #C0392B);
  color: #fff;
  flex-shrink: 0;
}
.stat-brand-name {
  font-size: 16px;
  font-weight: 700;
  margin-right: 32px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-label {
  font-size: 11px;
  opacity: 0.8;
}
.stat-value {
  font-size: 15px;
  font-weight: 600;
}
.stat-value.revenue {
  color: #FFD166;
}
.stat-clock {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
