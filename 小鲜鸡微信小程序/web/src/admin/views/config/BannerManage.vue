<template>
  <el-card>
    <h3>轮播图管理</h3>
    <div style="margin:12px 0">
      <el-button type="primary" @click="addBanner">新增</el-button>
    </div>
    <el-table :data="banners" stripe>
      <el-table-column label="图片" width="200">
        <template #default="{ row }"><el-image :src="row.imageUrl" style="width:180px;height:80px;object-fit:cover" /></template>
      </el-table-column>
      <el-table-column label="链接" min-width="200"><template #default="{ row }"><el-input v-model="row.linkUrl" placeholder="跳转链接" size="small" /></template></el-table-column>
      <el-table-column label="排序" width="80"><template #default="{ row }"><el-input-number v-model="row.sortOrder" :min="0" size="small" /></template></el-table-column>
      <el-table-column label="操作" width="80"><template #default="{$index}"><el-button size="small" type="danger" @click="removeBanner($index)">删除</el-button></template></el-table-column>
    </el-table>
    <el-button type="primary" @click="onSave" style="margin-top:12px">保存</el-button>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { configApi } from '../../../shared/api';

const banners = ref<any[]>([]);

async function load() {
  const res: any = await configApi.getBanners();
  banners.value = res.data || [];
}

function addBanner() {
  banners.value.push({ imageUrl: '', linkUrl: '', sortOrder: banners.value.length });
}

function removeBanner(i: number) {
  banners.value.splice(i, 1);
}

async function onSave() {
  try { await configApi.updateBanners(banners.value); ElMessage.success('已保存'); load(); }
  catch (err: any) { ElMessage.error(err.message); }
}

onMounted(load);
</script>
