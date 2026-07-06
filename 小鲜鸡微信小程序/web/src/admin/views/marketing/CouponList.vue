<template>
  <el-card>
    <el-button type="primary" @click="$router.push('/coupons/create')" style="margin-bottom:12px">创建优惠券</el-button>
    <el-table :data="list" stripe>
      <el-table-column prop="name" label="名称" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">{{ row.type==='fixed'?'固定金额':'百分比' }}</template>
      </el-table-column>
      <el-table-column label="面值" width="100">
        <template #default="{ row }">{{ row.type==='fixed' ? `¥${(row.value/100).toFixed(2)}` : `${row.value}%` }}</template>
      </el-table-column>
      <el-table-column label="最低消费" width="100">
        <template #default="{ row }">¥{{ (row.min_amount/100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="库存" width="80">
        <template #default="{ row }">{{ row.used_count }}/{{ row.total_count }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-switch :model-value="row.status==='on'" @change="(v:boolean)=>toggle(row,v)" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { marketingApi } from '../../../shared/api';

const list = ref<any[]>([]);

async function load() { const res: any = await marketingApi.couponList(); list.value = res.data?.list || []; }
async function toggle(row: any, on: boolean) {
  await marketingApi.updateCouponStatus(row.id, on ? 'on' : 'off');
  ElMessage.success(on ? '已启用' : '已停用');
  load();
}
onMounted(load);
</script>
