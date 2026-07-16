<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push('/products')" :content="isEdit ? '编辑商品' : '新增商品'" style="margin-bottom:20px" />

    <el-card>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" size="default">
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商品名称" maxlength="30" />
        </el-form-item>
        <el-form-item label="分类" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="请选择分类">
            <el-option v-for="c in categories" :key="c._id" :label="c.name" :value="c._id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计价方式" prop="pricingType">
          <el-radio-group v-model="form.pricingType" @change="onPricingChange">
            <el-radio-button label="range_weight">整鸡规格</el-radio-button>
            <el-radio-button label="exact_weight">按斤计价</el-radio-button>
            <el-radio-button label="per_piece">按只计价</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="卖点">
          <el-input v-model="form.sellingPoint" placeholder="一句话卖点" maxlength="50" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="详细描述" />
        </el-form-item>
        <el-form-item label="取货方式">
          <el-checkbox-group v-model="form.deliveryModes">
            <el-checkbox label="delivery">外卖配送</el-checkbox>
            <el-checkbox label="pickup">到店自取</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="商品图片">
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start">
            <div v-for="(img, i) in images" :key="i" style="position:relative;width:100px;height:100px;border-radius:6px;overflow:hidden;border:1px solid #ebeef5">
              <img :src="img" style="width:100%;height:100%;object-fit:cover" />
              <span
                style="position:absolute;top:0;right:0;width:22px;height:22px;background:rgba(0,0,0,0.55);color:#fff;font-size:14px;line-height:22px;text-align:center;cursor:pointer;border-radius:0 0 0 6px"
                @click="onRemoveImage(i)"
              >×</span>
            </div>
            <el-upload
              :show-file-list="false"
              :http-request="onUploadImage"
              :before-upload="beforeImageUpload"
              accept="image/jpeg,image/png,image/gif,image/webp"
            >
              <div class="upload-trigger">
                <el-icon :size="24"><Plus /></el-icon>
                <span style="font-size:12px;color:#999;margin-top:4px">上传</span>
              </div>
            </el-upload>
          </div>
          <div style="color:#999;font-size:12px;margin-top:4px">支持 jpg/png/gif/webp，单张不超过 5MB，建议尺寸 750×750</div>
        </el-form-item>

        <!-- 按斤计价 -->
        <template v-if="form.pricingType === 'exact_weight'">
          <el-divider content-position="left">按斤计价参数</el-divider>
          <el-form-item label="单价(元/斤)">
            <el-input-number v-model="form.pricePerJin" :min="0.01" :max="999.99" :step="0.1" :precision="2" />
          </el-form-item>
          <el-form-item label="重量选项">
            <el-space wrap>
              <el-tag v-for="(w, i) in form.weightOptions" :key="i" closable @close="form.weightOptions.splice(i, 1)" size="large">
                {{ formatJin(w) }}
              </el-tag>
              <el-button size="small" @click="showAddWeight = true">+ 添加重量</el-button>
            </el-space>
          </el-form-item>
          <el-form-item label="加工费(元)">
            <el-input-number v-model="form.processingFee" :min="0" :max="50" :step="0.1" :precision="2" />
          </el-form-item>
        </template>

        <!-- 按只计价 -->
        <template v-if="form.pricingType === 'per_piece'">
          <el-divider content-position="left">按只计价参数</el-divider>
          <el-form-item label="单价(元/只)">
            <el-input-number v-model="form.unitPrice" :min="0.01" :max="999.99" :step="0.1" :precision="2" />
          </el-form-item>
          <el-form-item label="加工费(元)">
            <el-input-number v-model="form.processingFee" :min="0" :max="50" :step="0.1" :precision="2" />
          </el-form-item>
        </template>

        <!-- 整鸡规格 -->
        <template v-if="form.pricingType === 'range_weight'">
          <el-divider content-position="left">整鸡规格参数</el-divider>
          <div v-for="(tc, ti) in form.typeConfigs" :key="tc.idx" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:8px;">
            <el-row :gutter="12" align="middle">
              <el-col :span="8">
                <el-input v-model="tc.type" placeholder="称重类型（如：毛鸡称重）" size="small" />
              </el-col>
              <el-col :span="8">
                <el-input-number v-model="tc.price_per_jin" :min="0.01" :max="999.99" :step="0.1" :precision="2" size="small" controls-position="right" style="width:100%" />
              </el-col>
              <el-col :span="4"><span class="text-muted">元/斤</span></el-col>
              <el-col :span="4" style="text-align:right">
                <el-button size="small" type="danger" @click="form.typeConfigs.splice(ti, 1)" :disabled="form.typeConfigs.length <= 1">删除</el-button>
              </el-col>
            </el-row>
            <div style="margin-top:10px">
              <div v-for="(wc, wi) in tc.weightConfigs" :key="wc.idx" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
                <el-input v-model="wc.weight_label" placeholder="标签（如：3.0-3.5斤）" size="small" style="width:180px" />
                <el-input-number v-model="wc.weight_max" :min="100" :max="10000" :step="50" placeholder="最大克重" size="small" />
                <span class="text-muted">克</span>
                <el-button size="small" type="danger" :icon="Delete" circle @click="removeWeightConfig(ti, wi)" />
              </div>
              <el-button size="small" @click="addWeightConfig(ti)">+ 添加重量范围</el-button>
            </div>
          </div>
          <el-button @click="addTypeConfig">+ 添加称重类型</el-button>
        </template>

        <!-- 处理方式（通用） -->
        <el-divider content-position="left" v-if="form.pricingType !== 'range_weight'">处理方式</el-divider>
        <el-form-item label="处理方式" v-if="form.pricingType !== 'range_weight'">
          <el-checkbox-group v-model="checkedProcOpts">
            <el-checkbox v-for="o in procOptDefaults" :key="o" :label="o" :value="o" />
          </el-checkbox-group>
          <el-button size="small" style="margin-left:8px" @click="showAddProc = true">+ 自定义</el-button>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" @click="onSave" :loading="saving">{{ isEdit ? '保存修改' : '创建商品' }}</el-button>
          <el-button @click="$router.push('/products')">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 添加重量弹窗 -->
    <el-dialog v-model="showAddWeight" title="添加重量选项" width="350px">
      <el-input-number v-model="newWeightGrams" :min="100" :max="10000" :step="100" style="width:100%" />
      <div style="margin-top:8px;color:#999;text-align:center">{{ formatJin(newWeightGrams) }}</div>
      <template #footer>
        <el-button @click="showAddWeight = false">取消</el-button>
        <el-button type="primary" @click="addWeight">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加处理方式弹窗 -->
    <el-dialog v-model="showAddProc" title="添加处理方式" width="350px">
      <el-input v-model="newProcName" placeholder="处理方式名称" />
      <template #footer>
        <el-button @click="showAddProc = false">取消</el-button>
        <el-button type="primary" @click="addProc">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const isEdit = ref(!!route.params.id)
