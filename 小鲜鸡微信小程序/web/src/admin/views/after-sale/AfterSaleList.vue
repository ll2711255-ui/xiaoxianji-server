<template>
  <el-card>
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="待处理" name="applied" />
      <el-tab-pane label="已处理" name="completed" />
    </el-tabs>
    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="order_no" label="订单号" width="120" />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ (row.amount / 100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="200" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status==='applied'?'warning':'info'" size="small">{{ row.status==='applied'?'待处理':'已处理' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" v-if="tab==='applied'">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="handleApprove(row)">同意</el-button>
          <el-button size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../../shared/api/index';

const tab = ref('applied');
const list = ref<any[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    // 售后数据暂从 after_sales 表读取（待实现专用 API）
    const res: any = await api.get('/after-sales', { params: { status: tab.value } });
    list.value = res.data?.list || [];
  } catch {
    // 降级：空列表
    list.value = [];
  }
  loading.value = false;
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.prompt('处理备注', '同意售后');
    await api.patch(`/after-sales/${row.id}`, { status: 'approved' });
    ElMessage.success('已同意');
    load();
  } catch {}
}

async function handleReject(row: any) {
  try {
    await ElMessageBox.prompt('拒绝原因', '拒绝售后');
    await api.patch(`/after-sales/${row.id}`, { status: 'rejected' });
    ElMessage.success('已拒绝');
    load();
  } catch {}
}
</script>
