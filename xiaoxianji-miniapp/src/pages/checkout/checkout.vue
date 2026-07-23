<template>
  <view class="page">
    <!-- ========== 配送/自取 Tab ========== -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs" :key="tab.value"
        class="tab-item" :class="{ 'tab-active': currentTab === tab.value }"
        @click="onTabTap(tab.value)"
      ><text>{{ tab.label }}</text></view>
    </view>

    <!-- ========== 商品清单 ========== -->
    <view class="section">
      <view v-for="item in items" :key="item.cartKey" class="item-row">
        <text class="item-emoji">{{ item.emoji || '🐔' }}</text>
        <view class="item-info">
          <text class="item-name">{{ item.productName }}</text>
          <text class="item-spec">{{ formatSpec(item.spec) }}</text>
        </view>
        <view class="item-right">
          <text class="item-price">¥{{ item.priceDisplay }}</text>
          <text class="item-qty">×{{ item.quantity }}</text>
        </view>
      </view>
    </view>

    <!-- ========== 收货地址（配送） ========== -->
    <view v-if="currentTab === 'delivery'" class="section" @click="onSelectAddress">
      <view v-if="address" class="address-card">
        <view class="address-top">
          <image class="address-icon" src="/static/icons/ui/ui-location.png" mode="aspectFit" />
          <view class="address-info">
            <view class="address-contact">
              <text class="address-name">{{ address.name }}</text>
              <text class="address-phone">{{ address.phone }}</text>
            </view>
            <text class="address-text">{{ address.province }}{{ address.city }}{{ address.district }} {{ address.detail }}</text>
          </view>
        </view>
      </view>
      <view v-else class="address-empty">
        <image class="address-empty-icon" src="/static/icons/ui/ui-location.png" mode="aspectFit" />
        <text>请添加收货地址</text>
        <text class="address-arrow">›</text>
      </view>
    </view>

    <!-- ========== 门店地址（自取） ========== -->
    <view v-if="currentTab === 'pickup'" class="section" @click="onNavigateToStore">
      <view class="address-card">
        <view class="address-top">
          <image class="address-icon" src="/static/icons/ui/ui-store.png" mode="aspectFit" />
          <view class="address-info">
            <text class="address-name">小鲜鸡线下体验店</text>
            <text class="address-text">{{ storeAddress }}</text>
          </view>
          <text class="address-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- ========== 预约时间 ========== -->
    <view class="section">
      <text class="section-title">送达时间</text>
      <view class="time-capsules">
        <view class="time-capsule" :class="{ 'capsule-active': !isScheduled }" @click="onTimeCapsuleTap('now')">
          <text>尽快送达</text>
        </view>
        <view class="time-capsule" :class="{ 'capsule-active': isScheduled }" @click="onTimeCapsuleTap('scheduled')">
          <text>预约时间</text>
        </view>
      </view>

      <!-- 日期选择 -->
      <view v-if="isScheduled && dateOptions.length > 0" class="spec-options" style="margin-top:16rpx;">
        <view
          v-for="d in dateOptions" :key="d.value"
          class="spec-tag" :class="{ 'spec-tag-active': scheduleDate === d.value }"
          @click="scheduleDate = d.value"
        ><text>{{ d.label }}</text></view>
      </view>

      <!-- 时段选择 -->
      <view v-if="isScheduled && scheduleDate && timeOptions.length > 0" class="spec-options" style="margin-top:12rpx;">
        <view
          v-for="t in timeOptions" :key="t.value"
          class="spec-tag" :class="{ 'spec-tag-active': scheduleTime === t.value }"
          @click="scheduleTime = t.value"
        ><text>{{ t.label }}</text></view>
      </view>
    </view>

    <!-- ========== 费用明细 ========== -->
    <view class="section">
      <view class="fee-row">
        <text class="fee-label">商品小计</text>
        <text class="fee-value">¥{{ totalDisplay }}</text>
      </view>
      <view class="fee-row">
        <text class="fee-label">配送费</text>
        <text class="fee-value fee-free">免配送费</text>
      </view>
      <view v-if="hasRangeWeight" class="fee-hint">
        <text>💡 含称重计价商品，最终金额以实际称重为准，多退少补。</text>
      </view>
    </view>

    <!-- ========== 底部提交 ========== -->
    <view class="bottom-bar">
      <view class="bottom-total">
        <text class="bottom-total-label">合计：</text>
        <text class="bottom-total-value">¥{{ totalDisplay }}</text>
      </view>
      <view class="bottom-submit-btn" :class="{ 'btn-disabled': submitting }" @click="onSubmit">
        <text>{{ submitting ? '提交中...' : '提交订单' }}</text>
      </view>
    </view>

    <!-- ========== 配送范围超限弹窗 ========== -->
    <view v-if="showRangeModal" class="modal-mask" @click="onCloseRangeModal">
      <view class="modal-card" @click.stop>
        <text class="modal-title">超出配送范围</text>
        <text class="modal-body">{{ rangeModalMsg }}</text>
        <text class="modal-detail">当前距离：{{ rangeModalDistance }}km（配送范围 {{ rangeModalRadius }}km）</text>
        <view class="modal-actions">
          <view v-if="showPickupTab" class="modal-btn modal-btn-outline" @click="onSwitchToPickup"><text>切换到店自取</text></view>
          <view class="modal-btn modal-btn-primary" @click="onCloseRangeModal"><text>我知道了</text></view>
        </view>
      </view>
    </view>

    <!-- ========== 手机号授权弹窗 ========== -->
    <view v-if="showPhoneAuth" class="modal-mask" @click="onCancelPhoneAuth">
      <view class="modal-card" @click.stop>
        <text class="modal-title">绑定手机号</text>
        <text class="modal-body">下单需要绑定手机号，我们将通过手机号与您联系。</text>
        <!-- #ifdef MP-WEIXIN -->
        <button class="phone-auth-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhoneForOrder">微信手机号一键授权</button>
        <!-- #endif -->
        <view class="modal-cancel" @click="onCancelPhoneAuth"><text>暂不绑定</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get, post, put, isLoggedIn } from '@/utils/request'