const productId = route.params.id || ''
const loading = ref(false)
const saving = ref(false)

const categories = ref([])
const procOptDefaults = ['整只', '切块']
const checkedProcOpts = ref([...procOptDefaults])
const showAddWeight = ref(false)
const newWeightGrams = ref(500)
const showAddProc = ref(false)
const newProcName = ref('')
const images = ref([])
const uploading = ref(false)

const form = reactive({
  name: '', categoryId: '', pricingType: 'exact_weight', sellingPoint: '', description: '',
  deliveryModes: ['delivery', 'pickup'],
  // exact_weight（存储元，提交时 ×100 转分）
  pricePerJin: 15.80, weightOptions: [500, 1000, 1500], processingFee: 0,
  // per_piece（存储元，提交时 ×100 转分）
  unitPrice: 25.00,
  // range_weight
  typeConfigs: []
})

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

function formatJin(grams) {
  const jin = grams / 500
  return (jin % 1 === 0 ? jin : jin.toFixed(1)) + '斤'
}

function onPricingChange() {
  if (form.pricingType === 'range_weight' && form.typeConfigs.length === 0) {
    form.typeConfigs = [
      { idx: 1, type: '毛鸡称重', price_per_jin: 17.00, weightConfigs: [
        { idx: 1, weight_label: '3.0-3.5斤', weight_max: 1750 },
        { idx: 2, weight_label: '3.5-4.0斤', weight_max: 2000 },
        { idx: 3, weight_label: '4.0-4.5斤', weight_max: 2250 }
      ]},
      { idx: 2, type: '光鸡称重', price_per_jin: 18.00, weightConfigs: [
        { idx: 1, weight_label: '2.5-3.0斤', weight_max: 1500 },
        { idx: 2, weight_label: '3.0-3.5斤', weight_max: 1750 },
        { idx: 3, weight_label: '3.5-4.0斤', weight_max: 2000 }
      ]}
    ]
  }
}

