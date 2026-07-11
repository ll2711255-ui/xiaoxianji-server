<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push(backPath)" :content="'订单 ' + order.orderNo" style="margin-bottom:20px" />

    <el-row :gutter="20" v-if="order.orderNo">
      <!-- 左侧：订单信息 -->
      <el-col :span="14">
        <el-card header="订单信息" style="margin-bottom:16px">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <OrderStatusTag :status="order.status" :type="order.type" />
            </el-descriptions-item>
            <el-descriptions-item label="类型">
              {{ order.type === 'offline' ? '线下订单' : order.type === 'pickup' ? '到店自取' : '外卖配送' }}
            </el-descriptions-item>
            <el-descriptions-item label="号码牌">{{ order.cardNumber || '-' }}</el-descriptions-item>
            <el-descriptions-item label="预付金额">¥{{ formatMoney(order.payAmount || 0) }}</el-descriptions-item>
            <el-descriptions-item label="实付金额">¥{{ formatMoney(order.actualAmount || 0) }}</el-descriptions-item>
            <el-descriptions-item label="退款金额">
              <span :class="{ 'text-danger': order.refundAmount > 0 }">¥{{ formatMoney(order.refundAmount || 0) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(order.createTime) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 商品明细 -->
        <el-card header="商品明细" style="margin-bottom:16px" v-if="order.items && order.items.length">
          <el-table :data="order.items" size="small">
            <el-table-column prop="productName" label="商品" />
            <el-table-column prop="quantity" label="数量" width="60" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ formatMoney(row.unitPrice || 0) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 配送地址（非线下订单） -->
        <el-card header="收货信息" v-if="order.deliveryAddress && order.deliveryAddress.name">
          <p>{{ order.deliveryAddress.name }} — {{ order.deliveryAddress.phone }}</p>
          <p class="text-muted">{{ order.deliveryAddress.province }}{{ order.deliveryAddress.city }}{{ order.deliveryAddress.district }}{{ order.deliveryAddress.detail }}</p>
        </el-card>
      </el-col>

      <!-- 右侧：操作 -->
      <el-col :span="10">
        <el-card header="操作" style="margin-bottom:16px">
          <el-space direction="vertical" :size="12" style="width:100%">
            <template v-for="btn in actions" :key="btn.action">
              <el-button :type="btn.type" @click="onAction(btn.action)" style="width:100%" size="large">
                {{ btn.label }}
              </el-button>
            </template>
            <el-empty v-if="actions.length === 0" description="无需操作" :image-size="60" />
          </el-space>
        </el-card>

        <!-- 称重/退款（仅线上已接单/称重状态） -->
        <el-card header="称重 & 退款" v-if="canWeigh">
          <el-form label-width="100px" size="default">
            <el-form-item label="实际重量(克)">
              <el-input-number v-model="weighForm.grams" :min="100" :max="10000" :step="100" style="width:100%" />
            </el-form-item>
            <el-form-item label="号码牌">
              <el-input v-model="weighForm.cardNumber" placeholder="输入号码牌编号" style="width:100%" />
            </el-form-item>
            <el-form-item label="称重照片(URL)">
              <el-input v-model="weighForm.weighPhoto" placeholder="可选，称重照片链接" style="width:100%" />
            </el-form-item>
            <el-form-item label="参考单价">
              <span class="calc-amount">¥{{ (weighForm.pricePerJin / 100).toFixed(2) }}/斤</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onWeigh" :loading="submitting">确认称重</el-button>
              <el-button type="danger" v-if="order.status === 'weighed'" @click="onRefund" :loading="submitting">计算退款</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 订单时间线 -->
        <el-card header="状态流转" style="margin-top:16px">
          <el-steps :active="statusStep" direction="vertical" :space="40">
            <el-step title="已支付" v-if="order.type === 'online'" />
            <el-step title="已接单" />
            <el-step title="已称重" />
            <el-step title="处理中" />
            <el-step :title="order.type === 'delivery' ? '配送中' : '待取货'" />
            <el-step title="已完成" />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import OrderStatusTag from '@/components/OrderStatusTag.vue'

const route = useRoute()
const router = useRouter()
const order = ref({})

const backPath = computed(() => route.meta?.backPath || '/orders')
const loading = ref(false)
const submitting = ref(false)
const weighForm = reactive({ grams: 1000, pricePerJin: 1700, processingFee: 0, cardNumber: '', weighPhoto: '' })

const calcAmount = computed(() => {
  return ((weighForm.grams / 500) * weighForm.pricePerJin + weighForm.processingFee) / 100
})

const canWeigh = computed(() => {
  const s = order.value.status
  return s === 'accepted' || s === 'weighed' || s === 'processing'
})

const statusStep = computed(() => {
  const s = order.value.status
  const steps = { paid: 0, accepted: 1, weighed: 2, processing: 2, ready: 3, delivering: 3, completed: 4 }
  return steps[s] ?? 0
})

const actions = computed(() => {
  const s = order.value.status
  const t = order.value.type
  const d = order.value.type  // 订单类型：delivery/pickup/offline
  const list = []
  if (t === 'online') {
    if (s === 'paid') list.push({ action: 'accept', label: '📋 接单', type: 'primary' })
    if (s === 'accepted') list.push({ action: 'process', label: '🔪 开始处理', type: 'warning' })
    if (s === 'weighed' || s === 'processing') {
      if (d === 'delivery') list.push({ action: 'deliver', label: '🛵 开始配送', type: 'success' })
      else list.push({ action: 'ready', label: '📦 标记待取货', type: 'success' })
    }
    if (s === 'ready') list.push({ action: 'complete', label: '✅ 确认完成', type: 'success' })
    if (s === 'delivering') list.push({ action: 'complete', label: '✅ 确认送达', type: 'success' })
    if (s === 'pending') list.push({ action: 'mark-paid', label: '💰 标记已支付', type: 'warning' })
  } else {
    if (s === 'pending') list.push({ action: 'process', label: '🔪 开始处理', type: 'primary' })
    if (s === 'processing') list.push({ action: 'ready', label: '📦 标记待取货', type: 'success' })
    if (s === 'ready') list.push({ action: 'complete', label: '✅ 确认完成', type: 'success' })
  }
  return list
})

function formatMoney(fen) { return (fen / 100).toFixed(2) }
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

async function loadOrder() {
  loading.value = true
  try {
    const res = await api.get('/orders/' + route.params.orderNo)
    order.value = (res && res.data && res.data.order) || (res && res.data) || {}
    // 从订单 items 读取参考单价
    const firstItem = (order.value.items && order.value.items[0]) || {}
    const spec = firstItem.spec || {}
    weighForm.pricePerJin = spec.type_price_per_jin || spec.price_per_jin || 1700
    weighForm.processingFee = spec.processing_fee || firstItem.processingFee || 0
    weighForm.cardNumber = order.value.cardNumber || ''
    if (order.value.payAmount) {
      const typicalGrams = Math.round((order.value.payAmount / weighForm.pricePerJin) * 500 / 100) * 100
      weighForm.grams = typicalGrams > 0 ? typicalGrams : 1000
    }
  } catch (err) { console.error('加载订单失败:', err); ElMessage.error(err.response?.data?.message || err.message || '加载订单失败') }
  loading.value = false
}

async function onAction(action) {
  const labels = { accept: '接单', process: '开始处理', deliver: '开始配送', ready: '标记待取货', complete: '确认完成', 'mark-paid': '标记已支付' }
  try {
    await ElMessageBox.confirm(`确定执行「${labels[action]}」吗？`, '确认操作', { type: 'info' })
  } catch { return }

  try {
    const res = await api.post('/merchant/orders/' + order.value.orderNo + '/' + action)
    if (res && res.success) { ElMessage.success('操作成功'); loadOrder() }
    else { ElMessage.error((res && res.message) || '操作失败') }
  } catch (err) { ElMessage.error(err.response?.data?.message || err.message || '操作失败') }
}

async function onWeigh() {
  submitting.value = true
  try {
    const actualWeight = weighForm.grams
    const res = await api.post('/merchant/orders/' + order.value.orderNo + '/weigh', {
      actualWeight, weighPhoto: weighForm.weighPhoto, cardNumber: weighForm.cardNumber
    })
    if (res && res.success) { ElMessage.success('称重完成'); loadOrder() }
    else { ElMessage.error((res && res.message) || '称重失败') }
  } catch (err) { ElMessage.error(err.response?.data?.message || err.message || '称重失败') }
  submitting.value = false
}

async function onRefund() {
  submitting.value = true
  try {
    const res = await api.post('/merchant/orders/' + order.value.orderNo + '/refund', {
      actualWeight: order.value.actualWeight || weighForm.grams
    })
    if (res && res.success) { ElMessage.success('退款已计算'); loadOrder() }
    else { ElMessage.error((res && res.message) || '退款失败') }
  } catch (err) { ElMessage.error(err.response?.data?.message || err.message || '退款失败') }
  submitting.value = false
}

watch(() => route.params.orderNo, () => { if (route.params.orderNo) loadOrder() })
onMounted(() => loadOrder())
</script>

<style scoped>
.text-muted { color: #999; font-size: 13px; }
.text-danger { color: #F56C6C; font-weight: 700; }
.calc-amount { font-size: 24px; font-weight: 700; color: #D4420A; }
</style>
