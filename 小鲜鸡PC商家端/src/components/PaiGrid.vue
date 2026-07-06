<template>
  <div class="pai-grid">
    <div class="pai-header">
      <span class="pai-title">号码牌</span>
      <n-tag size="small" type="success">{{ idleCount }} 空闲</n-tag>
      <n-tag size="small" type="warning">{{ inUseCount }} 使用中</n-tag>
    </div>
    <div class="pai-grid-inner">
      <button
        v-for="pai in numbers"
        :key="pai._id"
        class="pai-chip"
        :class="{
          'status-idle': pai.status === 'idle',
          'status-in_use': pai.status === 'in_use',
          'status-used': pai.status === 'used',
          selected: pai.status === 'idle' && selectedCard === pai.number
        }"
        :disabled="pai.status !== 'idle'"
        @click="onSelect(pai)"
        :title="pai.status === 'in_use' ? pai.orderNo || '' : ''"
      >
        {{ pai.number }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NTag } from 'naive-ui'

const props = defineProps({
  numbers: { type: Array, default: () => [] },
  selectedCard: { type: String, default: '' }
})
const emit = defineEmits(['update:selectedCard', 'select'])

const idleCount = computed(() => props.numbers.filter(n => n.status === 'idle').length)
const inUseCount = computed(() => props.numbers.filter(n => n.status === 'in_use').length)

function onSelect(pai) {
  if (pai.status !== 'idle') return
  const next = props.selectedCard === pai.number ? '' : pai.number
  emit('update:selectedCard', next)
  emit('select', pai)
}
</script>

<style scoped>
.pai-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.pai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.pai-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-right: auto;
}
.pai-grid-inner {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}
.pai-chip {
  aspect-ratio: 1;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.pai-chip.status-idle {
  color: #333;
  border-color: #d0d0d0;
}
.pai-chip.status-idle:hover {
  border-color: #D4420A;
  background: #FFF0EB;
  color: #D4420A;
  transform: scale(1.05);
}
.pai-chip.status-in_use {
  border-color: #F5A623;
  background: #FFF8EC;
  color: #F5A623;
  cursor: not-allowed;
}
.pai-chip.status-used {
  border-color: #e0e0e0;
  background: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
}
.pai-chip.selected {
  border-color: #D4420A;
  background: #D4420A;
  color: #fff;
  box-shadow: 0 2px 8px rgba(212,66,10,0.3);
}
.pai-chip:disabled { cursor: not-allowed; }
</style>
