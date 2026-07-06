<template>
  <div>
    <el-card>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <el-select v-model="filterStatus" placeholder="状态" clearable @change="load" style="width:120px">
          <el-option label="上架" value="on" /><el-option label="下架" value="off" />
        </el-select>
        <el-select v-model="filterCategory" placeholder="分类" clearable @change="load" style="width:150px">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索商品名" clearable @keyup.enter="load" style="width:200px" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button type="success" @click="$router.push('/products/edit')">新增商品</el-button>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="name" label="商品名称" min-width="150" />
        <el-table-column prop="category_name" label="分类" width="100" />
        <el-table-column label="计价方式" width="100">
          <template #default="{ row }">{{ pricingMap[row.pricing_type] }}</template>
        </el-table-column>
        <el-table-column label="价格" width="100">
          <template #default="{ row }">
            ¥{{ row.pricing_type === 'per_piece' ? (row.unit_price / 100).toFixed(2) : (row.price_per_jin / 100).toFixed(2) + '/斤' }}
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">
            <el-tag :type="row.stock_quantity <= row.stock_alert_threshold ? 'danger' : 'success'" size="small">{{ row.stock_quantity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-switch :model-value="row.status==='on'" @change="(v:boolean) => toggleStatus(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="销量" width="80" prop="sales" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/products/edit/${row.id}`)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { productApi, categoryApi } from '../../../shared/api';

const loading = ref(false);
const list = ref<any[]>([]);
const categories = ref<any[]>([]);
const filterStatus = ref('');
const filterCategory = ref('');
const keyword = ref('');
const pricingMap: Record<string, string> = { exact_weight: '称重', range_weight: '整鸡', per_piece: '按只' };

async function load() {
  loading.value = true;
  try {
    const params: any = {};
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterCategory.value) params.categoryId = filterCategory.value;
    if (keyword.value) params.keyword = keyword.value;
    const res: any = await productApi.list(params);
    list.value = res.data?.list || [];
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function toggleStatus(row: any, on: boolean) {
  try {
    await productApi.updateStatus(row.id, on ? 'on' : 'off');
    ElMessage.success(on ? '已上架' : '已下架');
    load();
  } catch (err: any) {
    ElMessage.error(err.message);
  }
}

onMounted(async () => {
  const res: any = await categoryApi.list();
  categories.value = res.data || [];
  load();
});
</script>
