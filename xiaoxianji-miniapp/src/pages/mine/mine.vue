<template>
  <view class="page">
    <!-- ========== 用户信息头部 ========== -->
    <view class="user-header">
      <view class="user-avatar-wrap" @click="onAvatarClick">
        <image
          v-if="hasLogin && avatarUrl"
          class="user-avatar"
          :src="avatarUrl"
          mode="aspectFill"
        />
        <view v-else-if="hasLogin && !avatarUrl" class="avatar-placeholder-brand">
          <image class="brand-logo-sm" src="/static/icons/brand/brand-logo.png" mode="aspectFit" />
        </view>
        <view v-else class="avatar-placeholder">
          <image class="avatar-default-icon" src="/static/icons/avatar/avatar-default.png" mode="aspectFit" />
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <button
          v-if="showProfileModal"
          class="avatar-edit-btn-transparent"
          open-type="chooseAvatar"
          @chooseavatar="onChooseAvatar"
        />
        <!-- #endif -->
      </view>

      <view class="user-info" @click="onAvatarClick">
        <template v-if="hasLogin">
          <!-- #ifdef MP-WEIXIN -->
          <input
            v-if="!nickName"
            class="nickname-input"
            type="nickname"
            placeholder="点击设置昵称"
            @blur="onNicknameBlur"
          />
          <!-- #endif -->
          <text v-if="nickName" class="user-nickname">{{ nickName }}</text>
          <text class="user-phone">{{ maskedPhone || '未绑定手机' }}</text>
        </template>
        <template v-else>
          <text class="user-nickname">点击登录</text>
          <text class="user-phone">登录享受更多服务</text>
        </template>
      </view>

      <view v-if="hasLogin && !nickName" class="edit-tag" @click="onAvatarClick">
        <text>设置昵称</text>
      </view>
    </view>

    <!-- ========== 订单快捷入口 ========== -->
    <view class="section order-shortcuts">
      <view class="shortcut-item" @click="onOrderTap('pending')">
        <image class="shortcut-icon" src="/static/icons/order-shortcuts/icon-order-pending.png" mode="aspectFit" />
        <text class="shortcut-label">待付款</text>
        <view v-if="ongoingCount > 0" class="shortcut-badge">{{ ongoingCount > 99 ? '99+' : ongoingCount }}</view>
      </view>
      <view class="shortcut-item" @click="onOrderTap('active')">
        <image class="shortcut-icon" src="/static/icons/order-shortcuts/icon-order-active.png" mode="aspectFit" />
        <text class="shortcut-label">进行中</text>
      </view>
      <view class="shortcut-item" @click="onOrderTap('completed')">
        <image class="shortcut-icon" src="/static/icons/order-shortcuts/icon-order-done.png" mode="aspectFit" />
        <text class="shortcut-label">已完成</text>
      </view>
      <view class="shortcut-item" @click="onOrderTap('all')">
        <image class="shortcut-icon" src="/static/icons/order-shortcuts/icon-order-all.png" mode="aspectFit" />
        <text class="shortcut-label">全部订单</text>
      </view>
    </view>

    <!-- ========== 功能列表 ========== -->
    <view class="section menu-list">
      <view class="menu-item" @click="onAddressManage">
        <image class="menu-icon" src="/static/icons/menu/icon-address.png" mode="aspectFit" />
        <text class="menu-label">收货地址</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="onScanPickup">
        <image class="menu-icon" src="/static/icons/menu/icon-scan.png" mode="aspectFit" />
        <text class="menu-label">扫码取货</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- ========== 其他 ========== -->
    <view class="section menu-list">
      <view class="menu-item" @click="onContactService">
        <image class="menu-icon" src="/static/icons/menu/icon-service.png" mode="aspectFit" />
        <text class="menu-label">联系客服</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="onAbout">
        <image class="menu-icon" src="/static/icons/menu/icon-about.png" mode="aspectFit" />
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

    <!-- ========== 登录弹窗（共享组件） ========== -->
    <login-modal
      :visible="showLoginModal"
      @close="onCloseLoginModal"
      @login-success="onLoginSuccess"
    />

    <!-- ========== 资料编辑弹窗 ========== -->
    <view v-if="showProfileModal" class="modal-mask" @click="showProfileModal = false">
      <view class="modal-card" @click.stop>
        <text class="modal-title">编辑资料</text>

        <!-- 头像修改 -->
        <view class="edit-section">
          <text class="edit-label">头像</text>
          <view class="avatar-options">
            <!-- #ifdef MP-WEIXIN -->
            <button class="avatar-option-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
              <image class="option-icon" src="/static/icons/brand/profile-wechat.png" mode="aspectFit" />
              <text class="option-text">微信头像</text>
            </button>
            <!-- #endif -->
            <view class="avatar-option-btn" @click="onPickAvatarFromAlbum">
              <image class="option-icon" src="/static/icons/brand/profile-album.png" mode="aspectFit" />
              <text class="option-text">相册上传</text>
            </view>
            <view class="avatar-option-btn" @click="onPickAvatarFromCamera">
              <image class="option-icon" src="/static/icons/brand/profile-camera.png" mode="aspectFit" />
              <text class="option-text">拍照</text>
            </view>
          </view>
        </view>

        <!-- 昵称修改 -->
        <view class="edit-section">
          <text class="edit-label">昵称</text>
          <!-- #ifdef MP-WEIXIN -->
          <input
            class="nickname-edit-input"
            type="nickname"
            :value="profileFormNickName"
            placeholder="请输入昵称（可使用微信昵称）"
            @blur="onProfileNicknameBlur"
          />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <input
            class="nickname-edit-input"
            :value="profileFormNickName"
            placeholder="请输入昵称"
            @blur="onProfileNicknameBlur"
          />
          <!-- #endif -->
        </view>

        <!-- 保存 -->
        <view class="profile-save-btn" @click="onSaveProfile">
          <text>保存</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post, put } from '@/utils/request'
