<template>
  <view class="page">
    <!-- ========== Tab 栏 ========== -->
    <view class="tab-bar">
      <view
        v-for="(tab, idx) in tabs" :key="idx"
        class="tab-item" :class="{ 'tab-active': tabIndex === idx }"
        @click="onTabTap(idx)"
      ><text>{{ tab }}</text></view>
    </view>

    <!-- ========== 订单列表 ========== -->
    <scroll-view class="order-list" scroll-y @scrolltolower="onReachBottom">
      <view v-if="orders.length === 0 && !loading" class="empty-state">
        <image class="empty-icon" src="/static/icons/ui/ui-empty.png" mode="aspectFit" />
        <text class="empty-title">暂无订单</text>
      </view>

      <view v-for="order in orders" :key="order.orderNo" class="order-card" @click="onOrderTap(order.orderNo)">
        <!-- 订单头部 -->
        <view class="order-header">
          <text class="order-no">#{{ order.orderNo }}</text>
          <text class="order-status" :class="order.statusClass">{{ order.statusText }}</text>
        </view>

        <!-- 订单商品 -->
        <view v-for="item in (order.items || [])" :key="item._id || item.productId" class="order-item">
          <text class="order-item-emoji">🐔</text>
          <view class="order-item-info">
            <text class="order-item-name">{{ item.productName }}</text>
            <text class="order-item-spec">{{ formatItemSpec(item) }}</text>
          </view>
          <view class="order-item-right">
            <text class="order-item-price">¥{{ formatMoney(item.unitPrice || item.price || 0) }}</text>
            <text class="order-item-qty">×{{ item.quantity }}</text>
          </view>
        </view>

        <!-- 订单底部 -->
        <view class="order-footer">
          <text class="order-amount">共 {{ (order.items || []).reduce((s, i) => s + i.quantity, 0) }} 件 · 合计 ¥{{ order.prepayDisplay }}</text>
          <view class="order-actions">
            <view v-if="order.status === 'pending'" class="order-btn order-btn-pay" @click.stop="onPayOrder(order.orderNo)">
              <text>去支付</text>
            </view>
            <view v-if="canCancel(order)" class="order-btn order-btn-cancel" @click.stop="onCancelOrderItem(order.orderNo)">
              <text>取消</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loading" class="load-more"><text>加载中...</text></view>
      <view v-if="!hasMore && orders.length > 0" class="load-more"><text>— 没有更多了 —</text></view>
    </scroll-view>

    <!-- ========== 手机号授权弹窗 ========== -->
    <view v-if="showPhoneAuth" class="modal-mask" @click="onCancelPhoneAuth">
      <view class="modal-card" @click.stop>
        <text class="modal-title">绑定手机号</text>
        <text class="modal-body">支付前需要绑定手机号</text>
        <!-- #ifdef MP-WEIXIN -->
        <button class="phone-auth-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhoneForOrder">微信手机号一键授权</button>
        <!-- #endif -->
        <view class="modal-cancel" @click="onCancelPhoneAuth"><text>暂不绑定</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { get, post, isLoggedIn } from '@/utils/request'
import { formatMoney, getStatusText } from '@/utils/util'
import { callPay } from '@/utils/pay'

// ========== State ==========
const tabs = ['全部', '进行中', '已完成']
const tabIndex = ref(0)
const orders = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const showPhoneAuth = ref(false)
const pendingPayOrderNo = ref('')

// ========== Lifecycle ==========
onLoad((options) => {
  if (options && options.tab) {
    const tabMap = { pending: 0, active: 1, completed: 2, all: 0 }
    const idx = tabMap[options.tab]
    if (idx !== undefined) tabIndex.value = idx
  }
})

onShow(() => { loadOrders(true) })
onPullDownRefresh(() => { loadOrders(true).then(() => uni.stopPullDownRefresh()) })
onReachBottom(() => { loadOrders() })

// ========== Tab ==========
function onTabTap(idx) {
  if (idx === tabIndex.value) return
  tabIndex.value = idx
  loadOrders(true)
}

