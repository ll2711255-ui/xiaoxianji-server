<template>
  <div class="products-page">
    <!-- 顶部标题栏 -->
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <el-button type="primary" @click="$router.push('/products/new')">
        <el-icon><Plus /></el-icon> 新增商品
      </el-button>
    </div>

    <div class="content-wrap">
      <!-- ========== 左侧分类栏 280px ========== -->
      <aside class="cat-sidebar">
        <div class="cat-header">商品分类</div>
        <div class="cat-list">
          <div
            class="cat-item"
            :class="{ active: activeCat === '' }"
            @click="onCatSelect('')"
          >全部商品</div>
          <div
            v-for="cat in categories"
            :key="cat._id"
            class="cat-item"
            :class="{ active: activeCat === cat._id }"
            @click="onCatSelect(cat._id)"
          >
            <span class="cat-name">{{ cat.name }}</span>
            <el-icon class="cat-del" :size="14" @click.stop="onDeleteCat(cat)"><Close /></el-icon>
          </div>
        </div>
        <div class="cat-actions">
          <button class="cat-btn" @click="showAddCat = true">
            <el-icon><Plus /></el-icon><span>新增分类</span>
          </button>
          <button class="cat-btn" @click="sortMode = true">
            <el-icon><Sort /></el-icon><span>排序分类</span>
          </button>
        </div>
      </aside>

      <!-- ========== 右侧商品表格 ========== -->
      <section class="product-main">
        <!-- 搜索 + 筛选 -->
        <div class="toolbar">
          <el-input
            v-model="keyword"
            placeholder="搜索商品名称"
            clearable
            class="search-input"
            @input="onSearch"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="filter-btns">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              class="filter-btn"
              :class="{ active: statusFilter === opt.value }"
              @click="statusFilter = opt.value; loadProducts()"
            >{{ opt.label }}</button>
          </div>
        </div>

        <!-- 表格 -->
        <el-table
          :data="filteredProducts"
          v-loading="loading"
          class="product-table"
          row-class-name="product-row"
        >
          <el-table-column prop="name" label="商品名称" min-width="160" align="left" />
          <el-table-column label="分类" width="90" align="center">
            <template #default="{ row }">{{ getCatName(row.categoryId) }}</template>
          </el-table-column>
          <el-table-column label="计价方式" width="110" align="center">
            <template #default="{ row }">
              <span class="pricing-tag">{{ pricingLabel(row.pricing_type) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="最低价" width="90" align="right">
            <template #default="{ row }">
              <span class="col-price">¥{{ row.minPrice || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="sales" label="销量" width="80" align="right" sortable />
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.status === 'on'"
                @change="onToggleStatus(row)"
                class="prod-switch"
              />
            </template>
          </el-table-column>
          <el-table-column label="缺货" width="80" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="!!row.out_of_stock"
                @change="onToggleStock(row)"
                class="prod-switch"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" class="op-btn" @click="$router.push('/products/' + row._id + '/edit')">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 分类排序弹窗 -->
    <el-dialog v-model="sortMode" title="分类排序" width="500px">
      <el-table :data="sortedCats" row-key="_id">
        <el-table-column label="排序" width="60" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="name" label="分类名称" />
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ $index }">
            <el-button size="small" :disabled="$index === 0" @click="moveCat($index, -1)">上移</el-button>
            <el-button size="small" :disabled="$index === sortedCats.length - 1" @click="moveCat($index, 1)">下移</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="sortMode = false">取消</el-button>
        <el-button type="primary" @click="saveSort">保存排序</el-button>
      </template>
    </el-dialog>

    <!-- 新增分类弹窗 -->
    <el-dialog v-model="showAddCat" title="新增分类" width="400px">
      <el-input v-model="newCatName" placeholder="分类名称" maxlength="20" />
      <template #footer>
        <el-button @click="showAddCat = false">取消</el-button>
        <el-button type="primary" @click="addCategory">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const categories = ref([])
const activeCat = ref('')
const products = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('all')
const sortMode = ref(false)
const showAddCat = ref(false)
const newCatName = ref('')

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '上架', value: 'on' },
  { label: '下架', value: 'off' }
]

const sortedCats = computed(() => [...categories.value].sort((a, b) => a.sort - b.sort))

const filteredProducts = computed(() => {
  let list = products.value
  if (statusFilter.value !== 'all') {
    list = list.filter(p => p.status === statusFilter.value)
  }
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    list = list.filter(p => (p.name || '').toLowerCase().includes(kw) || (p.selling_point || '').toLowerCase().includes(kw))
  }
  return list
})