function addWeight() {
  if (!form.weightOptions.includes(newWeightGrams.value)) {
    form.weightOptions.push(newWeightGrams.value)
    form.weightOptions.sort((a, b) => a - b)
  }
  showAddWeight.value = false
}

function addTypeConfig() {
  const seq = form.typeConfigs.length + 1
  form.typeConfigs.push({ idx: seq, type: '', price_per_jin: 0, weightConfigs: [] })
}

function addWeightConfig(ti) {
  const tc = form.typeConfigs[ti]
  const seq = (tc.weightConfigs || []).length + 1
  tc.weightConfigs.push({ idx: seq, weight_label: '', weight_max: 0 })
}

function removeWeightConfig(ti, wi) {
  form.typeConfigs[ti].weightConfigs.splice(wi, 1)
}

function addProc() {
  if (newProcName.value.trim() && !checkedProcOpts.value.includes(newProcName.value.trim())) {
    checkedProcOpts.value.push(newProcName.value.trim())
  }
  showAddProc.value = false
  newProcName.value = ''
}

function generateSpecs() {
  const specs = []
  for (const t of form.typeConfigs) {
    const pricePerJinFen = Math.round(t.price_per_jin * 100)
    for (const w of (t.weightConfigs || [])) {
      for (const p of checkedProcOpts.value) {
        specs.push({ type: t.type, weight_label: w.weight_label, weight_max: w.weight_max, price_per_jin: pricePerJinFen, processing: p })
      }
    }
  }
  return specs
}

// ========== 图片上传 ==========
function beforeImageUpload(file) {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) { ElMessage.error('只能上传图片文件'); return false }
  if (!isLt5M) { ElMessage.error('图片大小不能超过 5MB'); return false }
  return true
}

async function onUploadImage(options) {
  uploading.value = true
  try {
    const res = await api.upload('/upload/image', options.file)
    if (res && res.success && res.data && res.data.url) {
      images.value.push(res.data.url)
      ElMessage.success('上传成功')
    } else {
      ElMessage.error((res && res.message) || '上传失败')
    }
  } catch (err) {
    ElMessage.error(err.message || '上传失败')
  }
  uploading.value = false
}

function onRemoveImage(index) {
  images.value.splice(index, 1)
}

async function loadCategories() {
  try {
    const res = await api.get('/categories')
    categories.value = (res && res.data && res.data.categories) || []
    if (!isEdit.value && categories.value.length > 0) {
      form.categoryId = categories.value[0]._id
    }
  } catch (err) { console.error('加载分类失败:', err) }
}

