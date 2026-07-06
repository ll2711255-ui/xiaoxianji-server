<template>
  <div class="amount-area">
    <div class="amount-display">
      <span class="amount-currency">¥</span>
      <span class="amount-value" :class="{ placeholder: !amount }">{{ amount || '0.00' }}</span>
    </div>
    <div class="amount-input-row">
      <n-input
        ref="inputRef"
        v-model:value="inputValue"
        placeholder="输入金额，支持小数点"
        size="large"
        :input-props="{ inputmode: 'decimal', autofocus: true }"
        @update:value="onInput"
        @keyup.enter="$emit('submit')"
        clearable
      />
    </div>
    <!-- 数字键盘 -->
    <div class="numpad">
      <div class="numpad-row" v-for="row in keyRows" :key="row[0]">
        <button
          v-for="key in row"
          :key="key"
          class="numpad-key"
          :class="{
            'key-func': key === '⌫' || key === '清除',
            'key-submit': key === '确认'
          }"
          @click="onKeyPress(key)"
        >
          {{ key }}
        </button>
      </div>
    </div>
    <!-- 付款方式 -->
    <div class="payment-types">
      <n-button
        :type="paymentType === 'cash' ? 'warning' : 'default'"
        size="large"
        @click="$emit('update:paymentType', 'cash')"
        style="flex:1"
      >
        现金
      </n-button>
      <n-button
        :type="paymentType === 'wechat' ? 'info' : 'default'"
        size="large"
        @click="$emit('update:paymentType', 'wechat')"
        style="flex:1"
      >
        微信支付
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { NInput, NButton } from 'naive-ui'

const props = defineProps({
  amount: { type: String, default: '' },
  paymentType: { type: String, default: 'cash' }
})
const emit = defineEmits(['update:amount', 'update:paymentType', 'submit'])

const inputRef = ref(null)
const inputValue = ref(props.amount)

watch(() => props.amount, (v) => {
  if (inputValue.value !== v) inputValue.value = v
})

function onInput(v) {
  // 只允许数字和小数点，最多两位小数
  let filtered = v.replace(/[^0-9.]/g, '')
  // 只允许一个小数点
  const parts = filtered.split('.')
  if (parts.length > 1) {
    filtered = parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
  }
  if (filtered !== v) {
    inputValue.value = filtered
  }
  emit('update:amount', filtered)
}

const keyRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
  ['清除', '确认']
]

function onKeyPress(key) {
  if (key === '确认') { emit('submit'); return }
  if (key === '清除') { inputValue.value = ''; emit('update:amount', ''); return }
  if (key === '⌫') {
    const v = inputValue.value.slice(0, -1)
    inputValue.value = v
    emit('update:amount', v)
    return
  }
  // 数字或小数点
  let next = inputValue.value + key
  // 验证格式
  if (key === '.') {
    if (inputValue.value.includes('.')) return
    if (!inputValue.value) next = '0.'
  }
  const parts = next.split('.')
  if (parts.length > 1 && parts[1].length > 2) return
  inputValue.value = next
  emit('update:amount', next)
}
</script>

<style scoped>
.amount-area {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.amount-display {
  text-align: center;
  padding: 20px 16px 8px;
  background: linear-gradient(135deg, #D4420A, #E55A2A);
  border-radius: 8px;
  margin-bottom: 12px;
}
.amount-currency {
  font-size: 28px;
  color: rgba(255,255,255,0.7);
  margin-right: 4px;
}
.amount-value {
  font-size: 52px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.amount-value.placeholder {
  opacity: 0.6;
}
.amount-input-row {
  margin-bottom: 12px;
}
.payment-types {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.numpad {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
}
.numpad-row {
  display: flex;
  gap: 6px;
}
.numpad-key {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: 6px;
  background: #f0f0f0;
  font-size: 20px;
  font-weight: 500;
  cursor: pointer;
  color: #333;
  transition: background 0.1s;
}
.numpad-key:hover { background: #e0e0e0; }
.numpad-key:active { background: #d0d0d0; }
.numpad-key.key-func { background: #e8e8e8; font-size: 14px; }
.numpad-key.key-submit {
  flex: 2;
  background: linear-gradient(135deg, #D4420A, #E55A2A);
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}
.numpad-key.key-submit:hover { background: linear-gradient(135deg, #C0392B, #D4420A); }
</style>
