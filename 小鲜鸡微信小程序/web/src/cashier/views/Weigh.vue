<template>
  <div class="weigh-page">
    <el-card>
      <h3>称重录入</h3>
      <!-- 扫码输入订单号 -->
      <div style="margin:16px 0">
        <el-input v-model="orderNo" placeholder="扫码或手动输入订单号" size="large" @keyup.enter="search" ref="orderInput" clearable>
          <template #prepend>订单号</template>
        </el-input>
      </div>

      <!-- 扫码枪自动识别后展示订单 -->
      <el-descriptions v-if="order" :column="2" border size="large" style="margin-bottom:16px">
        <el-descriptions-item label="订单号">{{ order.order_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ order.status }}</el-descriptions-item>
        <el-descriptions-item label="预付金额">¥{{ (order.prepay_amount/100).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="商品">{{ items[0]?.productName || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 称重表单 -->
      <div v-if="order" class="weigh-form">
        <div class="weight-big">{{ actualWeight }} g <span style="font-size:18px;color:#999">= {{ (actualWeight/500).toFixed(2) }} 斤</span></div>

        <el-slider v-model="actualWeight" :min="100" :max="5000" :step="10" show-input style="margin:24px 0" />

        <div class="quick-btns">
          <el-button v-for="w in quickWeights" :key="w" @click="actualWeight=w" :type="actualWeight===w?'success':''">{{ w }}g</el-button>
        </div>

        <div class="calc-result" v-if="pricePerJin > 0">
          <p>单价：¥{{ (pricePerJin/100).toFixed(2) }}/斤</p>
          <p>实收：<strong>¥{{ (actualAmount/100).toFixed(2) }}</strong></p>
          <p v-if="refundAmount>0" style="color:#E74C3C">退款：¥{{ (refundAmount/100).toFixed(2) }}</p>
        </div>

        <el-form style="margin-top:16px">
          <el-form-item label="号码牌">
            <el-input v-model="cardNumber" placeholder="扫描或手动输入" />
          </el-form-item>
        </el-form>

        <el-button type="success" size="large" @click="submit" :loading="submitting" style="width:100%;height:52px;font-size:18px;margin-top:12px">
          确认称重
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { orderApi } from '../../shared/api';

const orderNo = ref('');
const order = ref<any>(null);
const actualWeight = ref(500);
const cardNumber = ref('');
const submitting = ref(false);
const quickWeights = [300, 500, 750, 1000, 1500, 2000];

const items = computed(() => {
  if (!order.value?.items) return [];
  return typeof order.value.items === 'string' ? JSON.parse(order.value.items) : order.value.items;
});

const firstItem = computed(() => items.value[0] || {});
const pricePerJin = computed(() => firstItem.value.spec?.type_price_per_jin || firstItem.value.spec?.price_per_jin || 0);
const processingFee = computed(() => firstItem.value.spec?.processing_fee || 0);

const actualAmount = computed(() => {
  if (!pricePerJin.value) return 0;
  return Math.floor((actualWeight.value / 500) * pricePerJin.value + processingFee.value);
});

const refundAmount = computed(() => {
  if (!order.value) return 0;
  return Math.max(0, (order.value.prepay_amount || 0) - actualAmount.value);
});

async function search() {
  if (!orderNo.value.trim()) return;
  try {
    const res: any = await orderApi.detail(orderNo.value.trim());
    order.value = res.data || res;
    if (order.value) {
      cardNumber.value = order.value.card_number || '';
    }
  } catch (err: any) { ElMessage.error('订单不存在'); order.value = null; }
}

async function submit() {
  if (!order.value) return;
  if (!orderNo.value.trim()) { ElMessage.warning('缺少订单号'); return; }
  submitting.value = true;
  try {
    await orderApi.weigh(orderNo.value.trim(), {
      actualWeight: actualWeight.value,
      cardNumber: cardNumber.value,
    });
    ElMessage.success('称重完成');
    order.value = null;
    orderNo.value = '';
  } catch (err: any) { ElMessage.error(err.message || '称重失败'); }
  finally { submitting.value = false; }
}

onMounted(() => {
  // 自动聚焦输入框（配合扫码枪）
  setTimeout(() => {
    const el = document.querySelector('.el-input__inner') as HTMLInputElement;
    el?.focus();
  }, 500);
});
</script>

<style scoped>
.weigh-page{max-width:600px}
.weight-big{text-align:center;font-size:48px;font-weight:700;color:#333;margin:16px 0}
.quick-btns{display:flex;gap:8px;flex-wrap:wrap}
.el-descriptions{margin-bottom:16px}
</style>