async function loadProduct() {
  loading.value = true
  try {
    const res = await api.get('/products/' + productId)
    if (!res || !res.success || !res.data || !res.data.product) {
      ElMessage.error('商品不存在')
      router.push('/products')
      return
    }
    const p = res.data.product
    form.name = p.name || ''
    form.categoryId = p.categoryId || ''
    form.pricingType = p.pricingType || 'exact_weight'
    form.sellingPoint = p.sellingPoint || ''
    form.description = p.description || ''
    form.deliveryModes = p.deliveryModes || ['delivery', 'pickup']
    images.value = Array.isArray(p.images) ? [...p.images] : []
    if (p.pricingType === 'exact_weight') {
      form.pricePerJin = (p.pricePerJin || 0) / 100
      form.weightOptions = p.weightOptions || [500]
      form.processingFee = (p.processingFee || 0) / 100
      checkedProcOpts.value = p.processingOptions || ['整只', '切块']
    } else if (p.pricingType === 'per_piece') {
      form.unitPrice = (p.unitPrice || 0) / 100
      form.processingFee = (p.processingFee || 0) / 100
      checkedProcOpts.value = p.processingOptions || ['整只', '切块']
    } else if (p.pricingType === 'range_weight') {
      const specs = p.specs || []
      const typeMap = {}
      const procSet = new Set()
      let ti = 0
      specs.forEach(s => {
        if (!typeMap[s.type]) { ti++; typeMap[s.type] = { idx: ti, type: s.type, price_per_jin: (s.price_per_jin || 0) / 100, weightConfigs: [] } }
        typeMap[s.type].weightConfigs.push({ idx: typeMap[s.type].weightConfigs.length + 1, weight_label: s.weight_label, weight_max: s.weight_max })
        procSet.add(s.processing)
      })
      form.typeConfigs = Object.values(typeMap)
      checkedProcOpts.value = [...procSet]
    }
  } catch (err) { console.error('加载商品失败:', err); ElMessage.error('加载商品失败') }
  loading.value = false
}

async function onSave() {
  if (!form.name.trim()) { ElMessage.warning('请输入商品名称'); return }
  if (!form.categoryId) { ElMessage.warning('请选择分类'); return }
  if (form.deliveryModes.length === 0) { ElMessage.warning('请至少选择一种取货方式'); return }

  const payload = {
    productId: isEdit.value ? productId : undefined,
    categoryId: form.categoryId,
    name: form.name.trim(),
    pricingType: form.pricingType,
    sellingPoint: form.sellingPoint.trim(),
    description: form.description.trim(),
    deliveryModes: form.deliveryModes,
    images: images.value
  }

  if (form.pricingType === 'exact_weight') {
    if (form.weightOptions.length === 0) { ElMessage.warning('请至少添加一个重量选项'); return }
    payload.pricePerJin = Math.round(form.pricePerJin * 100)
    payload.weightOptions = form.weightOptions
    payload.processingFee = Math.round(form.processingFee * 100)
    payload.processingOptions = checkedProcOpts.value
  } else if (form.pricingType === 'per_piece') {
    payload.unitPrice = Math.round(form.unitPrice * 100)
    payload.processingFee = Math.round(form.processingFee * 100)
    payload.processingOptions = checkedProcOpts.value
  } else if (form.pricingType === 'range_weight') {
    if (form.typeConfigs.length === 0) { ElMessage.warning('请至少添加一个称重类型'); return }
    if (checkedProcOpts.value.length === 0) { ElMessage.warning('请至少勾选一种处理方式'); return }
    for (const tc of form.typeConfigs) {
      if (!tc.type.trim()) { ElMessage.warning('请填写所有称重类型的名称'); return }
      if (!tc.weightConfigs || tc.weightConfigs.length === 0) { ElMessage.warning(`「${tc.type}」请至少添加一个重量范围`); return }
    }
    payload.specs = generateSpecs()
    payload.processingOptions = checkedProcOpts.value
  }

  saving.value = true
  try {
    let res
    if (isEdit.value) { res = await api.put('/products/' + productId, payload) }
    else { res = await api.post('/products', payload) }
    if (res && res.success) {
      ElMessage.success(isEdit.value ? '商品已更新' : '商品已创建')
      router.push('/products')
    } else {
      ElMessage.error((res && res.message) || '保存失败')
    }
  } catch (err) { ElMessage.error('保存失败') }
  saving.value = false
}

onMounted(async () => {
  await loadCategories()
  if (isEdit.value) { loadProduct() }
})
</script>

<style scoped>
.text-muted { color: #999; font-size: 12px; }
.upload-trigger {
  width:100px; height:100px; border:1px dashed #d9d9d9; border-radius:6px;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  cursor:pointer; transition:border-color 0.2s; background:#fafafa;
}
.upload-trigger:hover { border-color: #D4420A; }
</style>
