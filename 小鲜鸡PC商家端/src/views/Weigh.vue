<template>
  <div class="weigh-page">
    <!-- 顶部导航 -->
    <div class="weigh-header">
      <n-button text @click="onBack">
        ← 返回
      </n-button>
      <span class="weigh-title">称重 · {{ orderNo }}</span>
      <div style="width:60px" />
    </div>

    <div class="weigh-body" v-if="order">
      <n-grid :cols="2" :x-gap="16">
        <!-- 左列：信息 -->
        <n-gi>
          <n-card title="订单信息" size="small" style="margin-bottom:12px">
            <n-descriptions :column="1" label-placement="left" size="small" bordered>
              <n-descriptions-item label="商品">{{ productName }}</n-descriptions-item>
              <n-descriptions-item label="规格">
                <n-tag v-for="tag in specTags" :key="tag.text" size="small" style="margin-right:4px">{{ tag.text }}</n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="单价">¥{{ pricePerJinDisplay }} / 斤</n-descriptions-item>
              <n-descriptions-item label="处理附加费">¥{{ processingFeeDisplay }}</n-descriptions-item>
              <n-descriptions-item label="预付款">¥{{ prepayDisplay }}</n-descriptions-item>
              <n-descriptions-item label="订单状态">
                <n-tag type="info" size="small">{{ order.status }}</n-tag>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <!-- 号码牌 -->
          <n-card title="号码牌" size="small" style="margin-bottom:12px">
            <div class="card-select" v-if="cardNumbers.length > 0">
              <n-tag
                v-for="c in cardNumbers"
                :key="c._id"
                :type="selectedCard === c.number ? 'warning' : (c.status === 'idle' ? 'default' : 'info')"
                size="medium"
                :closable="false"
                :checkable="true"
                :checked="selectedCard === c.number"
                :disabled="c.status !== 'idle' && c.number !== order.cardNumber"
                @click="c.status === 'idle' || c.number === order.cardNumber ? onCardSelect(c) : null"
                style="margin:4px;cursor:pointer"
              >
                {{ c.number }}
              </n-tag>
            </div>
            <n-empty v-else description="无可用号码牌" :image-size="40" />
          </n-card>

          <!-- 照片 -->
          <n-card title="称重照片" size="small">
            <n-upload
              :show-file-list="false"
              accept="image/*"
              @before-upload="onPhotoUpload"
            >
              <n-button>选择照片</n-button>
            </n-upload>
            <div v-if="weighPhoto" class="photo-preview">
              <img :src="weighPhoto" alt="称重照片" />
              <n-button size="tiny" type="error" @click="weighPhoto = ''" style="margin-top:4px">删除</n-button>
            </div>
          </n-card>
        </n-gi>

        <!-- 右列：重量输入 + 计算 -->
        <n-gi>
          <n-card title="实际称重" size="small" style="margin-bottom:12px">
            <!-- 约束提示 -->
            <n-alert
              v-if="weightConstraint"
              type="warning"
              style="margin-bottom:12px"
            >
              {{ weightConstraint.label }}
            </n-alert>

            <n-form-item label="实际重量（克）" label-placement="top" size="large">
              <n-input-number
                v-model:value="weightGrams"
                :min="0"
                :max="99999"
                placeholder="输入实际称重克数"
                style="width:100%"
                :status="weightWarning ? 'error' : undefined"
                @update:value="onWeightChange"
              >
                <template #suffix>克</template>
              </n-input-number>
            </n-form-item>

            <!-- 警告 -->
            <n-alert v-if="weightWarning" type="error" style="margin-bottom:12px">
              {{ weightWarning }}
            </n-alert>

            <!-- 实时计算 -->
            <n-descriptions :column="1" label-placement="left" size="small" bordered v-if="weightGrams > 0">
              <n-descriptions-item label="实际重量">{{ actualWeightJin }} 斤</n-descriptions-item>
              <n-descriptions-item label="计算公式">{{ weightGrams }}克 / 500 × ¥{{ pricePerJinDisplay }} + ¥{{ processingFeeDisplay }}</n-descriptions-item>
              <n-descriptions-item label="实际金额">
                <span style="font-size:18px;font-weight:700;color:#D4420A">¥{{ actualAmountDisplay }}</span>
              </n-descriptions-item>
              <n-descriptions-item label="退款金额" v-if="showRefund">
                <span :style="{ color: refundAmount > 0 ? '#67C23A' : '#999', fontSize: refundAmount > 0 ? '16px' : '13px', fontWeight: refundAmount > 0 ? '700' : '400' }">
                  {{ refundAmount > 0 ? '¥' + refundAmountDisplay + ' 退还给用户' : '无需退款' }}
                </span>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <!-- 提交按钮 -->
          <n-button
            type="warning"
            size="large"
            block
            :disabled="!canSubmit"
            :loading="submitting"
            @click="onSubmit"
            style="height:48px;font-size:16px;font-weight:700"
          >
            {{ submitLabel }}
          </n-button>
        </n-gi>
      </n-grid>
    </div>

    <n-spin :show="!order" size="large" style="flex:1;display:flex;align-items:center;justify-content:center" />

    <!-- 称重小票预览 -->
    <ReceiptPreview
      v-model:visible="showWeighReceipt"
      :data="weighReceiptData"
      :is-weigh="true"
      :shop-name="'小鲜鸡'"
      @confirm="onWeighReceiptConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NButton, NFormItem,
  NInputNumber, NUpload, NAlert, NGrid, NGi, NSpin, NEmpty
} from 'naive-ui'
import api from '@/utils/api'
import ReceiptPreview from '@/components/ReceiptPreview.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const orderNo = ref(route.params.orderNo || '')
const order = ref(null)

