<template>
  <view class="page">
    <!-- ========== 地址列表 ========== -->
    <view v-if="addresses.length > 0" class="address-list">
      <view
        v-for="addr in addresses"
        :key="addr._id"
        class="address-card"
      >
        <!-- 地址信息（点击编辑或选择） -->
        <view class="addr-body" @click="isSelectMode ? onSelect(addr) : onEdit(addr)">
          <view class="addr-header">
            <text class="addr-name">{{ addr.name }}</text>
            <text class="addr-phone">{{ addr.phone }}</text>
            <view v-if="addr.isDefault" class="addr-tag-default">
              <text>默认</text>
            </view>
          </view>
          <text class="addr-detail">{{ formatFullAddress(addr) }}</text>
        </view>

        <!-- 操作栏 -->
        <view class="addr-actions">
          <view class="addr-action-item" @click="onSetDefault(addr)">
            <view class="action-radio" :class="{ checked: addr.isDefault }">
              <view v-if="addr.isDefault" class="radio-dot" />
            </view>
            <text :class="addr.isDefault ? 'action-label-active' : 'action-label'">默认地址</text>
          </view>
          <view class="action-divider" />
          <view class="addr-action-item" @click="onEdit(addr)">
            <text class="action-label-link">编辑</text>
          </view>
          <view class="action-divider" />
          <view class="addr-action-item" @click="onDelete(addr)">
            <text class="action-label-link">删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 空状态 ========== -->
    <view v-else-if="!loading" class="empty-state">
      <image class="empty-icon" src="/static/icons/ui/ui-empty.png" mode="aspectFit" />
      <text class="empty-title">还没有收货地址</text>
      <text class="empty-sub">点击下方按钮添加</text>
    </view>

    <!-- ========== 底部新增按钮 ========== -->
    <view class="footer-bar">
      <view class="add-btn" @click="onAdd">
        <text class="add-btn-text">+ 新增收货地址</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { get, put, del } from '@/utils/request'

// ========== State ==========
const addresses = ref([])
const loading = ref(true)
const isSelectMode = ref(false)

// ========== Lifecycle ==========
onLoad((options) => {
  // checkout 页面跳转时带 ?select=true，点击地址后回传选中地址
  isSelectMode.value = options && options.select === 'true'
})

onShow(() => {
  loadAddresses()
})

// ========== 数据加载 ==========
async function loadAddresses() {
  loading.value = true
  try {
    const res = await get('/addresses')
    addresses.value = (res && res.data && res.data.addresses) || []
  } catch (err) {
    console.error('[address] 加载地址失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
  loading.value = false
}

// ========== 格式化 ==========
function formatFullAddress(addr) {
  const parts = [addr.province || '', addr.city || '', addr.district || '', addr.detail || '']
  return parts.filter(Boolean).join('')
}

// ========== 操作 ==========
function onAdd() {
  uni.navigateTo({ url: '/pages/mine/address/form' })
}

function onSelect(addr) {
  // 选择模式：将地址通过临时 Storage 回传给 checkout 页面
  uni.setStorageSync('_tmp_selected_address', addr)
  uni.navigateBack()
}

function onEdit(addr) {
  uni.navigateTo({ url: '/pages/mine/address/form?id=' + addr._id })
}

async function onSetDefault(addr) {
  if (addr.isDefault) return
  try {
    const res = await uni.showModal({
      title: '设为默认地址',
      content: '确定将此地址设为默认吗？'
    })
    if (!res.confirm) return

    await put('/addresses/' + addr._id, { isDefault: true })
    uni.showToast({ title: '已设为默认地址', icon: 'success' })
    loadAddresses()
  } catch (err) {
    console.error('[address] 设置默认失败:', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function onDelete(addr) {
  try {
    const res = await uni.showModal({
      title: '删除地址',
      content: '确定删除此收货地址吗？',
      confirmColor: '#E8712A'
    })
    if (!res.confirm) return

    await del('/addresses/' + addr._id)
    uni.showToast({ title: '已删除', icon: 'success' })
    loadAddresses()
  } catch (err) {
    console.error('[address] 删除失败:', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style scoped>
/* ================================================================
   全局：背景 #FAF9F7 / 字体 14px / 主色 #E8712A
   ================================================================ */
.page {
  min-height: 100vh;
  background: #FAF9F7;
  padding-bottom: 120rpx;
}

/* ================================================================
   地址卡片
   ================================================================ */
.address-list {
  padding: 20rpx 24rpx;
}

.address-card {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.addr-body {
  padding: 28rpx 28rpx 20rpx;
}

.addr-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.addr-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-right: 20rpx;
}

.addr-phone {
  font-size: 28rpx;
  color: #666;
  flex: 1;
}

.addr-tag-default {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  border-radius: 6rpx;
  background: #FFF1F0;
}

.addr-tag-default text {
  font-size: 22rpx;
  color: #E8712A;
}

.addr-detail {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

/* ================================================================
   操作栏
   ================================================================ */
.addr-actions {
  display: flex;
  align-items: center;
  border-top: 1rpx solid #F0F0F0;
  padding: 0 28rpx;
  height: 80rpx;
}

.addr-action-item {
  display: flex;
  align-items: center;
}

.action-radio {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 2rpx solid #D0D0D0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8rpx;
}

.action-radio.checked {
  border-color: #E8712A;
}

.radio-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #E8712A;
}

.action-label {
  font-size: 26rpx;
  color: #999;
}

.action-label-active {
  font-size: 26rpx;
  color: #E8712A;
}

.action-label-link {
  font-size: 26rpx;
  color: #409EFF;
}

.action-divider {
  width: 1rpx;
  height: 28rpx;
  background: #E0E0E0;
  margin: 0 28rpx;
}

/* ================================================================
   空状态
   ================================================================ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 160rpx;
}

.empty-icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 30rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.empty-sub {
  font-size: 26rpx;
  color: #BFBFBF;
}

/* ================================================================
   底部新增按钮
   ================================================================ */
.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #FAF9F7;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background: #E8712A;
  border-radius: 44rpx;
}

.add-btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

.add-btn:active {
  opacity: 0.85;
}
</style>