// ========== 加载订单 ==========
async function loadOrders(reset = false) {
  if (loading.value) return
	  if (!isLoggedIn()) {
	    orders.value = []
	    loading.value = false
	    hasMore.value = false
	    return
	  }
  const p = reset ? 1 : page.value
  loading.value = true

  try {
    let params = { page: p, pageSize: 10 }
    if (tabIndex.value === 1) {
      params.status = 'pending,paid,accepted,weighed,processing,delivering,ready'
    } else if (tabIndex.value === 2) {
      params.status = 'completed,cancelled'
    }

    const res = await get('/orders', params)
    const list = (res && res.data && res.data.orders) || []

    const formatted = list.map(order => ({
      ...order,
      prepayDisplay: formatMoney(order.payAmount || 0),
      actualDisplay: formatMoney(order.actualAmount || 0),
      refundDisplay: formatMoney(order.refundAmount || 0),
      statusText: getStatusText(order.status, order.type),
      statusClass: getStatusClass(order.status)
    }))

    orders.value = reset ? formatted : [...orders.value, ...formatted]
    page.value = p + 1
    hasMore.value = list.length >= 10
    loading.value = false
  } catch (err) {
    console.error('加载订单失败:', err)
    loading.value = false
  }
}

function getStatusClass(status) {
  const map = {
    pending: 'tag-orange', paid: 'tag-green', accepted: 'tag-green',
    weighed: 'tag-green', processing: 'tag-green', delivering: 'tag-green',
    ready: 'tag-green', completed: 'tag-gray', cancelled: 'tag-red'
  }
  return map[status] || 'tag-gray'
}

function canCancel(order) {
  if (order.status === 'cancelled' || order.status === 'completed') return false
  const items = order.items || []
  if (items.length === 0) return false
  const hasOnlyExactWeight = items.every(i => i.pricingType === 'exact_weight')
  if (hasOnlyExactWeight) return ['pending', 'paid', 'accepted', 'weighed'].includes(order.status)
  return ['pending', 'paid'].includes(order.status)
}

// ========== 操作 ==========
function onOrderTap(orderNo) {
  uni.navigateTo({ url: '/pages/orders/detail/detail?orderNo=' + orderNo })
}

function onPayOrder(orderNo) {
  const phone = uni.getStorageSync('phone') || ''
  if (!phone) {
    showPhoneAuth.value = true
    pendingPayOrderNo.value = orderNo
    return
  }
  doPayOrder(orderNo)
}

function doPayOrder(orderNo) {
  uni.showLoading({ title: '获取支付参数...' })
  post('/orders/' + orderNo + '/pay').then(res => {
    uni.hideLoading()
    const d = (res && res.data) || res || {}
    if (!d.success && d.message) {
      uni.showToast({ title: d.message, icon: 'none' })
      return
    }
    const payment = d.payment
    if (!payment) {
      uni.showToast({ title: '支付暂不可用', icon: 'none' })
      return
    }
    const order = orders.value.find(o => o.orderNo === orderNo)
    const amountDisplay = order ? order.prepayDisplay : '0.00'

    callPay({
      orderNo, payment, amountDisplay,
      onSuccess: () => loadOrders(true),
      onCancel: () => loadOrders(true)
    })
  }).catch(err => {
    uni.hideLoading()
    console.error('获取支付参数失败:', err)
    uni.showToast({ title: '网络异常，请重试', icon: 'none' })
  })
}

function onCancelOrderItem(orderNo) {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？退款将原路退回，1-7个工作日到账。',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '取消中...' })
      try {
        const result = await post('/orders/' + orderNo + '/cancel')
        uni.hideLoading()
        if (result && result.success) {
          uni.showToast({ title: '已取消', icon: 'success' })
          loadOrders(true)
        } else {
          uni.showToast({ title: (result && result.message) || '取消失败', icon: 'none' })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('取消失败:', err)
        uni.showToast({ title: '取消失败，请重试', icon: 'none' })
      }
    }
  })
}

// ========== 手机号授权 ==========
function onGetPhoneForOrder(e) {
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    uni.showLoading({ title: '授权中...' })
    post('/auth/wx-phone', { phoneCode: e.detail.code }).then(res => {
      uni.hideLoading()
      const d = (res && res.data) || res
      if (d.phone) {
        uni.setStorageSync('phone', d.phone)
        showPhoneAuth.value = false
        uni.showToast({ title: '已绑定', icon: 'success', duration: 1000 })
        setTimeout(() => doPayOrder(pendingPayOrderNo.value), 1100)
      } else {
        uni.showToast({ title: (res && res.message) || '授权失败', icon: 'none' })
      }
    }).catch(err => {
      uni.hideLoading()
      console.error('手机号授权失败:', err)
      uni.showToast({ title: '授权失败，请重试', icon: 'none' })
    })
  }
}