import { formatMoney } from '@/utils/util'
import { callPay } from '@/utils/pay'
import { calcDrivingDistance, geocodeAddress } from '@/utils/map'

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DELIVERY_TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00']
const PICKUP_TIME_SLOTS = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00']

// ========== State ==========
const items = ref([])
const totalDisplay = ref('0.00')
const totalFen = ref(0)
const currentTab = ref('delivery')
const showDeliveryTab = ref(true)
const showPickupTab = ref(false)
const address = ref(null)
const storeAddress = ref('加载中...')
const storeLat = ref(23.1291)
const storeLng = ref(113.2644)
const isScheduled = ref(false)
const scheduleDate = ref('')
const scheduleTime = ref('')
const dateOptions = ref([])
const timeOptions = ref([])
const hasRangeWeight = ref(false)
const showPhoneAuth = ref(false)
const showRangeModal = ref(false)
const rangeModalMsg = ref('')
const rangeModalDistance = ref('')
const rangeModalRadius = ref('')
const submitting = ref(false)  // 防重复提交

const tabs = computed(() => {
  const list = []
  if (showDeliveryTab.value) list.push({ label: '外卖配送', value: 'delivery' })
  if (showPickupTab.value) list.push({ label: '到店自取', value: 'pickup' })
  return list
})

// ========== Lifecycle ==========
onLoad((options) => {
  const from = options.from || 'cart'
  let rawItems = []

  if (from === 'buyNow') {
    rawItems = uni.getStorageSync('buyNow') || []
    uni.removeStorageSync('buyNow')
  } else {
    rawItems = uni.getStorageSync('checkoutItems') || []
    if (rawItems.length === 0) {
      const cart = uni.getStorageSync('cart') || []
      rawItems = cart.filter(i => i.checked !== false)
    }
  }

  if (rawItems.length === 0) {
    uni.showToast({ title: '商品不存在', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1000)
    return
  }

  const modes = new Set()
  rawItems.forEach(i => {
    const d = (i.spec && i.spec.delivery) || 'pickup'
    if (d === 'delivery' || d === 'scheduled') modes.add('delivery')
    if (d === 'pickup') modes.add('pickup')
  })
  showDeliveryTab.value = modes.has('delivery')
  showPickupTab.value = modes.has('pickup')
  currentTab.value = showDeliveryTab.value ? 'delivery' : 'pickup'
  hasRangeWeight.value = rawItems.some(i => i.pricingType === 'range_weight')

  const total = rawItems.reduce((s, i) => s + i.price * i.quantity, 0)
  totalFen.value = total
  totalDisplay.value = formatMoney(total)

  items.value = rawItems.map(i => ({
    ...i,
    priceDisplay: formatMoney(i.price),
    subtotalDisplay: formatMoney(i.price * i.quantity),
    emoji: i.emoji || '🐔'
  }))

  buildDateOptions()
  loadStoreInfo()
  if (currentTab.value === 'delivery') loadDefaultAddress()
})

// 从地址选择页返回时，读取临时选中的地址
onShow(() => {
  // 未登录时跳转登录页
  if (!isLoggedIn()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => uni.switchTab({ url: '/pages/mine/mine' }), 1500)
    return
  }
  const selected = uni.getStorageSync('_tmp_selected_address')
  if (selected) {
    uni.removeStorageSync('_tmp_selected_address')
    address.value = selected
    fetchAddressCoordinates(selected)
  }
})

