<template>
  <view class="login-page">
    <!-- ========== 品牌区 ========== -->
    <view class="brand-area">
      <view class="brand-icon-wrap"><text class="brand-icon">🐔</text></view>
      <text class="brand-name">小鲜鸡</text>
      <text class="brand-desc">新鲜鸡肉 · 每日直达</text>
    </view>

    <!-- ========== 登录卡片 ========== -->
    <view class="login-card">
      <!-- 头像选择 -->
      <view class="avatar-section">
        <!-- #ifdef MP-WEIXIN -->
        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image v-if="avatarUrl" class="avatar-preview" :src="avatarUrl" mode="aspectFill" />
          <view v-else class="avatar-placeholder">
            <text class="avatar-emoji">📷</text>
            <text class="avatar-tip">点击获取\n微信头像</text>
          </view>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="avatar-btn" @click="onChooseAvatarFallback">
          <image v-if="avatarUrl" class="avatar-preview" :src="avatarUrl" mode="aspectFill" />
          <view v-else class="avatar-placeholder">
            <text class="avatar-emoji">📷</text>
            <text class="avatar-tip">点击选择头像</text>
          </view>
        </view>
        <!-- #endif -->
      </view>

      <!-- 昵称输入 -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="nickname-section">
        <input class="nickname-input" type="nickname" placeholder="点击获取微信昵称" v-model="nickName" @blur="onNicknameBlur" maxlength="12" />
      </view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="nickname-section">
        <input class="nickname-input" placeholder="请输入昵称" v-model="nickName" maxlength="12" />
      </view>
      <!-- #endif -->

      <!-- 登录按钮 -->
      <button class="login-btn" :disabled="!avatarUrl || !nickName" :loading="submitting" @click="onLoginConfirm">
        {{ avatarUrl && nickName ? '进入小鲜鸡' : '请先完善头像和昵称' }}
      </button>

      <!-- 协议勾选 -->
      <view class="policy-row" @click="onTogglePolicy">
        <view class="policy-checkbox" :class="{ 'policy-checked': policyChecked }">
          <text v-if="policyChecked">✓</text>
        </view>
        <text class="policy-text">
          已阅读并同意<text class="policy-link">《用户服务协议》</text>和<text class="policy-link">《隐私政策》</text>
        </text>
      </view>
    </view>

    <!-- 微信一键登录（兜底） -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="alt-login">
      <text class="alt-divider-text">其他方式</text>
      <button class="wechat-login-btn" open-type="getPhoneNumber" @getphonenumber="onWechatLogin">
        <text>微信手机号快速登录</text>
      </button>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { post, upload } from '@/utils/request'
import { getLoginCode, getLoginEndpoint, getPhoneEndpoint } from '@/utils/auth'
import { saveLoginInfo } from '@/utils/auth'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const avatarUrl = ref('')
const nickName = ref('')
const policyChecked = ref(true)
const submitting = ref(false)

// ========== 微信头像选择 ==========
function onChooseAvatar(e) {
  const url = e.detail.avatarUrl
  if (url) avatarUrl.value = url
}

// 非微信平台：使用 uni.chooseImage 选择头像
function onChooseAvatarFallback() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      if (res.tempFilePaths && res.tempFilePaths[0]) {
        avatarUrl.value = res.tempFilePaths[0]
      }
    }
  })
}

// ========== 微信昵称获取 ==========
function onNicknameBlur(e) {
  const val = e.detail.value
  if (val) nickName.value = val
}

// ========== 登录确认 ==========
async function onLoginConfirm() {
  if (!policyChecked.value) {
    uni.showToast({ title: '请先阅读并同意服务协议', icon: 'none' })
    return
  }
  if (!avatarUrl.value || !nickName.value) {
    uni.showToast({ title: '请设置头像和昵称', icon: 'none' })
    return
  }

  submitting.value = true
  uni.showLoading({ title: '登录中...', mask: true })

  try {
    // 1. 获取平台 login code
    const code = await getLoginCode()

    // 2. 上传头像（非微信临时路径时）
    let finalAvatarUrl = avatarUrl.value
    if (avatarUrl.value && !avatarUrl.value.startsWith('http') && !avatarUrl.value.startsWith('https')) {
      try {
        const uploadedUrl = await upload('/upload/image', avatarUrl.value)
        if (uploadedUrl) finalAvatarUrl = uploadedUrl
      } catch (uploadErr) {
        console.warn('头像上传失败，使用原始路径:', uploadErr)
      }
    }

    // 3. 调用登录 API
    const res = await post(getLoginEndpoint(), {
      code,
      nickName: nickName.value,
      avatarUrl: finalAvatarUrl
    }, { skipAuth: true })

    if (res && res.success) {
      saveAndEnter(res.data)
    } else {
      throw new Error((res && res.message) || '登录失败')
    }
  } catch (err) {
    uni.hideLoading()
    submitting.value = false
    console.error('登录失败:', err)
    // 降级：跳过 API 直接进入（保留用户填写的信息）
    saveAndEnter({
      openid: authStore.openid || '',
      nickName: nickName.value,
      avatarUrl: avatarUrl.value,
      accessToken: '',
      refreshToken: ''
    })
  }
}