function pricingLabel(type) {
  return { range_weight: '整鸡规格', exact_weight: '按斤计价', per_piece: '按只计价' }[type] || type
}

function getCatName(id) {
  return (categories.value.find(c => c._id === id) || {}).name || '-'
}

async function loadCategories() {
  try {
    const res = await api.get('/categories')
    categories.value = (res && res.data && res.data.categories) || []
  } catch (err) { console.error('加载分类失败:', err) }
}

async function loadProducts() {
  loading.value = true
  try {
    const params = { pageSize: 50, status: 'all' }
    if (activeCat.value) params.categoryId = activeCat.value
    const res = await api.get('/products', params)
    products.value = (res && res.data && res.data.products) || []
  } catch (err) { console.error('加载商品失败:', err) }
  loading.value = false
}

function onCatSelect(id) { activeCat.value = id; loadProducts() }
function onSearch() { /* computed */ }

async function onToggleStatus(row) {
  const newStatus = row.status === 'on' ? 'off' : 'on'
  try { await ElMessageBox.confirm(`确定${newStatus === 'on' ? '上架' : '下架'}「${row.name}」吗？`) } catch { return }
  try {
    await api.patch('/products/' + row._id + '/status', { status: newStatus })
    ElMessage.success(`已${newStatus === 'on' ? '上架' : '下架'}`)
    loadProducts()
  } catch { ElMessage.error('操作失败'); loadProducts() }
}

async function onToggleStock(row) {
  const newVal = !row.out_of_stock
  try { await ElMessageBox.confirm(newVal ? '确定标记为缺货吗？' : '确定取消缺货标记吗？') } catch { return }
  try {
    await api.patch('/products/' + row._id + '/status', { outOfStock: newVal })
    ElMessage.success(newVal ? '已标记缺货' : '已取消缺货')
    loadProducts()
  } catch { ElMessage.error('操作失败'); loadProducts() }
}

function moveCat(index, dir) {
  const list = [...sortedCats.value]
  const newIdx = index + dir
  if (newIdx < 0 || newIdx >= list.length) return
  ;[list[index], list[newIdx]] = [list[newIdx], list[index]]
  list.forEach((c, i) => c.sort = i + 1)
  categories.value = list
}

async function saveSort() {
  const sorts = categories.value.map(({ _id }, i) => ({ _id, sort: i + 1 }))
  try {
    const res = await api.put('/categories/sort', { sorts })
    if (res && res.success) { ElMessage.success('排序已保存'); sortMode.value = false }
    else { ElMessage.error((res && res.message) || '保存失败') }
  } catch { ElMessage.error('保存失败') }
}

async function addCategory() {
  if (!newCatName.value.trim()) { ElMessage.warning('请输入分类名称'); return }
  try {
    const res = await api.post('/categories', { name: newCatName.value.trim() })
    if (res && res.success) { ElMessage.success('分类已添加'); showAddCat.value = false; newCatName.value = ''; loadCategories() }
    else { ElMessage.error((res && res.message) || '添加失败') }
  } catch { ElMessage.error('添加失败') }
}

