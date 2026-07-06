<template>
  <el-card>
    <h3>店铺设置</h3>
    <el-form :model="form" label-width="120px" style="margin-top:16px">
      <el-form-item label="店铺名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="店铺地址"><el-input v-model="form.address" /></el-form-item>
      <el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item>
      <el-form-item label="联系人"><el-input v-model="form.contactName" /></el-form-item>
      <el-form-item label="配送半径(km)"><el-input-number v-model="form.deliveryRadius" :min="1" :max="50" /></el-form-item>
      <el-form-item label="店铺纬度"><el-input-number v-model="form.latitude" :precision="6" /></el-form-item>
      <el-form-item label="店铺经度"><el-input-number v-model="form.longitude" :precision="6" /></el-form-item>
      <el-form-item label="ICP备案号"><el-input v-model="form.icpNumber" placeholder="粤ICP备XXXXXXXX号" /></el-form-item>
      <el-form-item><el-button type="primary" @click="onSave" :loading="saving">保存</el-button></el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { configApi } from '../../../shared/api';

const saving = ref(false);
const form = reactive({ name:'', address:'', contactPhone:'', contactName:'', deliveryRadius:5, latitude:23.1291, longitude:113.2644, icpNumber:'' });

async function load() {
  const res: any = await configApi.getStore();
  const d = res.data || res;
  Object.assign(form, d);
}

async function onSave() {
  saving.value = true;
  try { await configApi.updateStore(form); ElMessage.success('已保存'); }
  catch (err: any) { ElMessage.error(err.message); }
  finally { saving.value = false; }
}

onMounted(load);
</script>