function saveAndEnter(data) {
  uni.hideLoading()
  submitting.value = false

  saveLoginInfo({
    accessToken: data.accessToken || '',
    refreshToken: data.refreshToken || '',
    openid: data.openid || '',
    nickName: data.nickName || nickName.value,
    avatarUrl: data.avatarUrl || avatarUrl.value,
    phone: data.phone || '',
    role: data.role || 'customer'
  })

  uni.redirectTo({ url: '/pages/index/index' })
}

// ========== 微信手机号一键登录（两步流程） ==========
// /auth/wx-phone 需要 verifyToken 中间件，必须先 wx.login 拿到 JWT
async function onWechatLogin(e) {
  if (e.detail.errMsg !== 'getPhoneNumber:ok') return
  uni.showLoading({ title: '登录中...', mask: true })

  try {
    // 步骤1: wx.login 获取 code
    const wxCode = await getLoginCode()
    if (!wxCode) {
      uni.hideLoading()
      uni.showToast({ title: '获取微信登录凭证失败', icon: 'none' })
      return
    }

    // 步骤2: /auth/wx-login 获取 JWT（skipAuth=true，此时尚无 token）
    const loginRes = await post(getLoginEndpoint(), { code: wxCode }, { skipAuth: true })
    if (!loginRes || !loginRes.success) {
      uni.hideLoading()
      uni.showToast({ title: (loginRes && loginRes.message) || '登录失败', icon: 'none' })
      return
    }

    // 步骤3: 保存 token（后续 /auth/wx-phone 需要 verifyToken）
    const loginData = loginRes.data
    saveLoginInfo({
      accessToken: loginData.accessToken || loginData.token,
      refreshToken: loginData.refreshToken,
      openid: loginData.openid || '',
      role: 'customer'
    })

    // 步骤4: /auth/wx-phone 绑定手机号（此时已有 token，不再 skipAuth）
    const phoneRes = await post(getPhoneEndpoint(), { phoneCode: e.detail.code })
    uni.hideLoading()

    if (phoneRes && phoneRes.success && phoneRes.data && phoneRes.data.phone) {
      uni.setStorageSync('phone', phoneRes.data.phone)
      authStore.phone = phoneRes.data.phone
    }
    uni.redirectTo({ url: '/pages/index/index' })
  } catch (err) {
    uni.hideLoading()
    console.error('手机号登录失败:', err)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  }
}

function onTogglePolicy() {
  policyChecked.value = !policyChecked.value
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background: var(--color-bg-warm-white);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
}

.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60rpx;
  margin-bottom: 50rpx;
}

.brand-icon-wrap {
  width: 140rpx; height: 140rpx;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx var(--color-brand-soy-red-shadow);
}

.brand-icon { font-size: 80rpx; }
.brand-name { font-size: 48rpx; font-weight:var(--weight-bold); color: var(--color-text-1); margin-bottom: 8rpx; }
.brand-desc { font-size: var(--font-base); color: var(--color-text-3); }

.login-card {
  width: 100%;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 48rpx 40rpx 36rpx;
  box-shadow: var(--shadow-card);
  display: flex; flex-direction: column; align-items: center;
}

.avatar-section { margin-bottom: 32rpx; }
.avatar-btn {
  width: 160rpx; height: 160rpx; border-radius: var(--radius-full);
  padding: 0; margin: 0; border: none; background: var(--color-bg-page);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.avatar-btn::after { border: none; }
.avatar-preview { width: 100%; height: 100%; border-radius: var(--radius-full); }
.avatar-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; }
.avatar-emoji { font-size: 52rpx; margin-bottom: 4rpx; }
.avatar-tip { font-size: var(--font-sm); color: var(--color-text-3); text-align: center; line-height: 1.3; }

.nickname-section { width: 100%; margin-bottom: 32rpx; }
.nickname-input {
  width: 100%; height: 88rpx; background: var(--color-bg-page);
  border-radius: var(--radius-lg); padding: 0 28rpx;
  font-size: var(--font-lg); color: var(--color-text-1); text-align: center; box-sizing: border-box;
}

.login-btn {
  width: 100%; height: 96rpx; border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  color: #FFFFFF; font-size: var(--font-lg); font-weight:var(--weight-bold);
  display: flex; align-items: center; justify-content: center;
  border: none; margin-bottom: 24rpx;
}
.login-btn[disabled] { background: var(--color-bg-page); color: var(--color-text-3); }
.login-btn::after { border: none; }

.policy-row { display: flex; align-items: flex-start; gap: 12rpx; }
.policy-checkbox {
  width: 36rpx; height: 36rpx; border-radius: var(--radius-full);
  border: 2rpx solid var(--color-border); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; margin-top: 2rpx;
}
.policy-checked { background: var(--color-primary); border-color: var(--color-primary); color: #fff; font-size: var(--font-sm); }
.policy-text { font-size: var(--font-md); color: var(--color-text-3); line-height: 1.5; }
.policy-link { color: var(--color-primary); }

.alt-login { width: 100%; margin-top: 56rpx; display: flex; flex-direction: column; align-items: center; gap: 24rpx; }
.alt-divider-text { font-size: var(--font-md); color: var(--color-text-3); }
.wechat-login-btn {
  width: 100%; height: 88rpx; background: var(--color-success); color: #FFFFFF;
  border-radius: var(--radius-full); font-size: var(--font-base);
  display: flex; align-items: center; justify-content: center; border: none;
}
.wechat-login-btn::after { border: none; }
</style>
