<template>
  <view class="page">
    <view v-if="!order && !orderNo" class="empty-state"><text>订单不存在</text></view>

    <template v-if="order">
      <!-- ========== 状态横幅 ========== -->
      <view class="status-banner">
        <image class="status-icon" :src="statusIcon" mode="aspectFit" />
        <text class="status-text">{{ statusText }}</text>
        <text v-if="refundStatusText && refundStatusText !== '无需退款'" class="refund-text" :class="refundStatusClass">退款状态：{{ refundStatusText }}</text>
      </view>

      <!-- ========== 取货地址 / 门店信息 ========== -->
      <view class="section">
        <text class="section-title">{{ order.type === 'delivery' ? '收货地址' : '取货门店' }}</text>
        <view v-if="order.type === 'delivery' && order.deliveryAddress" class="address-card" @click="navigateToAddress">
          <image class="address-icon" src="/static/icons/ui/ui-location.png" mode="aspectFit" />
          <view class="address-info">
            <text class="address-contact">{{ order.deliveryAddress.name }} {{ order.deliveryAddress.phone }}</text>
            <text class="address-text">{{ order.deliveryAddress.province }}{{ order.deliveryAddress.city }}{{ order.deliveryAddress.district }} {{ order.deliveryAddress.detail }}</text>
          </view>
          <text class="address-arrow">›</text>
        </view>
        <view v-else class="store-row">
          <image class="store-icon" src="/static/icons/ui/ui-store.png" mode="aspectFit" />
          <text>小鲜鸡线下体验店</text>
        </view>
      </view>

      <!-- ========== 商品清单 ========== -->
      <view class="section">
        <text class="section-title">商品清单</text>
        <view v-for="item in (order.items || [])" :key="item._id || item.productId" class="item-row">
          <text class="item-emoji">🐔</text>
          <view class="item-info">
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-spec">{{ formatItemSpec(item) }}</text>
          </view>
          <text class="item-price">¥{{ item.unitPriceDisplay || formatMoney(item.unitPrice || 0) }} × {{ item.quantity }}</text>
        </view>
      </view>

      <!-- ========== 称重信息 ========== -->
      <view v-if="weighInfo" class="section">
        <text class="section-title">称重信息</text>
        <view class="info-grid">
          <view class="info-row">
            <text class="info-label">实际重量</text>
            <text class="info-value">{{ weighInfo.actualWeightDisplay }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">实际金额</text>
            <text class="info-value price">{{ weighInfo.actualAmountDisplay }}</text>
          </view>
          <view v-if="weighInfo.refundAmount > 0" class="info-row">
            <text class="info-label">退款金额</text>
            <text class="info-value price-green">{{ weighInfo.refundAmountDisplay }}</text>
          </view>
        </view>
        <image v-if="weighInfo.weighPhoto" class="weigh-photo" :src="weighInfo.weighPhoto" mode="widthFix" @click="onPreviewWeighPhoto" />
      </view>

      <!-- ========== 订单信息 ========== -->
      <view class="section">
        <text class="section-title">订单信息</text>
        <view class="info-grid">
          <view class="info-row">
            <text class="info-label">订单编号</text>
            <text class="info-value mono">{{ order.orderNo }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">订单类型</text>
            <text class="info-value">{{ getOrderTypeLabel(order.type) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ order.createTime || '' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">预估价</text>
            <text class="info-value">{{ prepayDisplay }}</text>
          </view>
          <view v-if="order.actualAmount > 0" class="info-row">
            <text class="info-label">实付金额</text>
            <text class="info-value price">{{ actualDisplay }}</text>
          </view>
          <view v-if="order.refundAmount > 0" class="info-row">
            <text class="info-label">退款金额</text>
            <text class="info-value price-green">{{ refundDisplay }}</text>
          </view>
          <view v-if="order.scheduledDate" class="info-row">
            <text class="info-label">预约时间</text>
            <text class="info-value">{{ order.scheduledDate }} {{ order.scheduledTime }}</text>
          </view>
          <view v-if="order.remark" class="info-row">
            <text class="info-label">备注</text>
            <text class="info-value">{{ order.remark }}</text>
          </view>
        </view>
      </view>

      <!-- ========== 操作按钮 ========== -->
      <view class="actions">
        <view v-if="showCancelBtn" class="action-btn action-btn-outline" @click="onCancelOrder">
          <text>取消订单</text>
        </view>
        <view v-if="order.status === 'pending'" class="action-btn action-btn-primary" @click="onRetryPayment">
          <text>去支付</text>
        </view>
        <view v-if="order.deliveryAddress" class="action-btn action-btn-outline" @click="navigateToAddress">
          <text>导航</text>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <view v-if="showConfirmBtn" class="action-btn action-btn-primary" @click="onConfirmReceive">
          <text>确认收货</text>
        </view>
        <!-- #endif -->
        <view class="action-btn action-btn-outline" @click="callPhone">
          <text>联系商家</text>
        </view>
      </view>
    </template>

    <!-- 加载中 -->
    <view v-if="!order && orderNo" class="loading-state">
      <view class="loading-spinner"></view>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { get, post } from '@/utils/request'
import { formatMoney, getStatusText, getRefundStatusText, getRefundStatusClass, getOrderTypeLabel } from '@/utils/util'
import { callPay } from '@/utils/pay'

// ========== State ==========
const order = ref(null)
const orderNo = ref('')
const prepayDisplay = ref('0.00')
const actualDisplay = ref('0.00')
const refundDisplay = ref('0.00')
const statusText = ref('')
const refundStatusText = ref('')
const refundStatusClass = ref('')
const weighInfo = ref(null)
const showCancelBtn = ref(false)
const showConfirmBtn = ref(false)
const pollingTimer = ref(null)
let pollFailCount = 0

const statusIconMap = {
  pending: '/static/icons/status/status-pending.png',
  paid: '/static/icons/status/status-paid.png',
  accepted: '/static/icons/status/status-accepted.png',
  weighed: '/static/icons/status/status-weighed.png',
  processing: '/static/icons/status/status-processing.png',
  delivering: '/static/icons/status/status-delivering.png',
  ready: '/static/icons/status/status-ready.png',
  completed: '/static/icons/status/status-completed.png',
  cancelled: '/static/icons/status/status-cancelled.png'
}
const statusIcon = ref('/static/icons/status/status-pending.png')

// ========== Lifecycle ==========
onLoad((options) => {
  const no = options.orderNo
  if (!no) {
    uni.showToast({ title: '订单信息有误', icon: 'none', duration: 2000 })
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) uni.navigateBack()
      else uni.switchTab({ url: '/pages/orders/orders' })
    }, 2000)
    return
  }
  orderNo.value = no

  // 微信「购物订单」中心跳入（channel=wx_order_center）
  if (options.channel === 'wx_order_center') {
    console.log('[order-detail] 来自微信购物订单中心')
  }

  // 外部跳入时检查登录态
  const accessToken = uni.getStorageSync('access_token')
  const openid = uni.getStorageSync('openid')
  if (!accessToken && !openid) {
    // 未登录：先存下目标订单，触发登录后 onShow 再加载
    console.log('[order-detail] 未登录，等待登录后加载订单')
  }
})

onShow(() => {
  // 检查确认收货组件回调结果
  // #ifdef MP-WEIXIN
  const confirmResult = uni.getStorageSync('_confirm_receipt_result')
  if (confirmResult && confirmResult.timestamp > Date.now() - 60000) {
    uni.removeStorageSync('_confirm_receipt_result')
    uni.removeStorageSync('_confirm_pending_order')
    if (confirmResult.status === 'success') {
      uni.showToast({ title: '已确认收货', icon: 'success' })
    } else if (confirmResult.status === 'fail') {
      uni.showToast({ title: confirmResult.errmsg || '确认失败，请重试', icon: 'none', duration: 2500 })
    }
  }
  // #endif

  if (orderNo.value) {
    loadOrder()
    startPolling()
  }
})

onHide(() => stopPolling())
onUnload(() => stopPolling())

// ========== 轮询 ==========
function startPolling() {
  stopPolling()
  pollingTimer.value = setInterval(() => loadOrder(true), 10000)
}

function stopPolling() {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

// ========== 加载订单详情 ==========
async function loadOrder(silent = false) {
  if (!orderNo.value) return
  try {
    const res = await get('/orders/' + orderNo.value)
    // 后端返回 { success: true, data: { order: {...} } }
    const o = (res && res.data && res.data.order) || (res && res.data) || {}
    if (!o || !o.orderNo) return

    pollFailCount = 0

    if (o.items && o.items.length > 0) {
      o.items = o.items.map(item => ({
        ...item,
        unitPriceDisplay: item.unitPrice ? formatMoney(item.unitPrice) : '--'
      }))
    }

    o.actualWeightDisplay = o.actualWeight ? (o.actualWeight / 500).toFixed(2) : ''

    let wi = null
    if (o.weighInfo) {
      wi = {
        ...o.weighInfo,
        actualWeightDisplay: o.weighInfo.actualWeight + '克（' + o.weighInfo.actualWeightJin + '斤）',
        actualAmountDisplay: formatMoney(o.weighInfo.actualAmount || 0),
        refundAmountDisplay: formatMoney(o.weighInfo.refundAmount || 0)
      }
    } else if (o.actualWeight) {
      wi = {
        actualWeight: o.actualWeight || 0,
        actualWeightJin: ((o.actualWeight || 0) / 500).toFixed(2),
        actualWeightDisplay: (o.actualWeight || 0) + '克（' + ((o.actualWeight || 0) / 500).toFixed(2) + '斤）',
        actualAmount: o.actualAmount || 0,
        actualAmountDisplay: formatMoney(o.actualAmount || 0),
        refundAmount: o.refundAmount || 0,
        refundAmountDisplay: formatMoney(o.refundAmount || 0),
        weighPhoto: o.weighPhoto || ''
      }
    }

    let refundInfo = null
    if (o.refundInfo) {
      refundInfo = {
        ...o.refundInfo,
        refundAmountDisplay: formatMoney(o.refundInfo.refundAmount || 0),
        statusText: getRefundStatusText(o.refundInfo.status || 'none'),
        statusClass: getRefundStatusClass(o.refundInfo.status || 'none')
      }
    }

    const canCancelOrder = checkCanCancel(o)

    order.value = o
    prepayDisplay.value = formatMoney(o.payAmount || 0)
    actualDisplay.value = formatMoney(o.actualAmount || 0)
    refundDisplay.value = formatMoney(o.refundAmount || 0)
    statusText.value = getStatusText(o.status, o.type)
    refundStatusText.value = getRefundStatusText((refundInfo && refundInfo.status) || o.refundStatus || 'none')
    refundStatusClass.value = getRefundStatusClass((refundInfo && refundInfo.status) || o.refundStatus || 'none')
    weighInfo.value = wi
    showCancelBtn.value = canCancelOrder
    // 确认收货按钮：仅配送订单在 delivering/completed 状态时显示
    showConfirmBtn.value = (o.status === 'delivering' || o.status === 'completed') && o.type === 'delivery'
    statusIcon.value = statusIconMap[o.status] || '/static/icons/status/status-pending.png'

    if (o.status === 'completed' || o.status === 'cancelled') stopPolling()
  } catch (err) {
    if (!silent) console.error('加载订单详情失败:', err)
    pollFailCount++
    if (pollFailCount >= 3) {
      stopPolling()
      uni.showToast({ title: '网络不稳定，请手动刷新', icon: 'none', duration: 2000 })
    }
  }
}

function checkCanCancel(o) {
  if (o.status === 'cancelled' || o.status === 'completed') return false
  const items = o.items || []
  if (items.length === 0) return false
  const hasOnlyExactWeight = items.every(i => i.pricingType === 'exact_weight')
  if (hasOnlyExactWeight) return ['pending', 'paid', 'accepted', 'weighed'].includes(o.status)
  return ['pending', 'paid'].includes(o.status)
}

// ========== 操作 ==========
function onCancelOrder() {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？退款将原路退回，1-7个工作日到账。',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '取消中...' })
      try {
        const result = await post('/orders/' + orderNo.value + '/cancel')
        uni.hideLoading()
        if (result && result.success) {
          uni.showToast({ title: '已取消', icon: 'success' })
          loadOrder()
        } else {
          uni.showToast({ title: (result && result.message) || '取消失败', icon: 'none' })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('取消失败:', err)
        uni.showToast({ title: err.message || '取消失败', icon: 'none' })
      }
    }
  })
}

