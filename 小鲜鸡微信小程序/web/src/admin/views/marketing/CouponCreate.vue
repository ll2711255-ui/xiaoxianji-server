<template>
  <el-card>
    <el-page-header content="创建优惠券" @back="$router.back()" style="margin-bottom:16px" />
    <el-form :model="form" label-width="100px">
      <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="类型"><el-radio-group v-model="form.type"><el-radio value="fixed">固定金额</el-radio><el-radio value="percent">百分比</el-radio></el-radio-group></el-form-item>
      <el-form-item label="面值"><el-input-number v-model="form.value" :min="1" /> <span style="margin-left:8px;color:#999">{{ form.type==='fixed'?'分':'%' }}</span></el-form-item>
      <el-form-item label="最低消费(分)"><el-input-number v-model="form.minAmount" :min="0" /></el-form-item>
      <el-form-item label="发行量"><el-input-number v-model="form.totalCount" :min="1" /></el-form-item>
      <el-form-item label="有效期">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" />
      </el-form-item>
      <el-form-item><el-button type="primary" @click="onSubmit">创建</el-button></el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { marketingApi } from '../../../shared/api';

const router = useRouter();
const dateRange = ref<[Date, Date] | null>(null);
const form = reactive({ name: '', type: 'fixed', value: 500, minAmount: 0, totalCount: 100 });

async function onSubmit() {
  try {
    await marketingApi.createCoupon({
      ...form,
      startAt: dateRange.value?.[0]?.toISOString(),
      endAt: dateRange.value?.[1]?.toISOString(),
    });
    ElMessage.success('已创建');
    router.back();
  } catch (err: any) { ElMessage.error(err.message); }
}
</script>