import { isLoggedIn } from '@/utils/request'
import { clearAuth, STORAGE_KEYS, saveLoginInfo } from '@/utils/auth'
import { clearTokens } from '@/utils/request'
import LoginModal from '@/components/login-modal.vue'

// ========== State ==========
const avatarUrl = ref('')
const nickName = ref('')
const phone = ref('')
const maskedPhone = ref('')
const hasLogin = ref(false)
const showLoginModal = ref(false)
const showProfileModal = ref(false)
const profileFormNickName = ref('')
const pendingAction = ref('') // 登录后自动执行：'address' | 'orders'
const ongoingCount = ref(0)
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
  const token = uni.getStorageSync('access_token') || ''
  const openid = uni.getStorageSync(STORAGE_KEYS.openid) || ''
  avatarUrl.value = userInfo.avatarUrl || ''
  nickName.value = userInfo.nickName || ''
  phone.value = p
  maskedPhone.value = maskPhone(p)
  // 登录状态：有 token 或 openid 即视为已登录（不再依赖手机号）
  hasLogin.value = !!(token || openid)
}

function maskPhone(p) {
  if (!p || p.length < 8) return p || ''
  return p.slice(0, 3) + '****' + p.slice(7)
}

// ========== 进行中订单数 ==========
async function fetchOngoingCount() {
  if (!isLoggedIn()) {
    ongoingCount.value = 0
    return
  }
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
function showLoginModalFn() {
  showLoginModal.value = true
}

function onCloseLoginModal() {
  showLoginModal.value = false
}

function onLoginSuccess(result) {
  // login-modal 已通过 saveLoginInfo() 写好了 storage，这里只同步本地 state
  phone.value = result.phone || ''
  maskedPhone.value = maskPhone(result.phone || '')
  if (result.nickName) nickName.value = result.nickName
  if (result.avatarUrl) avatarUrl.value = result.avatarUrl

  hasLogin.value = true
  showLoginModal.value = false

  // 执行挂起的操作
  const action = pendingAction.value
  pendingAction.value = ''
  if (action === 'address') {
    uni.showToast({ title: '登录成功', icon: 'success', duration: 800 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/mine/address/address' }) }, 900)
  } else if (action === 'orders') {
    uni.showToast({ title: '登录成功', icon: 'success', duration: 800 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/orders/orders' }) }, 900)
  } else {
    uni.showToast({ title: '登录成功', icon: 'success' })
  }
}

// ========== 头像点击 → 登录弹窗 or 资料编辑 ==========
function onAvatarClick() {
  if (!hasLogin.value) {
    showLoginModalFn()
  } else {
    onEditProfile()
  }
}

// ========== 资料编辑弹窗 ==========
function onEditProfile() {
  profileFormNickName.value = nickName.value || ''
  showProfileModal.value = true
}

function onChooseAvatar(e) {
  const url = e.detail.avatarUrl
  if (!url) return
  avatarUrl.value = url
  const userInfo = uni.getStorageSync('userInfo') || {}
  userInfo.avatarUrl = url
  uni.setStorageSync('userInfo', userInfo)

  // 上传至后端 + 同步到用户资料
  // #ifdef MP-WEIXIN
  uni.uploadFile({
    url: (import.meta.env.VITE_API_BASE_URL || 'http://159.75.0.194') + '/api/upload/image',
    filePath: url,
    name: 'file',
    success: (res) => {
      try {
        const data = JSON.parse(res.data)
        if (data.success && data.data && data.data.url) {
          const updated = { nickName: nickName.value, avatarUrl: data.data.url }
          uni.setStorageSync('userInfo', updated)
          avatarUrl.value = data.data.url
          // 持久化到后端
          put('/auth/profile', { avatarUrl: data.data.url }).catch(err => {
            console.error('[mine] 同步头像失败:', err)
          })
        }
      } catch (_) {}
    }
  })
  // #endif
}

function onPickAvatarFromAlbum() {
  uni.chooseImage({
    count: 1,
    sourceType: ['album'],
    success: (res) => {
      const url = res.tempFilePaths[0]
      if (url) {
        avatarUrl.value = url
        uploadProfileAvatar(url)
      }
    }
  })
}

function onPickAvatarFromCamera() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: (res) => {
      const url = res.tempFilePaths[0]
      if (url) {
        avatarUrl.value = url
        uploadProfileAvatar(url)
      }
    }
  })
}

function uploadProfileAvatar(filePath) {
  uni.uploadFile({
    url: (import.meta.env.VITE_API_BASE_URL || 'http://159.75.0.194') + '/api/upload/image',
    filePath,
    name: 'file',
    success: (res) => {
      try {
        const data = JSON.parse(res.data)
        if (data.success && data.data && data.data.url) {
          const updated = { nickName: nickName.value, avatarUrl: data.data.url }
          uni.setStorageSync('userInfo', updated)
          avatarUrl.value = data.data.url
          // 持久化到后端
          put('/auth/profile', { avatarUrl: data.data.url }).catch(err => {
            console.error('[mine] 同步头像失败:', err)
          })
        }
      } catch (_) {}
    }
  })
}

function onProfileNicknameBlur(e) {
  const name = e.detail.value
  if (name) {
    profileFormNickName.value = name
  }
}

async function onSaveProfile() {
  const name = profileFormNickName.value.trim()
  if (name) {
    nickName.value = name
    const userInfo = uni.getStorageSync('userInfo') || {}
    userInfo.nickName = name
    uni.setStorageSync('userInfo', userInfo)

    // 持久化到后端
    try {
      await put('/auth/profile', { nickName: name })
    } catch (err) {
      console.error('[mine] 更新昵称失败:', err)
      uni.showToast({ title: '同步失败，请重试', icon: 'none' })
      return
    }
  }
  showProfileModal.value = false
  uni.showToast({ title: '资料已更新', icon: 'success' })
}

function onNicknameBlur(e) {
  const name = e.detail.value
  if (!name) return
  const userInfo = uni.getStorageSync('userInfo') || {}
  userInfo.nickName = name
  uni.setStorageSync('userInfo', userInfo)
  nickName.value = name

  // 持久化到后端
  put('/auth/profile', { nickName: name }).catch(err => {
    console.error('[mine] 同步昵称失败:', err)
  })
}

// ========== 功能入口 ==========
function onOrderTap(tab) {
  if (!isLoggedIn()) {
    pendingAction.value = 'orders'
    showLoginModalFn()
    return
  }
  uni.navigateTo({ url: '/pages/orders/orders?tab=' + tab })
}

function onAddressManage() {
  if (!isLoggedIn()) {
    pendingAction.value = 'address'
    showLoginModalFn()
    return
  }
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
      avatarUrl.value = ''
      nickName.value = ''
      phone.value = ''
      maskedPhone.value = ''
      hasLogin.value = false
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
.avatar-placeholder { width:120rpx; height:120rpx; border-radius:var(--radius-full); background:var(--color-bg-page); display:flex; align-items:center; justify-content:center; }
.avatar-default-icon { width:64rpx; height:64rpx; }
.avatar-placeholder-brand { width:120rpx; height:120rpx; border-radius:var(--radius-full); background:var(--color-primary-pale); display:flex; align-items:center; justify-content:center; font-size:56rpx; }
.avatar-edit-btn-transparent { position:absolute; top:0; left:0; width:120rpx; height:120rpx; border-radius:var(--radius-full); padding:0; margin:0; background:transparent; opacity:0; }
.avatar-edit-btn-transparent::after { border:none; }

.user-info { flex:1; overflow:hidden; }
.user-nickname { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); display:block; }
.user-phone { font-size:var(--font-md); color:var(--color-text-3); margin-top:8rpx; display:block; }
.nickname-input { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); background:transparent; border:none; padding:0; height:auto; }
.edit-tag { padding:6rpx 16rpx; background:var(--color-primary-pale); border-radius:var(--radius-md); font-size:var(--font-sm); color:var(--color-primary); }

/* 订单快捷入口 */
.order-shortcuts { display:flex; padding:20rpx 0 !important; }
.shortcut-item { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
.shortcut-icon { width:44rpx; height:44rpx; margin-bottom:8rpx; }
.shortcut-label { font-size:var(--font-sm); color:var(--color-text-2); }
.shortcut-badge { position:absolute; top:0; right:50%; transform:translateX(150%); min-width:32rpx; height:32rpx; background:var(--color-primary); color:#fff; font-size:var(--font-xs); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; padding:0 6rpx; }

/* 菜单列表 */
.section { background:var(--color-bg-card); padding:0; margin:0 24rpx 16rpx; border-radius:var(--radius-lg); overflow:hidden; }
.menu-list { }
.menu-item { display:flex; align-items:center; padding:24rpx; border-bottom:1rpx solid var(--color-border); }
.menu-item:last-child { border-bottom:none; }
.menu-item:active { background:var(--color-bg-page); }
.menu-item-danger:active { background:var(--color-danger-bg); }
.menu-icon { width:40rpx; height:40rpx; margin-right:16rpx; flex-shrink:0; }
.menu-label { flex:1; font-size:var(--font-base); color:var(--color-text-1); }
.menu-hint { font-size:var(--font-sm); color:var(--color-text-3); margin-right:8rpx; }
.menu-arrow { font-size:var(--font-xl); color:var(--color-text-4); }

/* 退出登录 */
.logout-btn { margin:40rpx 24rpx; padding:20rpx 0; text-align:center; background:var(--color-bg-card); border-radius:var(--radius-xl); font-size:var(--font-base); color:var(--color-danger); }

/* 资料编辑弹窗 */
.modal-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:200; }
.modal-card { background:#fff; border-radius:var(--radius-xl); padding:40rpx 32rpx; margin:0 48rpx; width:100%; max-width:560rpx; display:flex; flex-direction:column; }
.modal-title { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); margin-bottom:24rpx; text-align:center; }

.edit-section { margin-bottom:24rpx; }
.edit-label { font-size:var(--font-base); font-weight:var(--weight-medium); color:var(--color-text-1); display:block; margin-bottom:16rpx; }

.avatar-options { display:flex; gap:16rpx; }
.avatar-option-btn { flex:1; display:flex; flex-direction:column; align-items:center; padding:20rpx 0; background:var(--color-bg-page); border-radius:var(--radius-md); border:none; }
.avatar-option-btn::after { border:none; }
.option-icon { width:40rpx; height:40rpx; margin-bottom:8rpx; }
.brand-logo-sm { width:64rpx; height:64rpx; }
.option-text { font-size:var(--font-sm); color:var(--color-text-2); }

.nickname-edit-input { width:100%; height:80rpx; background:var(--color-bg-page); border-radius:var(--radius-md); padding:0 20rpx; font-size:var(--font-base); color:var(--color-text-1); box-sizing:border-box; }

.profile-save-btn { width:100%; height:88rpx; background:var(--color-primary); color:#fff; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); display:flex; align-items:center; justify-content:center; margin-top:16rpx; }
.profile-save-btn:active { background:var(--color-primary-dark); }
</style>
