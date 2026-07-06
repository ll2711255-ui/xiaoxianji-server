<template>
  <el-card>
    <h3>自提核销</h3>
    <div style="margin:16px 0;max-width:400px">
      <el-input v-model="orderNo" placeholder="扫描订单号或输入商户订单号" size="large" @keyup.enter="search" ref="pickupInput" clearable />
    </div>

    <el-descriptions v-if="order" :column="2" border size="large">
      <el-descriptions-item label="订单号">{{ order.order_no }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ order.status }}</el-descriptions-item>
      <el-descriptions-item label="金额">¥{{ ((order.actual_amount||order.prepay_amount)/100).toFixed(2) }}</el-descriptions-item>
      <el-descriptions-item label="取货时间">{{ order.pickup_time || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-button v-if="order && order.type==='pickup' && order.status!=='completed'" type="success" size="large" @click="confirm" :loading="confirming" style="margin-top:12px;height:48px;font-size:18px;width:200px">
      确认取货
    </el-button>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { orderApi } from '../../shared/api';

const orderNo = ref('');
const order = ref<any>(null);
const confirming = ref(false);

async function search() {
  if (!orderNo.value.trim()) return;
  try {
    const res: any = await orderApi.detail(orderNo.value.trim());
    order.value = res.data || res;
  } catch { ElMessage.error('订单不存在'); order.value = null; }
}

async function confirm() {
  confirming.value = true;
  try {
    await orderApi.pickup(order.value.order_no);
    ElMessage.success('取货已确认');
    order.value = null;
    orderNo.value = '';
  } catch (err: any) { ElMessage.error(err.message); }
  finally { confirming.value = false; }
}

onMounted(() => setTimeout(() => { const el = document.querySelector('.el-input__inner') as HTMLInputElement; el?.focus(); }, 500));
</script>