// 商品信息
const productName = ref('')
const specTags = ref([])
const pricePerJin = ref(0)
const pricePerJinDisplay = ref('0.00')
const processingFee = ref(0)
const processingFeeDisplay = ref('0.00')
const prepayAmount = ref(0)
const prepayDisplay = ref('0.00')

// 重量
const weightGrams = ref(0)
const weightConstraint = ref(null)
const weightWarning = ref('')

// 计算结果
const actualWeightJin = ref('0.00')
const actualAmount = ref(0)
const actualAmountDisplay = ref('0.00')
const refundAmount = ref(0)
const refundAmountDisplay = ref('0.00')
const showRefund = ref(false)

// 照片
const weighPhoto = ref('')

// 号码牌
const cardNumbers = ref([])
const selectedCard = ref('')

// 提交
const submitting = ref(false)

// 小票
const showWeighReceipt = ref(false)
const weighReceiptData = ref({})

const canSubmit = computed(() => weightGrams.value > 0 && !weightWarning.value && !submitting.value)
const submitLabel = computed(() => {
  if (!weightGrams.value) return '请输入实际重量'
  if (weightWarning.value) return '重量不符合规则'
  return `确认称重 · ¥${actualAmountDisplay.value}` + (refundAmount.value > 0 ? ` · 退款¥${refundAmountDisplay.value}` : '')
})

onMounted(async () => {
  if (!orderNo.value) {
    message.error('订单不存在')
    router.push('/')
    return
  }
  await loadOrder()
  loadCardNumbers()
})

async function loadOrder() {
  try {
    const res = await api.get('/orders/' + orderNo.value)
    const d = (res && res.data) || res || {}
    const ord = d.order
    if (!ord) { message.error('订单不存在'); router.push('/'); return }
    if (ord.status !== 'accepted') { message.error('订单状态不可称重'); router.push('/'); return }

    order.value = ord

    const item = (ord.items && ord.items[0]) || {}
    const spec = item.spec || {}

    // 规格标签
    const tags = []
    if (spec.type) tags.push({ text: spec.type })
    if (spec.weight_label) tags.push({ text: spec.weight_label })
    else if (spec.weight) tags.push({ text: spec.weight })
    if (spec.processing) tags.push({ text: spec.processing })
    specTags.value = tags

    productName.value = item.productName || ''
    const ppj = spec.type_price_per_jin || spec.price_per_jin || item.unitPrice || 0
    pricePerJin.value = ppj
    pricePerJinDisplay.value = formatMoney(ppj)
    const pf = spec.processing_fee || 0
    processingFee.value = pf
    processingFeeDisplay.value = formatMoney(pf)
    prepayAmount.value = ord.prepayAmount || 0
    prepayDisplay.value = formatMoney(ord.prepayAmount || 0)

    // 重量约束（四道防线第①道）
    const pricingType = item.pricingType || ''
    if (pricingType === 'range_weight') {
      const weightMax = spec.weight_max
      if (weightMax && weightMax > 0) {
        const maxJin = (weightMax / 500).toFixed(2)
        weightConstraint.value = { type: 'max', value: weightMax, label: `最大不超过 ${weightMax}克（${maxJin}斤）` }
      }
    } else if (pricingType === 'exact_weight') {
      const targetGrams = spec.weightGrams
      if (targetGrams && targetGrams > 0) {
        const targetJin = (targetGrams / 500).toFixed(2)
        weightConstraint.value = { type: 'equal', value: targetGrams, label: `须等于 ${targetGrams}克（${targetJin}斤）` }
      }
    }

    selectedCard.value = ord.cardNumber || ''
  } catch (err) {
    console.error('加载订单失败:', err)
    message.error('加载订单失败')
  }
}

async function loadCardNumbers() {
  try {
    const res = await api.get('/pai-numbers')
    cardNumbers.value = (res && res.data && res.data.numbers) || []
  } catch (err) { /* ignore */ }
}

function formatMoney(fen) { return (fen / 100).toFixed(2) }