function navigateToAddress() {
  if (!order.value || !order.value.deliveryAddress) return
  const addr = order.value.deliveryAddress
  const addrStr = (addr.province || '') + (addr.city || '') + (addr.district || '') + ' ' + (addr.detail || '')

  if (!addrStr.trim()) {
    uni.showToast({ title: '暂无收货地址', icon: 'none' })
    return
  }

  // 尝试使用坐标打开，否则只用地址文本
  if (addr.latitude && addr.longitude) {
    uni.openLocation({
      latitude: addr.latitude,
      longitude: addr.longitude,
      name: '收货地址',
      address: addrStr.trim(),
      scale: 16
    })
  } else {
    uni.openLocation({
      latitude: 23.1291,
      longitude: 113.2644,
      name: '收货地址',
      address: addrStr.trim(),
      scale: 16
    })
  }
}

function callPhone() {
  if (!order.value) return
  const phone = order.value.contactPhone || (order.value.deliveryAddress && order.value.deliveryAddress.phone) || ''
  if (!phone) {
    uni.showToast({ title: '暂无联系电话', icon: 'none' })
    return
  }
  uni.showModal({
    title: '拨打电话',
    content: '是否拨打 ' + phone + '？',
    confirmText: '拨打',
    confirmColor: '#D4420A',
    success: (res) => {
      if (res.confirm) {
        uni.makePhoneCall({ phoneNumber: phone })
      }
    }
  })
}

