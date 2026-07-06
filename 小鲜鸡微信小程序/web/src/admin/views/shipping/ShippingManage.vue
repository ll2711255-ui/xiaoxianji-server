<template>
  <el-card>
    <h3>待发货订单</h3>
    <el-table :data="list" stripe v-loading="loading" style="margin-top:12px">
      <el-table-column prop="order_no" label="订单号" width="120" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }"><el-tag :type="row.type==='pickup'?'success':''" size="small">{{ row.type==='pickup'?'自提':'配送' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="收货地址" min-width="200">
        <template #default="{ row }">
          <template v-if="row.delivery_address">
            {{ (typeof row.delivery_address==='string' ? JSON.parse(row.delivery_address) : row.delivery_address).detail || '-' }}
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-input v-model="trackingInput[row.order_no]" placeholder="物流单号" size="small" style="width:140px;margin-right:4px" />
          <el-button size="small" type="primary" @click="doShip(row)">发货</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { orderApi } from '../../../shared/api';

const loading = ref(false);
const list = ref<any[]>([]);
const trackingInput = reactive<Record<string, string>>({});

async function load() {
  loading.value = true;
  try {
    const res: any = await orderApi.list({ status: 'ready', type: 'online', pageSize: 100 });
    list.value = res.data?.list || [];
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function doShip(row: any) {
  const trackingNo = trackingInput[row.order_no];
  if (!trackingNo) { ElMessage.warning('请输入物流单号'); return; }
  try {
    await orderApi.ship(row.order_no, trackingNo);
    ElMessage.success('发货成功');
    load();
  } catch (err: any) { ElMessage.error(err.message); }
}

onMounted(load);
</script>
