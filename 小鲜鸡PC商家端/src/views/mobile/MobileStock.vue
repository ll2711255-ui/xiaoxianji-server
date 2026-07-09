<template>
  <div class="mobile-stock">
    <h3 class="page-title">库存管理</h3>

    <!-- 搜索栏 -->
    <el-input v-model="keyword" placeholder="搜索商品名称" clearable size="large" @input="onSearch" style="margin-bottom:12px">
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>

    <!-- 库存列表 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <div v-else-if="products.length === 0" class="empty-state">
      <el-icon :size="48"><Goods /></el-icon>
      <p>暂无商品</p>
    </div>

    <div v-for="p in products" :key="p.id" class="stock-card" @click="onEdit(p)">
      <div class="stock-card-left">
        <image v-if="p.image" :src="p.image" class="stock-thumb" mode="aspectFill" />
        <div v-else class="stock-thumb-placeholder">
          <el-icon :size="24"><Goods /></el-icon>
        </div>
        <div class="stock-info">
          <span class="stock-name">{{ p.name }}</span>
          <span class="stock-meta">{{ p.categoryName || '' }} · ¥{{ formatMoney(p.price) }}/{{ p.unit || '500g' }}</span>
        </div>
      </div>
      <div class="stock-card-right" :class="stockStatus(p).cls">
        <span class="stock-count">{{ p.stock || 0 }}</span>
        <span class="stock-label">{{ stockStatus(p).label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

const router = useRouter()
const products = ref([])
const keyword = ref('')
const loading = ref(false)

let _searchTimer = null

function formatMoney(fen) { return (fen / 100).toFixed(2) }

function stockStatus(product) {
  const s = product.stock || 0
  if (s <= 0) return { label: '售罄', cls: 'stock-out' }
  if (s < 10) return { label: '告急', cls: 'stock-low' }
  if (s < 50) return { label: '正常', cls: 'stock-ok' }
  return { label: '充足', cls: 'stock-full' }
}

async function loadProducts() {
  loading.value = true
  try {
    const res = await api.get('/merchant/products', { keyword: keyword.value, pageSize: 50 })
    products.value = (res && res.data && res.data.products) || (res && res.data) || []
  } catch (err) {
    console.error('加载商品失败:', err)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(loadProducts, 300)
}

function onEdit(product) {
  router.push('/products/' + product.id + '/edit')
}

onMounted(loadProducts)
</script>

<style scoped>
.mobile-stock { padding-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; color: #222; margin: 0 0 12px; }

.stock-card {
  background: #fff; border-radius: 12px; padding: 14px;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.stock-card:active { background: #fafafa; }
.stock-card-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.stock-thumb, .stock-thumb-placeholder {
  width: 56px; height: 56px; border-radius: 8px;
  background: #f5f5f5; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.stock-thumb { object-fit: cover; }
.stock-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.stock-name { font-size: 15px; font-weight: 600; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stock-meta { font-size: 12px; color: #999; }

.stock-card-right { text-align: center; flex-shrink: 0; margin-left: 8px; }
.stock-count { font-size: 22px; font-weight: 700; display: block; line-height: 1; }
.stock-label { font-size: 11px; }
.stock-out .stock-count { color: #F56C6C; }
.stock-low .stock-count { color: #F5A623; }
.stock-ok .stock-count { color: #67C23A; }
.stock-full .stock-count { color: #409EFF; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 60px 0; color: #999; gap: 12px;
}
</style>
