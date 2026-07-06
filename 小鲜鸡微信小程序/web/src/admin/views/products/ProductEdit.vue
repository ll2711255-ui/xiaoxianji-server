<template>
  <div>
    <el-page-header :content="isEdit?'编辑商品':'新增商品'" @back="$router.back()" style="margin-bottom:16px" />
    <el-card>
      <el-form :model="form" label-width="100px" ref="formRef">
        <el-form-item label="商品名称" required><el-input v-model="form.name" placeholder="例：清远走地鸡" /></el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.categoryId">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计价方式" required>
          <el-radio-group v-model="form.pricingType">
            <el-radio value="exact_weight">称重计价</el-radio>
            <el-radio value="range_weight">规格计价（整鸡）</el-radio>
            <el-radio value="per_piece">按只计价</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.pricingType==='exact_weight'" label="每斤价格(分)"><el-input-number v-model="form.pricePerJin" :min="0" /></el-form-item>
        <el-form-item v-if="form.pricingType==='per_piece'" label="每只价格(分)"><el-input-number v-model="form.unitPrice" :min="0" /></el-form-item>
        <el-form-item label="加工费(分)"><el-input-number v-model="form.processingFee" :min="0" /></el-form-item>
        <el-form-item label="库存"><el-input-number v-model="form.stockQuantity" :min="0" /></el-form-item>
        <el-form-item label="告警阈值"><el-input-number v-model="form.stockAlertThreshold" :min="0" /></el-form-item>
        <el-form-item label="产地"><el-input v-model="form.origin" placeholder="例：广东清远" /></el-form-item>
        <el-form-item label="卖点"><el-input v-model="form.sellingPoint" placeholder="一句话卖点" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSubmit" :loading="submitting">保存</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { productApi, categoryApi } from '../../../shared/api';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const submitting = ref(false);
const categories = ref<any[]>([]);

const form = reactive({
  name: '', categoryId: '', pricingType: 'exact_weight', pricePerJin: 0,
  unitPrice: 0, processingFee: 0, stockQuantity: 0, stockAlertThreshold: 5,
  origin: '', sellingPoint: '',
});

async function onSubmit() {
  submitting.value = true;
  try {
    if (isEdit.value) {
      await productApi.update(Number(route.params.id), form);
    } else {
      await productApi.create(form);
    }
    ElMessage.success(isEdit.value ? '已更新' : '已创建');
    router.back();
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  const res: any = await categoryApi.list();
  categories.value = res.data || [];
  if (isEdit.value) {
    // 加载商品详情
    const prod: any = await productApi.detail(Number(route.params.id));
    const d = prod.data || prod;
    Object.assign(form, {
      name: d.name, categoryId: d.category_id,
      pricingType: d.pricing_type, pricePerJin: d.price_per_jin,
      unitPrice: d.unit_price, processingFee: d.processing_fee,
      stockQuantity: d.stock_quantity, stockAlertThreshold: d.stock_alert_threshold,
      origin: d.origin, sellingPoint: d.selling_point,
    });
  }
});
</script>