// ========== 门店信息 ==========
async function loadStoreInfo() {
  try {
    const res = await get('/store')
    const config = (res && res.data && res.data.config) || res
    if (!config) return
    const lat = config.latitude || 23.1291
    const lng = config.longitude || 113.2644
    storeLat.value = lat
    storeLng.value = lng
    storeAddress.value = config.address || config.name || '小鲜鸡线下体验店'
  } catch (_) {
    storeAddress.value = '小鲜鸡线下体验店'
  }
}

// ========== 日期选项 ==========
function buildDateOptions() {
  const today = new Date()
  const options = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const weekday = WEEKDAY_NAMES[d.getDay()]
    let label
    if (i === 0) label = '今天 ' + month + '/' + day
    else if (i === 1) label = '明天 ' + month + '/' + day
    else label = weekday + ' ' + month + '/' + day
    options.push({ label, value: [d.getFullYear(), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-') })
  }
  dateOptions.value = options
}

function buildTimeOptions(tab) {
  const slots = tab === 'pickup' ? PICKUP_TIME_SLOTS : DELIVERY_TIME_SLOTS
  timeOptions.value = slots.map(s => ({ label: s, value: s }))
}

// ========== Tab ==========
function onTabTap(tab) {
  if (tab === currentTab.value) return
  currentTab.value = tab
  isScheduled.value = false
  scheduleDate.value = ''
  scheduleTime.value = ''
  if (tab === 'delivery' && !address.value) loadDefaultAddress()
}

function onTimeCapsuleTap(type) {
  if (type === 'now') {
    isScheduled.value = false
    scheduleDate.value = ''
    scheduleTime.value = ''
  } else {
    buildTimeOptions(currentTab.value)
    isScheduled.value = true
  }
}

// ========== 地址 ==========
function onSelectAddress() {
  // 统一走小程序自己的地址列表，不用微信原生 chooseAddress（会显示微信通讯录地址，干扰用户选择）
  uni.navigateTo({ url: '/pages/mine/address/address?select=true' })
}

async function fetchAddressCoordinates(addr) {
  // 地址已有坐标 → 直接使用；无坐标 → 不做任何处理
  // 坐标获取由 checkDeliveryRange() 统一负责（地址文本解析优先，不依赖手机GPS）
  const hasCoord = addr.latitude != null && addr.longitude != null
  if (hasCoord) {
    address.value = { ...addr }
  } else {
    // 无坐标：保留原始地址数据，坐标留空，checkDeliveryRange 会通过地址文本做地理编码
    address.value = { ...addr }
    console.log('[checkout] 选中地址无GPS坐标，下单时将用地址文本解析坐标')
  }
}

async function loadDefaultAddress() {
  try {
    const res = await get('/addresses')
    const addresses = (res && res.data && res.data.addresses) || []
    const def = addresses.find(a => a.isDefault) || (addresses.length > 0 ? addresses[0] : null)
    if (def) address.value = def
  } catch (err) {
    console.error('加载地址失败:', err)
  }
}

function onNavigateToStore() {
  uni.openLocation({
    latitude: storeLat.value,
    longitude: storeLng.value,
    name: '小鲜鸡',
    address: storeAddress.value,
    scale: 16
  })
}

// ========== 配送范围校验 ==========
async function checkDeliveryRange() {
  if (!address.value) return true
  try {
    const configRes = await get('/store')
    const config = (configRes && configRes.data && configRes.data.config) || configRes || {}
    const deliveryRadius = config.deliveryRadius || 5
    const sLat = config.latitude || 23.1291
    const sLng = config.longitude || 113.2644

    let uLat, uLng
    // 坐标获取优先级：地址文本解析 → 地址簿坐标 → 手机GPS → 不拦截
    // 设计原则：地址文本才是真实的配送目的地。📍定位/手机GPS 记录的是
    // 用户手机当时所在的位置，不是收货地址，不能作为距离校验的第一依据。
    let geocoded = false

    // ① 优先用地址文本做腾讯地图地理编码（省+市+区+详细地址）
    //    把用户填的收货地址文字直接解析为坐标，最可靠。
    const addrText = [address.value.province, address.value.city, address.value.district, address.value.detail]
      .filter(Boolean).join('')
    if (addrText) {
      try {
        const geoResult = await geocodeAddress(addrText)
        if (geoResult.success && geoResult.data) {
          uLat = geoResult.data.latitude
          uLng = geoResult.data.longitude
          geocoded = true
          console.log(`[checkout] 地址文本解析成功: "${addrText}" → (${uLat}, ${uLng})`)
        } else {
          console.warn(`[checkout] 地址文本解析失败: "${addrText}"`, geoResult.error || '')
        }
      } catch (e) {
        console.warn(`[checkout] 地址文本解析异常: "${addrText}"`, e.message || e)
      }
    } else {
      console.warn('[checkout] 地址文本为空，无法做地理编码')
    }

    // ② 地址文本解析失败 → 用地址簿保存的坐标（来自智能搜索选地址，相对可靠）
    if (!geocoded && address.value.latitude != null && address.value.longitude != null) {
      uLat = address.value.latitude
      uLng = address.value.longitude
      geocoded = true
      console.log(`[checkout] 降级为地址簿坐标: (${uLat}, ${uLng})`)
    }

    // ③ 手机 GPS 最后兜底（不准：手机位置 ≠ 收货地址，但比没有强）
    // #ifdef MP-WEIXIN
    if (!geocoded) {
      try {
        const locRes = await new Promise((resolve, reject) => {
          uni.getLocation({ type: 'gcj02', success: resolve, fail: reject })
        })
        uLat = locRes.latitude
        uLng = locRes.longitude
        geocoded = true
        console.log(`[checkout] 降级为手机GPS: (${uLat}, ${uLng})`)
      } catch (_) { console.warn('[checkout] 手机GPS获取失败') }
    }
    // #endif

    // ④ 所有方式都失败 → 不拦截（无法判断距离时放行，避免误伤用户）
    if (!geocoded) {
      console.warn('[checkout] 所有坐标获取方式均失败，跳过配送范围校验')
      return true
    }

    // calcDrivingDistance 内置三级降级（直连→服务端代理→Haversine），永远返回可用距离
    const driveResult = await calcDrivingDistance(
      { latitude: uLat, longitude: uLng },
      { latitude: sLat, longitude: sLng }
    )
    const distance = driveResult.data.distance
    const methodLabel = driveResult.data.method === 'driving' ? '驾车距离' : '直线距离(估)'
    console.log(`[checkout] ${methodLabel}: ${distance}km, 预计: ${driveResult.data.duration}分钟`)
    if (distance > deliveryRadius) {
      rangeModalMsg.value = `当前地址超出配送范围（${deliveryRadius}公里）`
      rangeModalDistance.value = distance.toFixed(1)
      rangeModalRadius.value = String(deliveryRadius)
      showRangeModal.value = true
      return false
    }
    return true
  } catch (err) {
    console.error('配送范围校验失败:', err)
    return true
  }
}

function onSwitchToPickup() {
  showRangeModal.value = false
  if (showPickupTab.value) onTabTap('pickup')
}

function onCloseRangeModal() {
  showRangeModal.value = false
}

// ========== 提交订单 ==========
function onSubmit() {
  if (submitting.value) return  // 防重复点击
  const phone = uni.getStorageSync('phone') || ''
  if (!phone) {
    showPhoneAuth.value = true
    return
  }
  doSubmit()
}

async function doSubmit() {
  if (submitting.value) return  // 二次防护
  submitting.value = true

  if (currentTab.value === 'delivery' && !address.value) {
    uni.showToast({ title: '请添加收货地址', icon: 'none' })
    submitting.value = false
    return
  }

  if (currentTab.value === 'delivery') {
    const rangeOk = await checkDeliveryRange()
    if (!rangeOk) { submitting.value = false; return }
  }

  if (isScheduled.value && !scheduleDate.value) {
    uni.showToast({ title: '请选择预约日期', icon: 'none' })
    submitting.value = false
    return
  }
  if (isScheduled.value && !scheduleTime.value) {
    uni.showToast({ title: '请选择预约时段', icon: 'none' })
    submitting.value = false
    return
  }

  uni.showLoading({ title: '提交中...' })

  try {
    const orderItems = items.value.map(item => ({
      productId: item.productId,
      productName: item.productName,
      pricingType: item.pricingType,
      spec: item.spec,
      quantity: item.quantity,
      remark: item.remark || ''
    }))

    const res = await post('/orders', {
      items: orderItems,
      type: currentTab.value,
      deliveryAddress: currentTab.value === 'delivery' ? address.value : null,
      isScheduled: isScheduled.value,
      scheduledDate: isScheduled.value ? scheduleDate.value : '',
      scheduledTime: isScheduled.value ? scheduleTime.value : ''
    })

    uni.hideLoading()

    const d = (res && res.data) || res || {}
    if (d.orderNo && d.payment) {
      // 支付成功后 callPay 的 onSuccess/onCancel 回调里重置 submitting
      callWxPay([{ orderNo: d.orderNo, payment: d.payment }])
    } else if (d.orderNo && !d.payment) {
      // 模拟器：WeChat 预下单失败不影响，直接走模拟支付
      const systemInfo = uni.getSystemInfoSync()
      if (systemInfo.platform === 'devtools') {
        callWxPay([{ orderNo: d.orderNo, payment: null }])
        return
      }
      submitting.value = false
      const errorMsg = d.payError || '支付暂不可用，请在订单列表重试'
      uni.showModal({
        title: '支付失败',
        content: errorMsg,
        showCancel: false,
        confirmText: '查看订单',
        success: () => uni.switchTab({ url: '/pages/orders/orders' })
      })
    } else {
      submitting.value = false
      uni.showToast({ title: '创建订单失败', icon: 'none' })
    }
  } catch (err) {
    submitting.value = false
    uni.hideLoading()
    console.error('创建订单失败:', err)
    uni.showToast({ title: err.message || '创建订单失败', icon: 'none' })
  }
}

function callWxPay(orders) {
  const order = orders[0]
  const purchasedKeys = new Set(items.value.map(i => i.cartKey))

  function clearCartAndGoOrders() {
    const cart = uni.getStorageSync('cart') || []
    const remaining = cart.filter(c => !purchasedKeys.has(c.cartKey))
    uni.setStorageSync('cart', remaining)
    uni.removeStorageSync('checkoutItems')
    // 同步到服务端（fire and forget）
    if (isLoggedIn()) {
      put('/cart', { items: remaining }).catch(() => {})
    }
  }

  callPay({
    orderNo: order.orderNo,
    payment: order.payment,
    amountDisplay: totalDisplay.value,
    clearItems: clearCartAndGoOrders,
    onSuccess: () => { submitting.value = false; uni.switchTab({ url: '/pages/orders/orders' }) },
    onCancel: () => { submitting.value = false; uni.switchTab({ url: '/pages/orders/orders' }) }
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
        setTimeout(() => doSubmit(), 1100)
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
}

// ========== 辅助 ==========
function formatSpec(spec) {
  if (!spec) return ''
  const parts = []
  if (spec.type) parts.push(spec.type)
  if (spec.weight) parts.push(spec.weight)
  if (spec.processing) parts.push(spec.processing)
  if (spec.delivery) {
    const dMap = { delivery: '外卖配送', pickup: '到店自取', scheduled: '预约配送' }
    parts.push(dMap[spec.delivery] || spec.delivery)
  }
  return parts.join(' · ')
}
</script>

<style scoped lang="scss">
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--color-bg-page); padding-bottom:140rpx; }

/* Tab */
.tab-bar { display:flex; background:var(--color-bg-card); margin:16rpx 24rpx; border-radius:var(--radius-lg); overflow:hidden; }
.tab-item { flex:1; text-align:center; padding:20rpx 0; font-size:var(--font-base); color:var(--color-text-2); border-bottom:3rpx solid transparent; }
.tab-active { color:var(--color-primary); border-bottom-color:var(--color-primary); font-weight:var(--weight-bold); }

/* 区块 */
.section { background:var(--color-bg-card); padding:24rpx; margin:0 24rpx 16rpx; border-radius:var(--radius-lg); }
.section-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); margin-bottom:16rpx; display:block; }