function onCancelPhoneAuth() {
  showPhoneAuth.value = false
  pendingPayOrderNo.value = ''
}

// ========== 辅助 ==========
function formatItemSpec(item) {
  if (!item.spec) return ''
  const spec = item.spec
  const parts = []
  if (spec.type) parts.push(spec.type)
  if (spec.weight) parts.push(spec.weight)
  if (spec.processing) parts.push(spec.processing)
  return parts.join(' · ')
}
</script>

<style scoped lang="scss">
.page { display:flex; flex-direction:column; height:100vh; background:var(--color-bg-page); }

/* Tab */
.tab-bar { display:flex; background:var(--color-bg-card); padding:0 24rpx; gap:0; flex-shrink:0; }
.tab-item { flex:1; text-align:center; padding:24rpx 0; font-size:var(--font-base); color:var(--color-text-2); position:relative; }
.tab-active { color:var(--color-primary); font-weight:var(--weight-bold); }
.tab-active::after { content:''; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:48rpx; height:6rpx; background:var(--color-primary); border-radius:3rpx; }

/* 列表 */
.order-list { flex:1; padding:16rpx 24rpx; }
.order-card { background:var(--color-bg-card); border-radius:var(--radius-lg); margin-bottom:16rpx; overflow:hidden; }
.order-header { display:flex; justify-content:space-between; align-items:center; padding:20rpx 24rpx; border-bottom:1rpx solid var(--color-border); }
.order-no { font-size:var(--font-md); color:var(--color-text-3); }
.order-status { font-size:var(--font-sm); padding:4rpx 16rpx; border-radius:var(--radius-md); }

.tag-orange { background:var(--color-warning-bg); color:var(--color-warning); }
.tag-green { background:var(--color-success-bg); color:var(--color-success); }
.tag-red { background:var(--color-danger-bg); color:var(--color-danger); }
.tag-gray { background:var(--color-bg-input); color:var(--color-text-3); }

.order-item { display:flex; align-items:center; padding:16rpx 24rpx; gap:12rpx; }
.order-item-emoji { font-size:28rpx; flex-shrink:0; }
.order-item-info { flex:1; overflow:hidden; }
.order-item-name { font-size:var(--font-base); color:var(--color-text-1); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.order-item-spec { font-size:var(--font-sm); color:var(--color-text-3); margin-top:4rpx; }
.order-item-right { display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; }
.order-item-price { font-size:var(--font-base); color:var(--color-text-1); font-weight:var(--weight-bold); }
.order-item-qty { font-size:var(--font-sm); color:var(--color-text-3); }

.order-footer { display:flex; justify-content:space-between; align-items:center; padding:16rpx 24rpx; border-top:1rpx solid var(--color-border); }
.order-amount { font-size:var(--font-md); color:var(--color-text-2); }
.order-actions { display:flex; gap:12rpx; }
.order-btn { padding:10rpx 24rpx; border-radius:var(--radius-xl); font-size:var(--font-sm); font-weight:var(--weight-bold); }
.order-btn-pay { background:var(--color-primary); color:#fff; }
.order-btn-cancel { border:2rpx solid var(--color-border-dark); color:var(--color-text-3); background:var(--color-bg-card); }

/* 弹窗 */
.modal-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; }
.modal-card { background:#fff; border-radius:30rpx; padding:40rpx 32rpx; margin:0 48rpx; width:85%; max-width:560rpx; display:flex; flex-direction:column; align-items:center; box-shadow:0 8rpx 40rpx rgba(0,0,0,0.12); }
.modal-title { font-size:var(--font-lg); font-weight:var(--weight-bold); color:var(--color-text-1); margin-bottom:16rpx; }
.modal-body { font-size:var(--font-base); color:var(--color-text-2); text-align:center; margin-bottom:24rpx; }
.phone-auth-btn { width:100%; background:var(--color-primary); color:#fff; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); padding:18rpx 0; text-align:center; border:none; }
.modal-cancel { margin-top:20rpx; font-size:var(--font-md); color:var(--color-text-3); }

/* 空状态 */
.empty-state { display:flex; flex-direction:column; align-items:center; padding:120rpx 48rpx; }
.empty-icon { width:88rpx; height:88rpx; margin-bottom:24rpx; opacity:0.5; }
.empty-title { font-size:var(--font-base); color:var(--color-text-3); }
.load-more { text-align:center; padding:24rpx; color:var(--color-text-3); font-size:var(--font-sm); }
</style>
