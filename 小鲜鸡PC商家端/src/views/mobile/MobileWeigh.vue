<template>
  <div class="mobile-weigh">
    <h3 class="page-title">称重</h3>

    <!-- 扫码/手输订单号 -->
    <div class="weigh-input-area">
      <el-input
        v-model="orderNo"
        placeholder="输入或扫码订单号"
        size="large"
        clearable
        @keyup.enter="onSearch"
      >
        <template #append>
          <el-button @click="onScan">
            <el-icon :size="18"><Camera /></el-icon>
          </el-button>
        </template>
      </el-input>
      <el-button type="primary" size="large" :loading="searching" @click="onSearch" style="margin-top:10px;width:100%">
        查找订单
      </el-button>
    </div>

    <!-- 订单详情 + 称重 -->
    <div v-if="order" class="weigh-order-card">
      <div class="weigh-order-header">
        <span class="weigh-order-no">{{ order.orderNo }}</span>
        <el-tag :type="order.type === 'offline' ? 'warning' : 'info'" size="small">
          {{ order.type === 'offline' ? '线下' : '线上' }}
        </el-tag>
      </div>

      <!-- 商品列表（可编辑重量） -->
      <div v-for="(item, idx) in items" :key="idx" class="weigh-item-row">
        <div class="weigh-item-info">
          <span class="weigh-item-name">{{ item.productName || item.name }}</span>
          <span class="weigh-item-qty">×{{ item.quantity || 1 }}</span>
        </div>
        <div class="weigh-item-input">
          <el-input-number
            v-model="item.weight"
            :min="0"
            :precision="3"
            :step="0.1"
            size="small"
            controls-position="right"
            placeholder="重量"
          />
          <span class="weigh-item-unit">kg</span>
        </div>
      </div>

      <!-- 总价 -->
      <div class="weigh-total">
        <span>称重后总价：</span>
        <span class="weigh-total-price">¥{{ computedTotal }}</span>
      </div>

      <el-button type="success" size="large" :loading="submitting" @click="onSubmit" style="width:100%;margin-top:12px">
        确认称重完成
      </el-button>
    </div>

    <!-- 空状态 -->
    <div v-if="!order && !searching" class="empty-state">
      <el-icon :size="48"><ScaleToOriginal /></el-icon>
      <p>输入或扫码订单号开始称重</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useScanner } from '@/composables/useScanner'

const { scan } = useScanner()

const orderNo = ref('')
const order = ref(null)
const items = ref([])
const searching = ref(false)
const submitting = ref(false)

const computedTotal = computed(() => {
  if (!items.value.length) return '0.00'
  const totalFen = items.value.reduce((sum, item) => {
    const weight = parseFloat(item.weight) || 0
    const unitPrice = item.unitPrice || item.price || 0
    return sum + Math.round(weight * unitPrice)
  }, 0)
  return (totalFen / 100).toFixed(2)
})

async function onSearch() {
  const no = orderNo.value.trim()
  if (!no) return ElMessage.warning('请输入订单号')

  searching.value = true
  try {
    const res = await api.get('/orders/' + no)
    if (res && res.success && res.data) {
      order.value = res.data.order || res.data
      // 初始化商品重量（默认取已有重量值）
      const orderItems = (order.value.items || []).map(item => ({
        ...item,
        weight: item.weight || item.actualWeight || 0
      }))
      items.value = orderItems
    } else {
      ElMessage.error('订单不存在')
    }
  } catch (err) {
    ElMessage.error(err.message || '查找失败')
  } finally {
    searching.value = false
  }
}

async function onScan() {
  const result = await scan({ hint: '扫描订单条形码' })
  if (result && result.text) {
    orderNo.value = result.text
    onSearch()
  }
}

async function onSubmit() {
  if (!order.value) return

  submitting.value = true
  try {
    // 计算总重（所有商品重量之和，单位克）
    // 重量输入单位是 kg，转换为克
    const totalWeightGrams = items.value.reduce((sum, item) => {
      const weightKg = parseFloat(item.weight) || 0
      return sum + Math.round(weightKg * 1000)
    }, 0)

    if (totalWeightGrams <= 0) {
      ElMessage.warning('请先输入商品重量')
      submitting.value = false
      return
    }

    await api.post(`/merchant/orders/${order.value.orderNo}/weigh`, {
      actualWeight: totalWeightGrams,
      weighPhoto: '',
      cardNumber: order.value.cardNumber || ''
    })
    ElMessage.success('称重完成')

    // 重置
    order.value = null
    items.value = []
    orderNo.value = ''
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '称重失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.mobile-weigh { padding-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; color: #222; margin: 0 0 12px; }

.weigh-input-area { margin-bottom: 16px; }

.weigh-order-card {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.weigh-order-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #eee;
}
.weigh-order-no { font-size: 16px; font-weight: 700; }

.weigh-item-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid #f5f5f5;
}
.weigh-item-info { flex: 1; min-width: 0; }
.weigh-item-name { font-size: 14px; color: #333; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weigh-item-qty { font-size: 12px; color: #999; }
.weigh-item-input { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.weigh-item-input :deep(.el-input-number) { width: 110px; }
.weigh-item-unit { font-size: 13px; color: #666; }

.weigh-total {
  text-align: right; padding: 12px 0; font-size: 14px; color: #666;
}
.weigh-total-price { font-size: 22px; font-weight: 700; color: #D4420A; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 80px 0; color: #999; gap: 12px;
}
</style>
