<template>
  <view class="page">
    <!-- ========== 用户信息头部 ========== -->
    <view class="user-header">
      <view class="user-avatar-wrap" @click="hasLogin ? '' : ''">
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="!hasLogin" class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <view class="avatar-placeholder"><text>👤</text></view>
        </button>
        <!-- #endif -->
        <image v-if="avatarUrl" class="user-avatar" :src="avatarUrl" mode="aspectFill" />
        <view v-else-if="hasLogin" class="avatar-placeholder"><text>👤</text></view>
        <view v-if="!hasLogin" class="avatar-placeholder" @click="onShowLoginModal"><text>👤</text></view>
      </view>

      <view class="user-info" @click="!hasLogin ? onShowLoginModal() : ''">
        <template v-if="hasLogin">
          <!-- #ifdef MP-WEIXIN -->
          <input v-if="!nickName" class="nickname-input" type="nickname" placeholder="点击设置昵称" @blur="onNicknameBlur" />
          <!-- #endif -->
          <text v-if="nickName" class="user-nickname">{{ nickName }}</text>
          <text class="user-phone">{{ maskedPhone || '未绑定手机' }}</text>
        </template>
        <template v-else>
          <text class="user-nickname">点击登录</text>
          <text class="user-phone">登录享受更多服务</text>
        </template>
      </view>

      <view v-if="hasLogin && !nickName" class="edit-tag"><text>设置昵称</text></view>
    </view>

    <!-- ========== 订单快捷入口 ========== -->
    <view class="section order-shortcuts">
      <view class="shortcut-item" @click="onOrderTap('pending')">
        <text class="shortcut-icon">⏳</text>
        <text class="shortcut-label">待付款</text>
        <view v-if="ongoingCount > 0" class="shortcut-badge">{{ ongoingCount > 99 ? '99+' : ongoingCount }}</view>
      </view>
      <view class="shortcut-item" @click="onOrderTap('active')">
        <text class="shortcut-icon">📦</text>
        <text class="shortcut-label">进行中</text>
      </view>
      <view class="shortcut-item" @click="onOrderTap('completed')">
        <text class="shortcut-icon">✅</text>
        <text class="shortcut-label">已完成</text>
      </view>
      <view class="shortcut-item" @click="onOrderTap('all')">
        <text class="shortcut-icon">📋</text>
        <text class="shortcut-label">全部订单</text>
      </view>
    </view>

    <!-- ========== 功能列表 ========== -->
    <view class="section menu-list">
      <view class="menu-item" @click="onAddressManage">
        <text class="menu-icon">📍</text>
        <text class="menu-label">收货地址</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="onScanPickup">
        <text class="menu-icon">📷</text>
        <text class="menu-label">扫码取货</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- ========== 商家端入口 ========== -->
    <view class="section menu-list">
      <view class="menu-item" @click="onMerchantEntry">
        <text class="menu-icon">🏪</text>
        <text class="menu-label">{{ isMerchant ? '商家后台' : '商家登录' }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- ========== 其他 ========== -->
    <view class="section menu-list">
      <view class="menu-item" @click="onContactService">
        <text class="menu-icon">📞</text>
        <text class="menu-label">联系客服</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="onAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-label">关于小鲜鸡</text>
        <text class="menu-hint">v{{ appVersion }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- ========== 开发工具（仅开发模式） ========== -->
    <view v-if="isDev" class="section menu-list">
      <view class="menu-item menu-item-danger" @click="onClearMockData">
        <text class="menu-icon">🧹</text>
        <text class="menu-label">清除模拟订单</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item menu-item-danger" @click="onClearTestData">
        <text class="menu-icon">💣</text>
        <text class="menu-label">清除全部测试数据</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- ========== 退出登录 ========== -->
    <view v-if="hasLogin" class="logout-btn" @click="onLogout">
      <text>退出登录</text>
    </view>

    <!-- ========== 登录弹窗 ========== -->
    <view v-if="showLoginModal" class="modal-mask" @click="onCloseModal">
      <view class="modal-card" @click.stop>
        <text class="modal-title">手机号快捷登录</text>
        <text class="modal-desc">授权手机号即可完成登录，无需输入密码</text>

        <view class="modal-protocol">
          <view class="protocol-check" @click="onToggleAgreement">
            <view class="check-circle" :class="{ 'check-active': agreedProtocol }">
              <text v-if="agreedProtocol">✓</text>
            </view>
          </view>
          <text class="protocol-text">
            已阅读并同意
            <text class="protocol-link" @click="onViewPrivacy">《隐私政策》</text>和
            <text class="protocol-link" @click="onViewService">《服务协议》</text>
          </text>
        </view>

        <text v-if="showAgreementTip" class="agreement-tip">请先阅读并同意服务协议</text>

        <!-- #ifdef MP-WEIXIN -->
        <button class="phone-login-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
          <text>微信手机号一键登录</text>
        </button>
        <!-- #endif -->

        <view class="modal-cancel" @click="onCloseModal"><text>暂不登录</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '@/utils/request'
import { clearAuth, STORAGE_KEYS, getLoginCode, getLoginEndpoint, saveLoginInfo } from '@/utils/auth'
import { clearTokens } from '@/utils/request'

// ========== State ==========
const avatarUrl = ref('')
const nickName = ref('')
const phone = ref('')
const maskedPhone = ref('')
const hasLogin = ref(false)
const isLoggedIn = ref(false)
const showLoginModal = ref(false)
const agreedProtocol = ref(false)
const showAgreementTip = ref(false)
const ongoingCount = ref(0)
const isMerchant = ref(false)
const appVersion = ref('1.0.0')
const isDev = ref(false)

// ========== Lifecycle ==========
onShow(() => {
  loadUserInfo()
  fetchOngoingCount()
})

// 页面加载时获取版本号
try {
  const accountInfo = uni.getAccountInfoSync()
  if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) {
    appVersion.value = accountInfo.miniProgram.version
  }
} catch (_) {}

// ========== 用户信息 ==========
function loadUserInfo() {
  const userInfo = uni.getStorageSync('userInfo') || {}
  const p = uni.getStorageSync('phone') || ''
  const role = uni.getStorageSync(STORAGE_KEYS.role) || uni.getStorageSync('merchant_role') || ''
  const isM = role === 'merchant' || role === 'admin'

  avatarUrl.value = userInfo.avatarUrl || ''
  nickName.value = userInfo.nickName || ''
  phone.value = p
  maskedPhone.value = maskPhone(p)
  hasLogin.value = !!(nickName.value || p)
  isLoggedIn.value = !!p
  isMerchant.value = isM
}

function maskPhone(p) {
  if (!p || p.length < 8) return p || ''
  return p.slice(0, 3) + '****' + p.slice(7)
}

// ========== 进行中订单数 ==========
async function fetchOngoingCount() {
  try {
    const res = await get('/orders', { status: 'pending,paid,accepted,weighed,processing,delivering,ready', pageSize: 99 })
    const orders = (res && res.data && res.data.orders) || []
    const count = (res && res.data && res.data.total !== undefined) ? res.data.total : orders.length
    ongoingCount.value = count
  } catch (err) {
    console.error('[mine] 获取进行中订单数失败:', err)
  }
}

// ========== 登录弹窗 ==========
function onShowLoginModal() {
  showLoginModal.value = true
  agreedProtocol.value = false
  showAgreementTip.value = false
}

function onCloseModal() {
  showLoginModal.value = false
}

function onToggleAgreement() {
  agreedProtocol.value = !agreedProtocol.value
  showAgreementTip.value = false
}

function onViewPrivacy() {
  uni.showModal({ title: '隐私政策', content: '小鲜鸡重视您的隐私。我们仅在您授权后获取手机号用于订单服务，不会向第三方泄露您的个人信息。', showCancel: false })
}

function onViewService() {
  uni.showModal({ title: '服务协议', content: '使用小鲜鸡服务即表示您同意遵守平台规则，包括但不限于订单、配送、售后等相关条款。', showCancel: false })
}

async function onGetPhoneNumber(e) {
  if (!agreedProtocol.value) {
    showAgreementTip.value = true
    return
  }

  // 模拟器兜底
  if (!e.detail.code) {
    handleLoginSuccess('13800008888', 'mock_openid')
    return
  }

  if (e.detail.errMsg !== 'getPhoneNumber:ok') {
    uni.showToast({ title: '授权已取消', icon: 'none' })
    return
  }

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
    const phoneRes = await post('/auth/wx-phone', { phoneCode: e.detail.code })
    uni.hideLoading()

    const d = (phoneRes && phoneRes.data) || phoneRes || {}
    if (d.phone) {
      handleLoginSuccess(d.phone, d.openid || '')
    } else {
      uni.showToast({ title: (phoneRes && phoneRes.message) || '登录失败', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    console.error('[mine] 手机号登录失败:', err)
    uni.showToast({ title: '网络异常，请重试', icon: 'none' })
  }
}

function handleLoginSuccess(phoneNum, openid) {
  uni.setStorageSync('phone', phoneNum)
  if (openid && openid !== 'mock_openid') {
    uni.setStorageSync(STORAGE_KEYS.openid, openid)
  }

  phone.value = phoneNum
  maskedPhone.value = maskPhone(phoneNum)
  hasLogin.value = true
  isLoggedIn.value = true
  showLoginModal.value = false
  agreedProtocol.value = false
  showAgreementTip.value = false

  uni.showToast({ title: '登录成功', icon: 'success' })
}

// ========== 头像 & 昵称 ==========
function onChooseAvatar(e) {
  const url = e.detail.avatarUrl
  if (!url) return
  const userInfo = { nickName: nickName.value, avatarUrl: url }
  uni.setStorageSync('userInfo', userInfo)
  avatarUrl.value = url
  hasLogin.value = true

  // 上传至后端
  uni.uploadFile({
    url: (import.meta.env.VITE_API_BASE_URL || 'https://www.xuaioxianji.top') + '/api/upload/image',
    filePath: url,
    name: 'file',
    success: (res) => {
      try {
        const data = JSON.parse(res.data)
        if (data.success && data.data && data.data.url) {
          const updated = { nickName: nickName.value, avatarUrl: data.data.url }
          uni.setStorageSync('userInfo', updated)
          avatarUrl.value = data.data.url
        }
      } catch (_) {}
    }
  })
}

function onNicknameBlur(e) {
  const name = e.detail.value
  if (!name) return
  const userInfo = uni.getStorageSync('userInfo') || {}
  userInfo.nickName = name
  uni.setStorageSync('userInfo', userInfo)
  nickName.value = name
  hasLogin.value = true
}

// ========== 功能入口 ==========
function onOrderTap(tab) {
  uni.navigateTo({ url: '/pages/orders/orders?tab=' + tab })
}

function onAddressManage() {
  uni.navigateTo({ url: '/pages/mine/address/address' })
}

function onScanPickup() {
  // #ifdef MP-WEIXIN
  uni.scanCode({
    onlyFromCamera: true,
    scanType: ['qrCode'],
    success: (res) => {
      const params = {}
      const parts = res.result.split('&')
      parts.forEach(part => {
        const [key, value] = part.split('=')
        if (key && value) params[key] = value
      })
      if (params.orderNo && params.token) {
        uni.navigateTo({ url: '/pages/pickup/pickup?orderNo=' + params.orderNo + '&token=' + params.token })
      } else {
        uni.showToast({ title: '无效的取货码', icon: 'none' })
      }
    },
    fail: () => { uni.showToast({ title: '扫码已取消', icon: 'none' }) }
  })
  // #endif
}

function onMerchantEntry() {
  if (isMerchant.value) {
    uni.navigateTo({ url: '/pages/merchant/orders/orders' })
  } else {
    uni.navigateTo({ url: '/pages/merchantLogin/merchantLogin' })
  }
}

function onContactService() {
  uni.makePhoneCall({ phoneNumber: '4000000000' })
}

function onAbout() {
  uni.showModal({ title: '小鲜鸡', content: '新鲜鸡肉，品质保证\n版本 ' + appVersion.value, showCancel: false })
}

// ========== 开发工具 ==========
function onClearMockData() {
  uni.showModal({
    title: '清除模拟数据',
    content: '将清除所有模拟创建的订单，恢复为初始种子数据。确定继续？',
    confirmText: '确认清除',
    confirmColor: '#A83108',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const result = await post('/dev/clear-mock-orders')
        uni.showToast({ title: (result && result.message) || '已清除', icon: 'success', duration: 2000 })
      } catch (err) {
        console.error('清除模拟数据失败:', err)
        uni.showToast({ title: '清除失败', icon: 'none' })
      }
    }
  })
}

function onClearTestData() {
  uni.showModal({
    title: '清除全部测试数据',
    content: '将清空所有订单（含线上+线下），重置全部号码牌为 idle 状态。此操作不可恢复，确定继续？',
    confirmText: '确认清除全部',
    confirmColor: '#A83108',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const result = await post('/dev/clear-test-data')
        uni.showToast({ title: (result && result.message) || '已清除', icon: 'success', duration: 2500 })
      } catch (err) {
        console.error('清除测试数据失败:', err)
        uni.showToast({ title: '清除失败', icon: 'none' })
      }
    }
  })
}