function onConfirmReceive() {
  if (!order.value || !order.value.orderNo) return

  const o = order.value
  // 获取微信支付流水号（order_info.transactionId 或 paymentRecord.transactionId）
  const transactionId = o.transactionId || (o.paymentRecord && o.paymentRecord.transactionId) || ''

  uni.showModal({
    title: '确认收货',
    content: '确认已收到商品吗？确认后资金将结算给商家。',
    confirmText: '确认收货',
    confirmColor: '#D4420A',
    success: (res) => {
      if (!res.confirm) return

      // 调用微信确认收货组件（仅微信小程序环境）
      // #ifdef MP-WEIXIN
      if (typeof wx !== 'undefined' && wx.openBusinessView) {
        // 记录待确认订单，供 App.onShow 回调使用
        uni.setStorageSync('_confirm_pending_order', { orderNo: o.orderNo, timestamp: Date.now() })

        wx.openBusinessView({
          businessType: 'weappOrderConfirm',
          extraData: {
            merchant_trade_no: o.orderNo,
            transaction_id: transactionId,
          },
          success: () => {
            // 组件打开成功 —— 用户在组件内操作，结果通过 App.onShow 回调
            console.log('[confirm-receipt] 确认收货组件已打开')
          },
          fail: (err) => {
            uni.removeStorageSync('_confirm_pending_order')
            console.error('[confirm-receipt] openBusinessView 失败:', err)
            // 引导用户升级微信版本
            if (err.errCode === -2 || err.errMsg && err.errMsg.includes('version')) {
              uni.showToast({ title: '请升级微信版本后重试', icon: 'none', duration: 2500 })
            } else {
              uni.showToast({ title: '暂不支持，请稍后重试', icon: 'none' })
            }
          }
        })
        return
      }
      // #endif

      // 非微信环境或无 openBusinessView：轻提示
      uni.showToast({ title: '请在微信中确认收货', icon: 'none' })
    }
  })
}

