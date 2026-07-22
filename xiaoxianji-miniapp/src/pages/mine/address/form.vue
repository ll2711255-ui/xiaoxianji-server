<template>
  <view class="page">
    <!-- ========== 智能地址搜索 ========== -->
    <view class="form-section">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索地址，自动填入下方信息"
          @input="onSearchInput"
          @focus="onSearchFocus"
          maxlength="50"
        />
        <text v-if="searchKeyword" class="search-clear" @click="clearSearch">✕</text>
      </view>

      <!-- 下拉建议列表 -->
      <view v-if="showSuggestions && suggestions.length > 0" class="suggestion-list">
        <view
          v-for="(item, idx) in suggestions"
          :key="idx"
          class="suggestion-item"
          @click="onSelectSuggestion(item)"
        >
          <view class="sugg-left">
            <image class="sugg-icon" src="/static/icons/ui/ui-location.png" mode="aspectFit" />
          </view>
          <view class="sugg-body">
            <text class="sugg-title">{{ item.title }}</text>
            <text class="sugg-detail">{{ item.address }}</text>
          </view>
        </view>
      </view>

      <!-- 无结果 -->
      <view v-if="showSuggestions && searchKeyword && suggestions.length === 0 && !searching" class="suggestion-empty">
        <text>未找到匹配地址，请尝试更具体的关键词</text>
      </view>
    </view>

    <!-- 分割线 -->
    <view class="divider-row">
      <view class="divider-line" />
      <text class="divider-text">或手动填写以下</text>
      <view class="divider-line" />
    </view>

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

      <!-- 详细地址 + 定位按钮 -->
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <input
          class="form-input detail-input"
          v-model="form.detail"
          placeholder="门牌号、街道、楼层等"
          maxlength="100"
        />
        <view class="locate-btn" @click="onLocateFill">
          <text class="locate-btn-text">{{ locating ? '定位中...' : '📍' }}</text>
        </view>
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
import { suggestAddress, reverseGeocode } from '@/utils/map'

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

// ========== 智能搜索 ==========
const searchKeyword = ref('')
const suggestions = ref([])
const showSuggestions = ref(false)
const searching = ref(false)
let searchTimer = null

// ========== 定位按钮 ==========
const locating = ref(false)

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

// ========== 智能地址搜索 ==========
function onSearchInput(e) {
  const val = e.detail ? e.detail.value : (e.target ? e.target.value : searchKeyword.value)
  searchKeyword.value = val
  if (searchTimer) clearTimeout(searchTimer)
  if (!val || !val.trim()) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  // 防抖 300ms
  searchTimer = setTimeout(() => {
    doSearch(val.trim())
  }, 300)
}

function onSearchFocus() {
  if (suggestions.value.length > 0) {
    showSuggestions.value = true
  }
}

async function doSearch(keyword) {
  searching.value = true
  // 优先限定在当前城市（如果已选城市）
  const city = form.city || ''
  const result = await suggestAddress(keyword, city)
  searching.value = false
  if (result.success) {
    suggestions.value = result.data || []
    showSuggestions.value = suggestions.value.length > 0
  } else {
    suggestions.value = []
    showSuggestions.value = false
    // 不弹 toast，静默失败（可能 Key 未配置）
    if (result.error) console.warn('[form] 地址搜索失败:', result.error)
  }
}

function onSelectSuggestion(item) {
  // 自动填充省市区
  form.province = item.province || ''
  form.city = item.city || ''
  form.district = item.district || ''
  if (item.province) {
    region.value = [item.province, item.city || '', item.district || '']
    regionText.value = region.value.filter(Boolean).join(' ')
  }
  // 详细地址（API 返回的 address 字段 = 区之后的部分）
  form.detail = item.address || ''
  // 坐标
  form.latitude = item.latitude || null
  form.longitude = item.longitude || null

  // 关闭下拉
  showSuggestions.value = false
  searchKeyword.value = ''
  suggestions.value = []
}

function clearSearch() {
  searchKeyword.value = ''
  suggestions.value = []
  showSuggestions.value = false
}

// ========== 定位获取地址 ==========
async function onLocateFill() {
  if (locating.value) return
  locating.value = true
  try {
    const locRes = await new Promise((resolve, reject) => {
      uni.getLocation({ type: 'gcj02', success: resolve, fail: reject })
    })
    const geoResult = await reverseGeocode(locRes.latitude, locRes.longitude)
    if (geoResult.success && geoResult.data) {
      const d = geoResult.data
      form.province = d.province || ''
      form.city = d.city || ''
      form.district = d.district || ''
      form.detail = d.recommend || d.street || d.address || ''
      form.latitude = locRes.latitude
      form.longitude = locRes.longitude
      if (d.province) {
        region.value = [d.province, d.city || '', d.district || '']
        regionText.value = region.value.filter(Boolean).join(' ')
      }
      uni.showToast({ title: '地址已识别', icon: 'success', duration: 1500 })
    } else {
      // 逆地址解析失败，至少记录坐标
      form.latitude = locRes.latitude
      form.longitude = locRes.longitude
      uni.showToast({ title: '已获取位置，请手动填写地址', icon: 'none', duration: 2000 })
    }
  } catch (err) {
    console.error('[form] 定位失败:', err)
    uni.showToast({ title: '定位失败，请检查定位权限', icon: 'none' })
  }
  locating.value = false
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
   智能搜索
   ================================================================ */
.search-box {
  display: flex;
  align-items: center;
  padding: 10rpx 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  margin: 20rpx 24rpx;
}

.search-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  height: 64rpx;
}

.search-input::placeholder {
  color: #BFBFBF;
}

.search-clear {
  font-size: 28rpx;
  color: #999;
  padding: 8rpx;
}

/* 下拉建议 */
.suggestion-list {
  background: #fff;
  margin: 0 24rpx;
  border-radius: 0 0 16rpx 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
  max-height: 480rpx;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 22rpx 24rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:active {
  background: #FAF9F7;
}

.sugg-left {
  margin-right: 16rpx;
}

.sugg-icon {
  width: 32rpx;
  height: 32rpx;
}

.sugg-body {
  flex: 1;
  overflow: hidden;
}

.sugg-title {
  font-size: 28rpx;
  color: #333;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sugg-detail {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-empty {
  background: #fff;
  padding: 32rpx 24rpx;
  text-align: center;
  margin: 0 24rpx;
  border-radius: 0 0 16rpx 16rpx;
}

.suggestion-empty text {
  font-size: 26rpx;
  color: #999;
}

/* 分割线 */
.divider-row {
  display: flex;
  align-items: center;
  padding: 24rpx 48rpx;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background: #E0DDD6;
}

.divider-text {
  font-size: 24rpx;
  color: #BFBFBF;
  margin: 0 20rpx;
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

/* 详细地址 + 定位按钮 */
.detail-input {
  flex: 1;
  margin-right: 8rpx;
}

.locate-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #FFF1F0;
  flex-shrink: 0;
}

.locate-btn:active {
  background: #FFE0D8;
}

.locate-btn-text {
  font-size: 28rpx;
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
