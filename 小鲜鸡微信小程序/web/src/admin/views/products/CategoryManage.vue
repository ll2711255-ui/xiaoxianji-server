<template>
  <el-card>
    <div style="margin-bottom:12px">
      <el-input v-model="newName" placeholder="新分类名称" style="width:200px;margin-right:8px" />
      <el-button type="primary" @click="addCategory">新增分类</el-button>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="name" label="分类名称" />
      <el-table-column prop="sort_order" label="排序" width="100" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="moveUp(row)">↑</el-button>
          <el-button size="small" @click="moveDown(row)">↓</el-button>
          <el-popconfirm title="确定删除此分类？" @confirm="deleteCategory(row)">
            <template #reference><el-button size="small" type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { categoryApi } from '../../../shared/api';

const list = ref<any[]>([]);
const newName = ref('');

async function load() { const res: any = await categoryApi.list(); list.value = res.data || []; }

async function addCategory() {
  if (!newName.value.trim()) return;
  await categoryApi.create({ name: newName.value.trim() });
  newName.value = '';
  ElMessage.success('已新增');
  load();
}

async function deleteCategory(row: any) {
  try { await categoryApi.delete(row.id); ElMessage.success('已删除'); load(); }
  catch (err: any) { ElMessage.error(err.message); }
}

async function moveUp(row: any) {
  const idx = list.value.indexOf(row);
  if (idx <= 0) return;
  [list.value[idx].sort_order, list.value[idx-1].sort_order] = [list.value[idx-1].sort_order, list.value[idx].sort_order];
  await categoryApi.sort(list.value.map(r => ({ id: r.id, sortOrder: r.sort_order })));
  load();
}

async function moveDown(row: any) {
  const idx = list.value.indexOf(row);
  if (idx >= list.value.length - 1) return;
  [list.value[idx].sort_order, list.value[idx+1].sort_order] = [list.value[idx+1].sort_order, list.value[idx].sort_order];
  await categoryApi.sort(list.value.map(r => ({ id: r.id, sortOrder: r.sort_order })));
  load();
}

onMounted(load);
</script>