async function onDeleteCat(cat) {
  try {
    await ElMessageBox.confirm(`确定删除分类「${cat.name}」吗？该分类下的商品不会被删除。`, '删除分类', { type: 'warning' })
  } catch { return }
  try {
    const res = await api.del('/categories/' + cat._id)
    if (res && res.success) {
      ElMessage.success('分类已删除')
      if (activeCat.value === cat._id) activeCat.value = ''
      loadCategories()
    } else {
      ElMessage.error((res && res.message) || '删除失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '删除失败')
  }
}

onMounted(() => { loadCategories(); loadProducts() })
</script>

<style scoped>
/* ================================================================
   全局：字体 14px / 颜色 #333 / 主色 #f5222d
   ================================================================ */
.products-page {
  font-size: 14px;
  color: #333;
}

/* ---- 顶部 ---- */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0;
}

/* ---- 左右布局 ---- */
.content-wrap {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

/* ================================================================
   左侧分类栏 — 固定 280px
   ================================================================ */
.cat-sidebar {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}
.cat-header {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #ebeef5;
}
.cat-list {
  padding: 8px 12px;
}

/* 分类项 — 垂直间距 12px */
.cat-item {
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  color: #555;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
  display: flex; align-items: center; justify-content: space-between;
}
.cat-item .cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-item .cat-del { flex-shrink: 0; opacity: 0; transition: opacity 0.15s; color: #999; }
.cat-item:hover .cat-del { opacity: 1; }
.cat-item .cat-del:hover { color: #f5222d; }
.cat-item:hover {
  background: #fff1f0;
  color: #f5222d;
}
.cat-item.active {
  background: #fff1f0;
  color: #f5222d;
  font-weight: 600;
}

/* 新增/排序按钮 — 通栏，左右对齐 */
.cat-actions {
  padding: 12px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 36px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  padding: 0;
}
.cat-btn:hover {
  color: #f5222d;
  border-color: #f5222d;
}
.cat-btn .el-icon {
  font-size: 14px;
  display: inline-flex;
  align-items: center;
}
.cat-btn span {
  line-height: 1;
}

/* ================================================================
   右侧商品区
   ================================================================ */
.product-main {
  flex: 1;
  min-width: 0;
}

/* ---- 搜索 + 筛选 ---- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.search-input {
  width: 320px;
  min-width: 320px;
}

/* 筛选按钮组 */
.filter-btns {
  display: flex;
  gap: 0;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  height: 32px;
}
.filter-btn {
  height: 32px;
  padding: 0 16px;
  font-size: 13px;
  color: #606266;
  background: #fff;
  border: none;
  border-right: 1px solid #dcdfe6;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.filter-btn:last-child { border-right: none; }
.filter-btn:hover { color: #f5222d; background: #fff5f5; }
.filter-btn.active {
  background: #f5222d;
  color: #fff;
}

/* ================================================================
   表格样式
   ================================================================ */
.product-table {
  font-size: 14px;
}

/* 表头：背景 #f5f7fa / 居中 / 加粗 */
:deep(.product-table .el-table__header th) {
  background: #f5f7fa !important;
  text-align: center !important;
  font-weight: 700;
  font-size: 14px;
  color: #333;
  padding: 12px 12px;
  border-bottom: 1px solid #e4e7ed;
  border-top: none;
}

/* 表头文字居中（含内部 wrapper） */
:deep(.product-table .el-table__header th .cell) {
  text-align: center !important;
  justify-content: center !important;
}

/* 统一单元格内边距 16px 12px */
:deep(.product-table .el-table__body td) {
  padding: 0 12px;
  height: 56px;
  border-top: none;
  border-bottom: 1px solid #eee;
}

/* 单元格内容垂直居中 */
:deep(.product-table .el-table__body td .cell) {
  padding: 0;
  line-height: 56px;
}

/* 行 hover */
:deep(.product-table .el-table__body tr:hover > td) {
  background: #fafafa;
}

/* ---- 列对齐覆盖 ---- */
:deep(.product-table .el-table__body td:first-child .cell) {
  text-align: left;
  justify-content: flex-start;
}

/* 价格列右对齐 */
.col-price {
  font-weight: 500;
  color: #f5222d;
}

/* 计价标签 */
.pricing-tag {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 10px;
  line-height: 1.6;
}

/* ================================================================
   开关组件 40x20px
   ================================================================ */
:deep(.prod-switch) {
  --el-switch-width: 40px;
  --el-switch-height: 20px;
}
:deep(.prod-switch .el-switch__core) {
  width: 40px !important;
  height: 20px !important;
  border-radius: 10px;
}
:deep(.prod-switch .el-switch__action) {
  width: 16px !important;
  height: 16px !important;
}
:deep(.prod-switch.is-checked .el-switch__action) {
  left: calc(100% - 18px) !important;
}

/* ================================================================
   操作按钮 — 蓝色
   ================================================================ */
:deep(.op-btn) {
  color: #409eff !important;
  font-size: 14px;
}
:deep(.op-btn:hover) {
  color: #66b1ff !important;
}
</style>
