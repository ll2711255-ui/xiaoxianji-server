<template>
  <div>
    <h2 class="page-title">店铺设置</h2>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card header="店铺信息" style="margin-bottom:20px">
          <el-form label-width="100px" size="default">
            <el-form-item label="店铺名称">
              <el-input v-model="form.name" placeholder="店铺名称" />
            </el-form-item>
            <el-form-item label="店铺地址">
              <el-input v-model="form.address" type="textarea" :rows="2" placeholder="详细地址" />
            </el-form-item>
            <el-form-item label="经纬度">
              <el-row :gutter="8">
                <el-col :span="12"><el-input v-model="form.latitude" placeholder="纬度" /></el-col>
                <el-col :span="12"><el-input v-model="form.longitude" placeholder="经度" /></el-col>
              </el-row>
            </el-form-item>
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" placeholder="联系人姓名" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" placeholder="联系电话" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveShopInfo" :loading="saving.shop">保存店铺信息</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card header="配送 & 营业时间" style="margin-bottom:20px">
          <el-form label-width="120px" size="default">
            <el-form-item label="配送半径(公里)">
              <el-input-number v-model="form.deliveryRadius" :min="1" :max="50" :step="1" />
            </el-form-item>
            <el-form-item label="营业开始时间">
              <el-time-picker v-model="openTimeObj" format="HH:mm" value-format="HH:mm" placeholder="开始时间" />
            </el-form-item>
            <el-form-item label="营业结束时间">
              <el-time-picker v-model="closeTimeObj" format="HH:mm" value-format="HH:mm" placeholder="结束时间" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveDelivery" :loading="saving.delivery">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-result
      icon="success"
      title="店铺配置说明"
      sub-title="以上设置会实时同步到小程序端。修改后用户端将立即生效。"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const form = reactive({
  name: '小鲜鸡店铺', address: '', latitude: '23.1291', longitude: '113.2644',
  contactName: '', contactPhone: '', deliveryRadius: 5,
  openTime: '08:00', closeTime: '21:00'
})
const openTimeObj = ref('')
const closeTimeObj = ref('')
const saving = reactive({ shop: false, delivery: false })

async function loadConfig() {
  try {
    const res = await api.get('/store')
    const cfg = (res && res.data && res.data.config) || (res && res.data) || {}
    if (cfg.name) form.name = cfg.name
    if (cfg.address) form.address = cfg.address
    if (cfg.latitude) form.latitude = String(cfg.latitude)
    if (cfg.longitude) form.longitude = String(cfg.longitude)
    if (cfg.contactName) form.contactName = cfg.contactName
    if (cfg.contactPhone) form.contactPhone = cfg.contactPhone
    if (cfg.deliveryRadius) form.deliveryRadius = cfg.deliveryRadius
    if (cfg.openTime) { form.openTime = cfg.openTime; openTimeObj.value = cfg.openTime }
    if (cfg.closeTime) { form.closeTime = cfg.closeTime; closeTimeObj.value = cfg.closeTime }
  } catch (err) { console.error('加载店铺配置失败:', err) }
}

async function saveShopInfo() {
  if (!form.name.trim()) { ElMessage.warning('请输入店铺名称'); return }
  saving.shop = true
  try {
    const res = await api.put('/store', {
      name: form.name.trim(), address: form.address.trim(),
      latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
      contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim()
    })
    if (res && res.success) { ElMessage.success('店铺信息已更新') }
    else { ElMessage.error((res && res.message) || '保存失败') }
  } catch (err) { ElMessage.error('保存失败') }
  saving.shop = false
}

async function saveDelivery() {
  const ot = openTimeObj.value || form.openTime
  const ct = closeTimeObj.value || form.closeTime
  if (ot >= ct) { ElMessage.warning('开始时间必须早于结束时间'); return }
  saving.delivery = true
  try {
    const res = await api.put('/store', {
      deliveryRadius: form.deliveryRadius, openTime: ot, closeTime: ct
    })
    if (res && res.success) {
      form.openTime = ot; form.closeTime = ct
      ElMessage.success('配送 & 营业时间已更新')
    } else { ElMessage.error((res && res.message) || '保存失败') }
  } catch (err) { ElMessage.error('保存失败') }
  saving.delivery = false
}

onMounted(() => loadConfig())
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #333; margin-bottom: 20px; }
</style>
