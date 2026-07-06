<template>
  <el-card>
    <h3>待处理订单队列</h3>
    <el-table :data="list" stripe v-loading="loading" style="margin-top:16px">
      <el-table-column prop="order_no" label="订单号" width="120" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }"><el-tag size="small" :type="row.type==='pickup'?'success':''">{{ row.type==='pickup'?'自提':'配送' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }"><el-tag size="small">{{ sMap[row.status]||row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ ((row.actual_amount||row.prepay_amount)/100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="card_number" label="号码牌" width="80" />
      <el-table-column prop="created_at" label="时间" width="120">
        <template #default="{ row }">{{ dayjs(row.created_at).format('HH:mm:ss') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="callQueue(row)">叫号</el-button>
          <el-button v-if="row.status==='accepted'" size="small" type="warning" @click="goWeigh(row)">称重</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:12px;justify-content:flex-end" v-model:current-page="page" :total="total" :page-size="20" @change="load" layout="total,prev,next" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { orderApi } from '../../shared/api';
import { useSocketStore } from '../../shared/stores/websocket';

const router = useRouter();
const list = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const sMap: Record<string,string> = { paid:'已支付',accepted:'已接单',weighed:'已称重',processing:'处理中',ready:'待发货' };
const socketStore = useSocketStore();

async function load() {
  loading.value = true;
  try {
    const params: any = { status: 'active', type: 'online', page: page.value, pageSize: 20 };
    const res: any = await orderApi.list(params);
    list.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch {}
  finally { loading.value = false; }
}

function callQueue(row: any) {
  ElMessage.info(`请 ${row.card_number || row.order_no} 号取餐！`);
}

function goWeigh(row: any) {
  router.push('/weigh');
}

onMounted(() => {
  load();
  socketStore.connect();
  socketStore.join('cashier');
  socketStore.onOrderNew(() => load());
  socketStore.onOrderPaid(() => load());
});
</script>