/* 商品清单 */
.item-row { display:flex; align-items:center; padding:12rpx 0; border-bottom:1rpx solid var(--color-border); gap:12rpx; }
.item-row:last-child { border-bottom:none; }
.item-emoji { font-size:36rpx; flex-shrink:0; }
.item-info { flex:1; overflow:hidden; }
.item-name { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.item-spec { font-size:var(--font-sm); color:var(--color-text-3); display:block; margin-top:4rpx; }
.item-right { display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; }
.item-price { font-size:var(--font-base); color:var(--color-primary); font-weight:var(--weight-bold); }
.item-qty { font-size:var(--font-sm); color:var(--color-text-3); margin-top:4rpx; }

/* 地址 */
.address-card { display:flex; flex-direction:column; }
.address-top { display:flex; align-items:center; gap:12rpx; }
.address-icon { width:36rpx; height:36rpx; flex-shrink:0; }
.address-info { flex:1; overflow:hidden; }
.address-contact { display:flex; gap:16rpx; margin-bottom:8rpx; }
.address-name { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); }
.address-phone { font-size:var(--font-base); color:var(--color-text-2); }
.address-text { font-size:var(--font-md); color:var(--color-text-3); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.address-arrow { font-size:var(--font-xl); color:var(--color-text-4); flex-shrink:0; }
.address-empty { display:flex; align-items:center; gap:12rpx; font-size:var(--font-base); color:var(--color-text-3); }

/* 时间胶囊 */
.time-capsules { display:flex; gap:16rpx; }
.time-capsule { flex:1; padding:16rpx 0; text-align:center; border-radius:var(--radius-md); border:2rpx solid var(--color-border); font-size:var(--font-base); color:var(--color-text-2); }
.capsule-active { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-pale); }

