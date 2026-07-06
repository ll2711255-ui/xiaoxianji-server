<template>
  <n-modal v-model:show="showModal" :mask-closable="false" preset="card" title="小票预览" style="width:380px" :bordered="false">
    <div class="receipt" id="receipt-print-area">
      <div class="receipt-inner">
        <h2 class="receipt-shop">{{ shopName }}</h2>
        <p class="receipt-sub">鲜鸡现宰 · 新鲜直达</p>
        <div class="receipt-divider">──────────────────</div>
        <p class="receipt-type-label">【{{ orderTypeLabel }}】</p>
        <div class="receipt-info">
          <div class="receipt-row">
            <span class="receipt-label">订单号</span>
            <span class="receipt-value">{{ data.orderNo }}</span>
          </div>
          <div class="receipt-row" v-if="data.cardNumber">
            <span class="receipt-label">号码牌</span>
            <span class="receipt-value receipt-badge">{{ data.cardNumber }}</span>
          </div>
          <div class="receipt-row" v-if="!isWeigh">
            <span class="receipt-label">支付方式</span>
            <span class="receipt-value">{{ data.paymentLabel }}</span>
          </div>
          <template v-if="isWeigh">
            <div class="receipt-row">
              <span class="receipt-label">商品</span>
              <span class="receipt-value">{{ data.productName }}</span>
            </div>
            <div class="receipt-row" v-if="data.specSummary">
              <span class="receipt-label">规格</span>
              <span class="receipt-value">{{ data.specSummary }}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">实际重量</span>
              <span class="receipt-value">{{ data.actualWeightJin }} 斤（{{ data.actualWeightGrams }}克）</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">单价</span>
              <span class="receipt-value">¥{{ data.pricePerJinYuan }}/斤</span>
            </div>
          </template>
          <div class="receipt-row receipt-row-total">
            <span class="receipt-label">金额</span>
            <span class="receipt-value receipt-price">{{ isWeigh ? '¥' + data.actualAmountYuan : '¥' + data.amountYuan }}</span>
          </div>
          <div class="receipt-row" v-if="isWeigh && data.hasRefund">
            <span class="receipt-label">退款</span>
            <span class="receipt-value" style="color:#67C23A">¥{{ data.refundAmountYuan }}</span>
          </div>
        </div>
        <div class="receipt-divider">──────────────────</div>
        <div class="receipt-badge-area" v-if="data.cardNumber">
          <span class="receipt-badge-num">{{ data.cardNumber }}</span>
          <span class="receipt-badge-label">号</span>
          <p class="receipt-badge-tip">凭号码牌到前台取货</p>
        </div>
        <div class="receipt-divider">──────────────────</div>
        <div class="receipt-qr-area">
          <p class="receipt-qr-label">扫码查看取货状态</p>
          <div class="receipt-qr-placeholder">[ QR码 ]</div>
        </div>
        <div class="receipt-divider">──────────────────</div>
        <p class="receipt-time">{{ data.time }}</p>
        <p class="receipt-thanks">谢谢惠顾，欢迎再次光临</p>
      </div>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="onClose">关闭预览</n-button>
        <n-button type="primary" @click="onPrint">🖨 打印小票</n-button>
        <n-button type="warning" @click="onConfirm" v-if="mockMode">✓ 确认打印完成</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { NModal, NButton, NSpace } from 'naive-ui'

const props = defineProps({
  visible: Boolean,
  data: { type: Object, default: () => ({}) },
  isWeigh: { type: Boolean, default: false },
  shopName: { type: String, default: '小鲜鸡' },
  orderType: { type: String, default: 'offline' }
})
const emit = defineEmits(['update:visible', 'confirm', 'close'])

const showModal = ref(false)
const mockMode = import.meta.env.VITE_USE_MOCK === 'true'

watch(() => props.visible, (v) => { showModal.value = v }, { immediate: true })
watch(showModal, (v) => { if (!v) emit('update:visible', false) })