function onRetryPayment() {
  uni.showLoading({ title: '获取支付参数...' })
  post('/orders/' + orderNo.value + '/pay').then(res => {
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

    callPay({
      orderNo: orderNo.value,
      payment,
      amountDisplay: prepayDisplay.value,
      onSuccess: () => loadOrder(),
      onCancel: () => loadOrder()
    })
  }).catch(err => {
    uni.hideLoading()
    console.error('获取支付参数失败:', err)
    uni.showToast({ title: '网络异常，请重试', icon: 'none' })
  })
}

function onPreviewWeighPhoto() {
  const photo = (weighInfo.value && weighInfo.value.weighPhoto) || (order.value && order.value.weighPhoto)
  if (photo) uni.previewImage({ urls: [photo], current: photo })
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
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--color-bg-page); padding-bottom:40rpx; }

/* 状态横幅 */
.status-banner { display:flex; flex-direction:column; align-items:center; padding:48rpx 24rpx 32rpx; background:var(--color-bg-card); margin-bottom:16rpx; }
.status-icon { width:96rpx; height:96rpx; margin-bottom:16rpx; }
.status-text { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); }
.refund-text { font-size:var(--font-md); margin-top:12rpx; padding:6rpx 20rpx; border-radius:var(--radius-md); }
.tag-green { background:var(--color-success-bg); color:var(--color-success); }
.tag-orange { background:var(--color-warning-bg); color:var(--color-warning); }
.tag-red { background:var(--color-danger-bg); color:var(--color-danger); }

