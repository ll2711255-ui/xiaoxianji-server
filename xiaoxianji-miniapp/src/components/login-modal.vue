<template>
  <view v-if="visible" class="login-overlay">
    <view class="login-card">
      <!-- 顶部品牌区（始终显示） -->
      <view class="brand-row">
        <image class="brand-icon" src="/static/icons/brand/brand-logo.png" mode="aspectFit" />
        <text class="brand-title">微信快捷登录</text>
      </view>

      <!-- 隐私说明区（normal 时显示） -->
      <text v-if="status === 'normal'" class="privacy-desc">一键登录即可下单、查看订单、领取优惠，不会获取你的微信头像与昵称</text>

      <!-- 视觉间隔 -->
      <view class="spacer" />

      <!-- Loading 动画（loading 时显示在按钮上方） -->
      <template v-if="status === 'loading'">
        <view class="loading-spinner" />
        <text class="loading-text">登录中，请稍候</text>
        <view class="spacer" />
      </template>

      <!-- 双按钮区（始终显示，loading/error 时视觉置灰） -->
      <view class="btn-row">
        <view
          class="btn-secondary"
          :class="{ 'btn-disabled': status !== 'normal' }"
          @click="status === 'normal' ? onSkip() : null"
        >
          <text>稍后再说</text>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <view
          class="btn-primary"
          :class="{ 'btn-disabled': status !== 'normal' }"
          @click="status === 'normal' ? onLogin() : null"
        >
          <text>微信一键登录</text>
        </view>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view
          class="btn-primary"
          :class="{ 'btn-disabled': status !== 'normal' }"
          @click="status === 'normal' ? onLogin() : null"
        >
          <text>一键登录</text>
        </view>
        <!-- #endif -->
      </view>

      <!-- 底部协议区（始终显示） -->
      <view class="agreement-row">
        <text class="agreement-text">
          登录即代表您同意
          <text class="agreement-link" @click="onViewService">《用户服务协议》</text>和
          <text class="agreement-link" @click="onViewPrivacy">《隐私政策》</text>
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getLoginCode, getLoginEndpoint, saveLoginInfo } from '@/utils/auth'
import { post } from '@/utils/request'

// ========== Props ==========
const props = defineProps({
  visible: { type: Boolean, default: false }
})

// ========== Emits ==========
const emit = defineEmits(['close', 'login-success'])

// ========== State ==========
const status = ref('normal') // 'normal' | 'loading' | 'error'

// visible 变化时重置状态
watch(() => props.visible, (val) => {
  if (val) {
    status.value = 'normal'
  }
})

// ========== 登录 ==========
async function onLogin() {
  if (status.value === 'loading') return // 防重复点击
  status.value = 'loading'

  try {
    // 步骤1: wx.login 获取 code（无微信授权弹窗，纯静默获取）
    const code = await getLoginCode()
    if (!code) {
      onLoginError()
      return
    }

    // 步骤2: 调用后端登录接口
    const loginRes = await post(getLoginEndpoint(), { code }, { skipAuth: true })

    if (!loginRes || !loginRes.success) {
      onLoginError()
      return
    }

    // 步骤3: 保存登录信息
    const d = loginRes.data
    saveLoginInfo({
      accessToken: d.accessToken || d.token || '',
      refreshToken: d.refreshToken || '',
      openid: d.openid || '',
      phone: d.phone || '',
      nickName: d.nickName || '',
      avatarUrl: d.avatarUrl || ''
    })

    // 步骤4: 通知父组件
    emit('login-success', {
      openid: d.openid || '',
      phone: d.phone || '',
      nickName: d.nickName || '',
      avatarUrl: d.avatarUrl || '',
      accessToken: d.accessToken || d.token || '',
      refreshToken: d.refreshToken || ''
    })
  } catch (err) {
    console.error('[login-modal] 登录失败:', err)
    onLoginError()
  }
}

function onLoginError() {
  status.value = 'error'
  uni.showToast({ title: '登录失败，请重新尝试', icon: 'none', duration: 2000 })
  // 短暂延迟后恢复按钮
  setTimeout(() => {
    if (props.visible) {
      status.value = 'normal'
    }
  }, 1500)
}

// ========== 跳过 ==========
function onSkip() {
  emit('close')
}

// ========== 协议 ==========
function onViewService() {
  uni.navigateTo({ url: '/pages/protocol/service' })
}

function onViewPrivacy() {
  uni.navigateTo({ url: '/pages/protocol/privacy' })
}
</script>

<style scoped lang="scss">
/* ========== 遮罩 ========== */
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

/* ========== 卡片 ========== */
.login-card {
  width: 85%;
  max-width: 640rpx;
  background: #FFFFFF;
  border-radius: 30rpx;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.12);
  padding: 48rpx 36rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

/* ========== 品牌区 ========== */
.brand-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.brand-icon { width:64rpx; height:64rpx; }

.brand-title {
  font-size: var(--font-xl);
  font-weight: var(--weight-bold);
  color: var(--color-text-1);
}

/* ========== 隐私说明 ========== */
.privacy-desc {
  font-size: var(--font-sm);
  color: #999999;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 32rpx;
  padding: 0 16rpx;
}

/* ========== 视觉间隔 ========== */
.spacer {
  height: 24rpx;
}

/* ========== 双按钮区 ========== */
.btn-row {
  display: flex;
  width: 100%;
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.btn-primary {
  flex: 1.5;
  height: 88rpx;
  background: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-xl);
  font-size: var(--font-base);
  font-weight: var(--weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.btn-primary:active {
  background: var(--color-primary-dark);
}

.btn-secondary {
  flex: 1;
  height: 88rpx;
  background: #FFFFFF;
  color: var(--color-text-2);
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-xl);
  font-size: var(--font-base);
  font-weight: var(--weight-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.btn-secondary:active {
  background: var(--color-bg-page);
}

.btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* ========== 底部协议 ========== */
.agreement-row {
  text-align: center;
  padding: 0 8rpx;
}

.agreement-text {
  font-size: var(--font-xs);
  color: #B0B0B0;
  line-height: 1.5;
}

.agreement-link {
  color: #4A90D9;
}

/* ========== Loading 状态 ========== */
.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 5rpx solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
  margin-bottom: 24rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-base);
  color: var(--color-text-2);
}
</style>