const orderTypeLabel = computed(() => {
  if (props.isWeigh) return '称重小票'
  return props.orderType === 'offline' ? '线下订单' : '线上订单'
})

function onPrint() {
  const printContent = document.getElementById('receipt-print-area')
  if (!printContent) return
  const win = window.open('', '_blank', 'width=300,height=600')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>小鲜鸡 小票</title>
    <style>
      @page { size: 58mm auto; margin: 0; }
      body { margin: 0; padding: 0; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
      .receipt { width: 58mm; padding: 4mm; box-sizing: border-box; }
      .receipt-inner { text-align: center; }
      .receipt-shop { font-size: 16px; font-weight: bold; margin: 0 0 2px; }
      .receipt-sub { font-size: 10px; margin: 0 0 4px; color: #666; }
      .receipt-divider { font-size: 10px; margin: 4px 0; color: #999; }
      .receipt-type-label { font-size: 12px; font-weight: bold; margin: 4px 0; }
      .receipt-info { text-align: left; }
      .receipt-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
      .receipt-row-total { border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; }
      .receipt-label { color: #666; }
      .receipt-price { font-size: 18px; font-weight: bold; }
      .receipt-badge { font-weight: bold; font-size: 14px; }
      .receipt-badge-area { margin: 6px 0; }
      .receipt-badge-num { font-size: 32px; font-weight: bold; }
      .receipt-badge-label { font-size: 14px; }
      .receipt-badge-tip { font-size: 10px; color: #999; margin: 2px 0 0; }
      .receipt-qr-area { margin: 6px 0; }
      .receipt-qr-placeholder { width: 80px; height: 80px; border: 1px solid #000; margin: 4px auto; display: flex; align-items: center; justify-content: center; font-size: 10px; }
      .receipt-time { font-size: 10px; color: #999; }
      .receipt-thanks { font-size: 10px; color: #666; margin-top: 4px; }
      @media print {
        html, body { width: 58mm; }
        .receipt { width: 58mm; }
      }
    </style></head>
    <body>${printContent.outerHTML}</body>
    </html>
  `)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 300)
}

function onConfirm() { emit('confirm') }
function onClose() { emit('close'); emit('update:visible', false) }
</script>

<style scoped>
.receipt {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  max-width: 320px;
  margin: 0 auto;
}
.receipt-inner {
  padding: 16px 20px;
  text-align: center;
  font-family: 'Courier New', 'Microsoft YaHei', monospace;
  font-size: 13px;
  color: #333;
}
.receipt-shop {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 2px;
  color: #1a1a1a;
}
.receipt-sub { font-size: 11px; color: #999; margin: 0 0 8px; }
.receipt-divider { font-size: 11px; color: #ddd; margin: 6px 0; letter-spacing: 2px; }
.receipt-type-label { font-size: 13px; font-weight: 700; margin: 4px 0; color: #D4420A; }
.receipt-info { text-align: left; }
.receipt-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
.receipt-row-total { border-top: 1px dashed #ddd; margin-top: 6px; padding-top: 6px; }
.receipt-label { color: #999; }
.receipt-price { font-size: 22px; font-weight: 700; color: #D4420A; }
.receipt-badge { font-weight: 700; font-size: 16px; color: #D4420A; }
.receipt-badge-area { margin: 10px 0; }
.receipt-badge-num { font-size: 40px; font-weight: 800; color: #D4420A; display: block; }
.receipt-badge-label { font-size: 16px; color: #666; }
.receipt-badge-tip { font-size: 11px; color: #bbb; margin: 2px 0 0; }
.receipt-qr-area { margin: 8px 0; }
.receipt-qr-label { font-size: 10px; color: #bbb; }
.receipt-qr-placeholder {
  width: 80px; height: 80px; border: 1px solid #ddd; margin: 6px auto 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: #ddd;
}
.receipt-time { font-size: 11px; color: #bbb; }
.receipt-thanks { font-size: 11px; color: #999; margin-top: 6px; }
</style>
