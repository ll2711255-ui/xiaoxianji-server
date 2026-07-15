<template>
  <view class="page">
    <!-- ========== 表单区域 ========== -->
    <view class="form-section">
      <!-- 姓名 -->
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input
          class="form-input"
          v-model="form.name"
          placeholder="请输入收货人姓名"
          maxlength="20"
        />
      </view>

      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input
          class="form-input"
          v-model="form.phone"
          type="number"
          placeholder="请输入手机号"
          maxlength="11"
        />
      </view>

      <!-- 所在地区 -->
      <view class="form-item">
        <text class="form-label">所在地区</text>
        <picker
          mode="region"
          :value="region"
          @change="onRegionChange"
          class="form-picker"
        >
          <text :class="regionText ? 'form-value' : 'form-placeholder'">
            {{ regionText || '请选择省市区' }}
          </text>
          <text class="form-arrow">›</text>
        </picker>
      </view>

      <!-- 详细地址 -->
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <input
          class="form-input"
          v-model="form.detail"
          placeholder="门牌号、街道、楼层等"
          maxlength="100"
        />
      </view>
    </view>

    <!-- ========== 默认地址开关 ========== -->
    <view class="form-section" style="margin-top: 20rpx;">
      <view class="form-item form-item-switch">
        <text class="form-label">设为默认地址</text>
        <switch
          :checked="form.isDefault"
          @change="form.isDefault = $event.detail.value"
          color="#E8712A"
        />
      </view>
    </view>

    <!-- ========== 保存按钮 ========== -->
    <view class="footer-bar">
      <view class="save-btn" @click="onSave">
        <text class="save-btn-text">保存地址</text>
      </view>

      <!-- 删除按钮（仅编辑模式） -->
      <view v-if="isEdit" class="delete-btn" @click="onDelete">
        <text class="delete-btn-text">删除此地址</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, put, del } from '@/utils/request'

// ========== 页面参数 ==========
const editId = ref('')
const isEdit = ref(false)

// ========== 表单数据 ==========
const form = reactive({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  latitude: null,
  longitude: null,
  isDefault: false
})

const region = ref([])
const regionText = ref('')

// ========== Lifecycle ==========
onLoad((options) => {
  if (options && options.id) {
    editId.value = options.id
    isEdit.value = true
    uni.setNavigationBarTitle({ title: '编辑地址' })
    loadAddress(options.id)
  }
})

// ========== 加载已有地址（编辑模式） ==========
async function loadAddress(id) {
  try {
    uni.showLoading({ title: '加载中...' })
    const res = await get('/addresses')
    const list = (res && res.data && res.data.addresses) || []
    const addr = list.find(a => a._id == id || a.id == id)
    if (addr) {
      form.name = addr.name || ''
      form.phone = addr.phone || ''
      form.province = addr.province || ''
      form.city = addr.city || ''
      form.district = addr.district || ''
      form.detail = addr.detail || ''
      form.latitude = addr.latitude || null
      form.longitude = addr.longitude || null
      form.isDefault = !!(addr.isDefault)
      if (addr.province) {
        region.value = [addr.province, addr.city || '', addr.district || '']
        regionText.value = region.value.join(' ')
      }
    }
    uni.hideLoading()
  } catch (err) {
    uni.hideLoading()
    console.error('[form] 加载地址失败:', err)
  }
}

// ========== 省市区选择 ==========
function onRegionChange(e) {
  const val = e.detail.value
  region.value = val
  regionText.value = val.join(' ')
  form.province = val[0] || ''
  form.city = val[1] || ''
  form.district = val[2] || ''
}

// ========== 表单校验 ==========
function validate() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入收货人姓名', icon: 'none' })
    return false
  }
  if (!form.phone.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return false
  }
  if (!form.province || !form.city || !form.district) {
    uni.showToast({ title: '请选择所在地区', icon: 'none' })
    return false
  }
  if (!form.detail.trim()) {
    uni.showToast({ title: '请输入详细地址', icon: 'none' })
    return false
  }
  return true
}

// ========== 保存 ==========
async function onSave() {
  if (!validate()) return

  uni.showLoading({ title: '保存中...' })
  try {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      province: form.province,
      city: form.city,
      district: form.district,
      detail: form.detail.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      isDefault: form.isDefault
    }

    if (isEdit.value) {
      await put('/addresses/' + editId.value, payload)
    } else {
      await post('/addresses', payload)
    }

    uni.hideLoading()
    uni.showToast({ title: isEdit.value ? '地址已更新' : '地址已添加', icon: 'success' })
    setTimeout(() => { uni.navigateBack() }, 800)
  } catch (err) {
    uni.hideLoading()
    console.error('[form] 保存地址失败:', err)
    uni.showToast({ title: err.message || '保存失败', icon: 'none' })
  }
}

// ========== 删除 ==========
async function onDelete() {
  try {
    const res = await uni.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除此地址吗？',
      confirmColor: '#E8712A'
    })
    if (!res.confirm) return

    uni.showLoading({ title: '删除中...' })
    await del('/addresses/' + editId.value)
    uni.hideLoading()
    uni.showToast({ title: '已删除', icon: 'success' })
    setTimeout(() => { uni.navigateBack() }, 800)
  } catch (err) {
    uni.hideLoading()
    console.error('[form] 删除地址失败:', err)
    uni.showToast({ title: err.message || '删除失败', icon: 'none' })
  }
}
</script>

<style scoped>
/* ================================================================
   全局：背景 #FAF9F7 / 主色 #E8712A
   ================================================================ */
.page {
  min-height: 100vh;
  background: #FAF9F7;
  padding-bottom: 200rpx;
}

/* ================================================================
   表单
   ================================================================ */
.form-section {
  background: #fff;
  margin: 0 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 28rpx 28rpx;
  border-bottom: 1rpx solid #F0F0F0;
  min-height: 88rpx;
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  width: 140rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  text-align: right;
}

.form-input::placeholder {
  color: #BFBFBF;
}

/* 省市区选择器 */
.form-picker {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.form-value {
  font-size: 28rpx;
  color: #333;
}

.form-placeholder {
  font-size: 28rpx;
  color: #BFBFBF;
}

.form-arrow {
  font-size: 32rpx;
  color: #BFBFBF;
  margin-left: 8rpx;
}

/* ================================================================
   开关行
   ================================================================ */
.form-item-switch {
  justify-content: space-between;
}

/* ================================================================
   底部操作
   ================================================================ */
.footer-bar {
  padding: 40rpx 24rpx;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background: #E8712A;
  border-radius: 44rpx;
}

.save-btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

.save-btn:active {
  opacity: 0.85;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin-top: 24rpx;
  background: #fff;
  border: 1rpx solid #E0DDD6;
  border-radius: 44rpx;
}

.delete-btn-text {
  font-size: 30rpx;
  color: #999;
}

.delete-btn:active {
  background: #FAF9F7;
}
</style>