// 重量输入变更（防线②：实时校验 + 实时计算）
function onWeightChange(val) {
  const grams = val || 0
  weightGrams.value = grams

  // 防线②：实时校验
  let warn = ''
  const constraint = weightConstraint.value
  if (constraint && grams > 0) {
    if (constraint.type === 'max' && grams > constraint.value) {
      const maxJin = (constraint.value / 500).toFixed(2)
      warn = `重量超出订单范围（最大${constraint.value}克/${maxJin}斤）`
    } else if (constraint.type === 'equal' && grams !== constraint.value) {
      const diff = Math.abs(grams - constraint.value)
      const targetJin = (constraint.value / 500).toFixed(2)
      warn = `重量须等于${constraint.value}克/${targetJin}斤（差${diff}克）`
    }
  }
  weightWarning.value = warn

  // 实时计算
  if (grams > 0) {
    calculate(grams)
  } else {
    actualWeightJin.value = '0.00'
    actualAmount.value = 0
    actualAmountDisplay.value = '0.00'
    refundAmount.value = 0
    refundAmountDisplay.value = '0.00'
    showRefund.value = false
  }
}

function calculate(grams) {
  const ppj = pricePerJin.value
  const pf = processingFee.value
  const prepay = prepayAmount.value

  actualWeightJin.value = (grams / 500).toFixed(2)
  const amtFloat = (grams / 500) * ppj + pf
  actualAmount.value = Math.floor(amtFloat)
  actualAmountDisplay.value = formatMoney(actualAmount.value)
  const refund = Math.max(0, prepay - actualAmount.value)
  refundAmount.value = refund
  refundAmountDisplay.value = formatMoney(refund)
  showRefund.value = true
}

function onCardSelect(c) {
  selectedCard.value = c.number === selectedCard.value ? '' : c.number
}

function onPhotoUpload(file) {
  weighPhoto.value = URL.createObjectURL(file.file)
  return false
}

// 防线④：提交拦截
async function onSubmit() {
  if (!canSubmit.value) return

  // 防线④：硬拦截
  if (weightWarning.value) {
    message.error(weightWarning.value)
    return
  }

  const content = `确认称重信息？\n实际重量：${weightGrams.value}克（${actualWeightJin.value}斤）\n实际金额：¥${actualAmountDisplay.value}\n${refundAmount.value > 0 ? '将退款：¥' + refundAmountDisplay.value + ' 给用户' : '无需退款'}\n${selectedCard.value ? '绑定号码牌：' + selectedCard.value : ''}\n${!weighPhoto.value ? '⚠ 未上传称重照片' : ''}`

  dialog.warning({
    title: '确认称重',
    content,
    positiveText: '确认提交',
    negativeText: '取消',
    onPositiveClick: async () => {
      submitting.value = true
      try {
        const res = await api.post('/merchant/orders/' + orderNo.value + '/weigh', {
          actualWeight: weightGrams.value,
          weighPhoto: weighPhoto.value,
          cardNumber: selectedCard.value || order.value.cardNumber || '',
          pricePerJin: pricePerJin.value,
          processingFee: processingFee.value
        })

        const rd = (res && res.data) || res || {}
        if (res && res.success) {
          const refundAmt = rd.refundAmount || 0
          const tips = refundAmt > 0 ? `称重完成，已退款 ¥${formatMoney(refundAmt)}` : '称重完成'

          // 准备称重小票数据
          const ord = order.value || {}
          const item = (ord.items && ord.items[0]) || {}
          const spec = item.spec || {}
          const specParts = [spec.type, spec.processing].filter(Boolean).join('/')
          const now = new Date()
          const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

          weighReceiptData.value = {
            orderNo: orderNo.value,
            cardNumber: rd.cardNumber || ord.cardNumber || '',
            productName: item.productName || productName.value,
            specSummary: specParts,
            actualWeightGrams: weightGrams.value,
            actualWeightJin: actualWeightJin.value,
            pricePerJinYuan: pricePerJinDisplay.value,
            actualAmountYuan: actualAmountDisplay.value,
            refundAmountYuan: refundAmountDisplay.value,
            hasRefund: refundAmt > 0,
            time: timeStr
          }

          message.success(tips)
          showWeighReceipt.value = true
        } else {
          message.error((res && res.message) || '提交失败')
        }
      } catch (err) {
        console.error('称重提交失败:', err)
        message.error('提交失败，请重试')
      }
      submitting.value = false
    }
  })
}

function onWeighReceiptConfirm() {
  showWeighReceipt.value = false
  router.push('/')
}

function onBack() {
  router.push('/')
}
</script>

<style scoped>
.weigh-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
}
.weigh-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.weigh-title {
  font-size: 16px;
  font-weight: 600;
  color: #D4420A;
}
.weigh-body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}
.photo-preview {
  margin-top: 8px;
}
.photo-preview img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 6px;
  display: block;
}
</style>
