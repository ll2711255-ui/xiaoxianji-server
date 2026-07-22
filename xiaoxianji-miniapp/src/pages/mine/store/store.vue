<template>
  <view class="page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 店铺信息 -->
    <template v-else-if="store.name">
      <!-- 店铺头部 -->
      <view class="store-card">
        <view class="store-header">
          <image class="store-icon" src="/static/icons/ui/ui-store.png" mode="aspectFit" />
          <text class="store-name">{{ store.name }}</text>
        </view>

        <!-- 营业时间 -->
        <view class="info-row" v-if="store.openTime || store.closeTime">
          <text class="info-label">营业时间</text>
          <text class="info-value">{{ store.openTime || '--' }} - {{ store.closeTime || '--' }}</text>
        </view>

        <!-- 店铺地址（可点击导航） -->
        <view class="info-row" v-if="store.address" @click="onNavigate">
          <text class="info-label">店铺地址</text>
          <text class="info-value">{{ store.address }}</text>
          <text class="menu-arrow">›</text>
        </view>

        <!-- 配送范围 -->
        <view class="info-row" v-if="store.deliveryRadius">
          <text class="info-label">配送范围</text>
          <text class="info-value">{{ store.deliveryRadius }}km 内</text>
        </view>

        <!-- 联系电话 -->
        <view class="info-row" v-if="store.contactPhone" @click="onCallStore">
          <text class="info-label">联系电话</text>
          <text class="info-value link">{{ store.contactPhone }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <!-- 导航到店 -->
      <view class="nav-card" @click="onNavigate">
        <view class="nav-left">
          <text class="nav-icon">📍</text>
          <view class="nav-info">
            <text class="nav-title">导航到店</text>
            <text class="nav-sub">{{ store.address }}</text>
          </view>
        </view>
        <text class="nav-btn">开始导航</text>
      </view>
    </template>

    <!-- 暂无店铺信息 -->
    <view v-else class="empty-wrap">
      <text class="empty-text">暂无店铺信息</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/utils/request'

const store = ref({})
const loading = ref(true)

onShow(() => {
  fetchStoreInfo()
})

async function fetchStoreInfo() {
  loading.value = true
  try {
    const res = await get('/store')
    if (res && res.data && res.data.config) {
      const config = res.data.config
      // 确保坐标是数字类型
      store.value = {
        ...config,
        latitude: Number(config.latitude) || 23.1291,
        longitude: Number(config.longitude) || 113.2644,
      }
    }
  } catch (err) {
    console.error('[store] 获取店铺信息失败:', err)
  } finally {
    loading.value = false
  }
}

/** 导航到店 — 打开微信内置地图 */
function onNavigate() {
  if (!store.value.latitude || !store.value.longitude) {
    uni.showToast({ title: '店铺坐标未配置', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: store.value.latitude,
    longitude: store.value.longitude,
    name: store.value.name || '小鲜鸡',
    address: store.value.address || '',
    scale: 16,
  })
}

/** 拨打电话 */
function onCallStore() {
  if (store.value.contactPhone) {
    uni.makePhoneCall({ phoneNumber: store.value.contactPhone })
  }
}
</script>

<style scoped lang="scss">
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--color-bg-page); padding:24rpx; }

/* 加载中 */
.loading-wrap { display:flex; align-items:center; justify-content:center; padding:100rpx 0; }
.loading-text { font-size:var(--font-base); color:var(--color-text-3); }

/* 店铺卡片 */
.store-card { background:var(--color-bg-card); border-radius:var(--radius-lg); padding:32rpx 24rpx; margin-bottom:24rpx; }
.store-header { display:flex; align-items:center; margin-bottom:32rpx; padding-bottom:24rpx; border-bottom:1rpx solid var(--color-border); }
.store-icon { width:48rpx; height:48rpx; margin-right:16rpx; }
.store-name { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); }

/* 信息行 */
.info-row { display:flex; align-items:center; padding:20rpx 0; }
.info-row + .info-row { border-top:1rpx solid var(--color-border); }
.info-row:active { background:var(--color-bg-page); }
.info-label { width:140rpx; font-size:var(--font-base); color:var(--color-text-3); flex-shrink:0; }
.info-value { flex:1; font-size:var(--font-base); color:var(--color-text-1); }
.info-value.link { color:var(--color-primary); }
.menu-arrow { font-size:var(--font-xl); color:var(--color-text-4); }

/* 导航卡片 */
.nav-card { display:flex; align-items:center; justify-content:space-between; background:var(--color-bg-card); border-radius:var(--radius-lg); padding:28rpx 24rpx; }
.nav-card:active { background:var(--color-bg-page); }
.nav-left { display:flex; align-items:center; flex:1; overflow:hidden; }
.nav-icon { font-size:40rpx; margin-right:16rpx; flex-shrink:0; }
.nav-info { flex:1; overflow:hidden; }
.nav-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); display:block; }
.nav-sub { font-size:var(--font-sm); color:var(--color-text-3); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:4rpx; }
.nav-btn { background:var(--color-primary); color:#fff; font-size:var(--font-md); padding:12rpx 28rpx; border-radius:var(--radius-xl); flex-shrink:0; }

/* 空状态 */
.empty-wrap { display:flex; align-items:center; justify-content:center; padding:100rpx 0; }
.empty-text { font-size:var(--font-base); color:var(--color-text-3); }
</style>