/* 区块 */
.section { background:var(--color-bg-card); padding:24rpx; margin:0 24rpx 16rpx; border-radius:var(--radius-lg); }
.section-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); margin-bottom:16rpx; display:block; padding-bottom:12rpx; border-bottom:1rpx solid var(--color-border); }

/* 地址 */
.address-card { display:flex; align-items:center; gap:12rpx; }
.address-icon { width:36rpx; height:36rpx; flex-shrink:0; }
.address-info { flex:1; overflow:hidden; }
.address-contact { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); display:block; margin-bottom:6rpx; }
.address-text { font-size:var(--font-md); color:var(--color-text-3); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.address-arrow { font-size:var(--font-xl); color:var(--color-text-4); }

/* 商品 */
.item-row { display:flex; align-items:center; padding:12rpx 0; gap:12rpx; }
.item-emoji { font-size:28rpx; }
.item-info { flex:1; overflow:hidden; }
.item-name { font-size:var(--font-base); color:var(--color-text-1); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.item-spec { font-size:var(--font-sm); color:var(--color-text-3); margin-top:4rpx; }
.item-price { font-size:var(--font-md); color:var(--color-text-2); flex-shrink:0; }

/* 信息网格 */
.info-grid { }
.info-row { display:flex; justify-content:space-between; padding:10rpx 0; }
.info-label { font-size:var(--font-md); color:var(--color-text-3); flex-shrink:0; }
.info-value { font-size:var(--font-md); color:var(--color-text-1); font-weight:500; text-align:right; }
.info-value.price { color:var(--color-primary); font-weight:var(--weight-bold); }
.info-value.price-green { color:var(--color-success); font-weight:var(--weight-bold); }
.info-value.mono { font-family:monospace; font-size:var(--font-sm); }

.weigh-photo { width:100%; border-radius:var(--radius-md); margin-top:16rpx; }

/* 操作按钮 */
.actions { display:flex; flex-wrap:wrap; gap:16rpx; padding:0 24rpx 40rpx; }
.action-btn { padding:20rpx 0; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); text-align:center; flex:1; min-width:160rpx; }
.action-btn-primary { background:var(--color-primary); color:#fff; }
.action-btn-outline { border:2rpx solid var(--color-border-dark); color:var(--color-text-2); background:var(--color-bg-card); }

.store-row { display:flex; align-items:center; gap:8rpx; font-size:var(--font-base); color:var(--color-text-1); }
.store-icon { width:36rpx; height:36rpx; flex-shrink:0; }

/* 加载 */
.loading-state { display:flex; flex-direction:column; align-items:center; padding:120rpx; gap:24rpx; color:var(--color-text-3); font-size:var(--font-base); }
.loading-spinner { width:60rpx; height:60rpx; border:4rpx solid var(--color-border); border-top-color:var(--color-primary); border-radius:var(--radius-full); animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.empty-state { display:flex; justify-content:center; padding:120rpx; color:var(--color-text-3); }
</style>