// ========== 退出登录 ==========
function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后需重新授权登录，确定要退出吗？',
    success: (res) => {
      if (!res.confirm) return
      clearAuth()
      clearTokens()
      uni.removeStorageSync('merchant_role')
      avatarUrl.value = ''
      nickName.value = ''
      phone.value = ''
      maskedPhone.value = ''
      hasLogin.value = false
      isLoggedIn.value = false
      isMerchant.value = false
      ongoingCount.value = 0
      uni.showToast({ title: '已退出', icon: 'success' })
    }
  })
}
</script>

<style scoped lang="scss">
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--color-bg-page); padding-bottom:40rpx; }

/* 用户头部 */
.user-header { display:flex; align-items:center; background:var(--color-bg-card); padding:40rpx 32rpx; margin-bottom:16rpx; gap:20rpx; }
.user-avatar-wrap { position:relative; flex-shrink:0; }
.user-avatar { width:120rpx; height:120rpx; border-radius:var(--radius-full); background:var(--color-bg-page); }
.avatar-placeholder { width:120rpx; height:120rpx; border-radius:var(--radius-full); background:var(--color-bg-page); display:flex; align-items:center; justify-content:center; font-size:56rpx; }
.avatar-btn { padding:0; margin:0; background:transparent; border:none; width:120rpx; height:120rpx; border-radius:var(--radius-full); overflow:hidden; line-height:1; }
.avatar-btn::after { border:none; }