/* 规格标签复用 */
.spec-options { display:flex; flex-wrap:wrap; gap:12rpx; }
.spec-tag { padding:10rpx 24rpx; border-radius:var(--radius-md); border:2rpx solid var(--color-border); font-size:var(--font-sm); color:var(--color-text-2); }
.spec-tag-active { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-pale); }

/* 费用 */
.fee-row { display:flex; justify-content:space-between; padding:8rpx 0; }
.fee-label { font-size:var(--font-base); color:var(--color-text-2); }
.fee-value { font-size:var(--font-base); color:var(--color-text-1); font-weight:var(--weight-bold); }
.fee-free { color:var(--color-success); }
.fee-hint { font-size:var(--font-sm); color:var(--color-warning); margin-top:12rpx; padding:12rpx; background:var(--color-warning-bg); border-radius:var(--radius-md); }

/* 底部 */
.bottom-bar { position:fixed; bottom:0; left:0; right:0; display:flex; align-items:center; justify-content:space-between; background:var(--color-bg-card); padding:16rpx 24rpx; padding-bottom:calc(16rpx + env(safe-area-inset-bottom)); box-shadow:var(--shadow-float); z-index:50; }
.bottom-total { display:flex; align-items:baseline; }
.bottom-total-label { font-size:var(--font-md); color:var(--color-text-2); }
.bottom-total-value { font-size:var(--font-xl); color:var(--color-primary); font-weight:var(--weight-bold); }
.bottom-submit-btn { background:var(--color-primary); color:#fff; padding:16rpx 48rpx; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); }
.btn-disabled { opacity:0.6; pointer-events:none; }

/* 弹窗 */
.modal-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; }
.modal-card { background:#fff; border-radius:30rpx; padding:40rpx 32rpx; margin:0 48rpx; width:85%; max-width:560rpx; display:flex; flex-direction:column; align-items:center; box-shadow:0 8rpx 40rpx rgba(0,0,0,0.12); }
.modal-title { font-size:var(--font-lg); font-weight:var(--weight-bold); color:var(--color-text-1); margin-bottom:16rpx; }
.modal-body { font-size:var(--font-base); color:var(--color-text-2); text-align:center; margin-bottom:12rpx; line-height:1.6; }
.modal-detail { font-size:var(--font-sm); color:var(--color-text-3); margin-bottom:24rpx; }
.modal-actions { display:flex; flex-direction:column; gap:16rpx; width:100%; }
.modal-btn { text-align:center; padding:18rpx 0; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); }
.modal-btn-primary { background:var(--color-primary); color:#fff; }
.modal-btn-outline { border:2rpx solid var(--color-primary); color:var(--color-primary); }
.modal-cancel { margin-top:20rpx; font-size:var(--font-md); color:var(--color-text-3); }
.phone-auth-btn { width:100%; background:var(--color-primary); color:#fff; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); padding:18rpx 0; text-align:center; border:none; margin-top:8rpx; }
</style>