.user-info { flex:1; overflow:hidden; }
.user-nickname { font-size:var(--font-xl); font-weight:700; color:var(--color-text-1); display:block; }
.user-phone { font-size:var(--font-md); color:var(--color-text-3); margin-top:8rpx; display:block; }
.nickname-input { font-size:var(--font-xl); font-weight:700; color:var(--color-text-1); background:transparent; border:none; padding:0; height:auto; }
.edit-tag { padding:6rpx 16rpx; background:var(--color-primary-pale); border-radius:var(--radius-md); font-size:var(--font-sm); color:var(--color-primary); }

/* 订单快捷入口 */
.order-shortcuts { display:flex; padding:20rpx 0 !important; }
.shortcut-item { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
.shortcut-icon { font-size:44rpx; margin-bottom:8rpx; }
.shortcut-label { font-size:var(--font-sm); color:var(--color-text-2); }
.shortcut-badge { position:absolute; top:0; right:50%; transform:translateX(150%); min-width:32rpx; height:32rpx; background:var(--color-primary); color:#fff; font-size:var(--font-xs); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; padding:0 6rpx; }

/* 菜单列表 */
.section { background:var(--color-bg-card); padding:0; margin:0 24rpx 16rpx; border-radius:var(--radius-lg); overflow:hidden; }
.menu-list { }
.menu-item { display:flex; align-items:center; padding:24rpx; border-bottom:1rpx solid var(--color-border); }
.menu-item:last-child { border-bottom:none; }
.menu-item:active { background:var(--color-bg-page); }
.menu-item-danger:active { background:var(--color-danger-bg); }
.menu-icon { font-size:var(--font-lg); margin-right:16rpx; flex-shrink:0; }
.menu-label { flex:1; font-size:var(--font-base); color:var(--color-text-1); }
.menu-hint { font-size:var(--font-sm); color:var(--color-text-3); margin-right:8rpx; }
.menu-arrow { font-size:var(--font-xl); color:var(--color-text-4); }

/* 退出登录 */
.logout-btn { margin:40rpx 24rpx; padding:20rpx 0; text-align:center; background:var(--color-bg-card); border-radius:var(--radius-xl); font-size:var(--font-base); color:var(--color-danger); }

/* 弹窗 */
.modal-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:200; }
.modal-card { background:#fff; border-radius:var(--radius-xl); padding:40rpx 32rpx; margin:0 48rpx; width:100%; max-width:560rpx; display:flex; flex-direction:column; align-items:center; }
.modal-title { font-size:var(--font-xl); font-weight:700; color:var(--color-text-1); margin-bottom:12rpx; }
.modal-desc { font-size:var(--font-md); color:var(--color-text-3); text-align:center; margin-bottom:24rpx; }

.modal-protocol { display:flex; align-items:center; margin-bottom:16rpx; }
.protocol-check { padding:8rpx; }
.check-circle { width:36rpx; height:36rpx; border-radius:var(--radius-full); border:2rpx solid var(--color-border-dark); display:flex; align-items:center; justify-content:center; font-size:var(--font-xs); color:transparent; }
.check-active { border-color:var(--color-primary); background:var(--color-primary); color:#fff; }
.protocol-text { font-size:var(--font-sm); color:var(--color-text-3); line-height:1.6; }
.protocol-link { color:var(--color-primary); }
.agreement-tip { font-size:var(--font-sm); color:var(--color-danger); margin-bottom:12rpx; }

.phone-login-btn { width:100%; background:var(--color-primary); color:#fff; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:600; padding:18rpx 0; text-align:center; border:none; }
.phone-login-btn::after { border:none; }
.modal-cancel { margin-top:20rpx; font-size:var(--font-md); color:var(--color-text-3); }
</style>
