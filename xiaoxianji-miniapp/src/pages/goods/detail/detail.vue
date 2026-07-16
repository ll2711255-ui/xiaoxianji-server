<template>
  <view class="page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="product">
      <!-- ========== 商品图片轮播 ========== -->
      <swiper v-if="images.length > 0" class="image-swiper" indicator-dots indicator-color="rgba(0,0,0,0.2)" indicator-active-color="#D4420A">
        <swiper-item v-for="(src, idx) in images" :key="idx">
          <image class="swiper-image" :src="src" mode="aspectFill" @click="onPreviewImage(src)" />
        </swiper-item>
      </swiper>
      <view v-else class="image-placeholder">
        <text class="image-placeholder-emoji">{{ categoryEmoji }}</text>
      </view>

      <!-- ========== 商品基本信息 ========== -->
      <view class="info-card">
        <view class="info-header">
          <text class="info-name">{{ product.name }}</text>
          <text class="info-emoji">{{ categoryEmoji }}</text>
        </view>
        <text v-if="product.sellingPoint || product.description" class="info-desc">{{ product.sellingPoint || product.description }}</text>
        <view class="info-price-row">
          <text class="info-price">¥{{ displayPriceStr }}</text>
          <text class="info-unit">{{ priceLabel }}</text>
        </view>
        <text class="info-sales">已售 {{ salesDisplay }} 份</text>
      </view>

      <!-- ========== 规格选择区 ========== -->

      <!-- 规格一：鸡肉类型（range_weight） -->
      <view v-if="pricingType === 'range_weight'" class="spec-card">
        <text class="spec-title">鸡肉类型</text>
        <view class="spec-options">
          <view
            v-for="opt in typeOptions" :key="opt.value"
            class="spec-tag" :class="{ 'spec-tag-active': selectedType === opt.value }"
            @click="onSelectType(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <!-- 规格二：重量 -->
      <view v-if="weightOptions.length > 0" class="spec-card">
        <text class="spec-title">{{ pricingType === 'range_weight' ? '重量范围' : '重量选择' }}</text>
        <view class="spec-options">
          <view
            v-for="opt in weightOptions" :key="opt.value"
            class="spec-tag" :class="{ 'spec-tag-active': selectedWeight && selectedWeight.value === opt.value }"
            @click="onSelectWeight(opt)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <!-- 规格三：处理方式 -->
      <view v-if="processingOptions.length > 0" class="spec-card">
        <text class="spec-title">处理方式</text>
        <view class="spec-options">
          <view
            v-for="opt in processingOptions" :key="opt.value"
            class="spec-tag" :class="{ 'spec-tag-active': selectedProcessing === opt.value }"
            @click="onSelectProcessing(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <!-- 规格四：取货方式 -->
      <view v-if="deliveryOptions.length > 0" class="spec-card">
        <text class="spec-title">取货方式</text>
        <view class="spec-options">
          <view
            v-for="opt in deliveryOptions" :key="opt.value"
            class="spec-tag" :class="{ 'spec-tag-active': selectedDelivery === opt.value }"
            @click="onSelectDelivery(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <!-- 数量（per_piece） -->
      <view v-if="pricingType === 'per_piece'" class="spec-card">
        <text class="spec-title">数量</text>
        <view class="quantity-row">
          <view class="qty-btn" @click="onQuantityMinus"><text>−</text></view>
          <text class="qty-value">{{ quantity }}</text>
          <view class="qty-btn" @click="onQuantityPlus"><text>+</text></view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="spec-card">
        <text class="spec-title">备注</text>
        <input class="remark-input" v-model="remark" placeholder="如有特殊要求请在此填写..." />
      </view>
    </template>

    <!-- 缺货提示 -->
    <view v-if="product && product.outOfStock" class="out-of-stock-banner">
      <text>该商品暂时缺货，补货中</text>
    </view>

    <!-- ========== 底部操作栏 ========== -->
    <view v-if="product" class="bottom-bar">
      <view class="bottom-btn bottom-btn-cart" @click="onAddToCart">
        <text>加入购物车</text>
      </view>
      <view class="bottom-btn bottom-btn-buy" @click="onBuyNow">
        <text>立即购买</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/utils/request'
import { formatMoney } from '@/utils/util'

const CATEGORY_EMOJI = { '整鸡': '🐔', '鸡腿': '🍗', '鸡翅': '🍖', '鸡胸': '🍗', '内脏': '🫀', '鸽子': '🕊' }

// ========== State ==========
const product = ref(null)
const images = ref([])
const pricingType = ref('')
const loading = ref(true)
const displayPriceStr = ref('0.00')
const priceLabel = ref('')
const salesDisplay = ref('')
const categoryEmoji = ref('🐔')
const typeOptions = ref([])
const selectedType = ref('')
const weightOptions = ref([])
const selectedWeight = ref(null)
const processingOptions = ref([])
const selectedProcessing = ref('')
const deliveryOptions = ref([])
const selectedDelivery = ref('')
const currentPrice = ref(0)
const quantity = ref(1)
const allSpecs = ref(null)
const weightSpecLabel = ref('整鸡')
const remark = ref('')

// ========== Lifecycle ==========
onLoad((options) => {
  const id = options.id
  if (!id) {
    uni.showToast({ title: '商品不存在', icon: 'none' })
    uni.navigateBack()
    return
  }
  loadProduct(id)
})

// ========== 加载商品 ==========
async function loadProduct(id) {
  try {
    const res = await get('/products/' + id)
    if (!res || !res.success) {
      uni.showToast({ title: '商品不存在', icon: 'none' })
      uni.navigateBack()
      return
    }
    const p = res.data && res.data.product
    if (!p) {
      uni.showToast({ title: '商品不存在', icon: 'none' })
      uni.navigateBack()
      return
    }

    const pt = p.pricingType
    const emoji = CATEGORY_EMOJI[p.category] || '🐔'

    const dModes = p.deliveryModes || ['delivery', 'pickup']
    const dOpts = dModes.map(m => {
      if (m === 'delivery') return { label: '外卖配送', value: 'delivery' }
      if (m === 'pickup') return { label: '到店自取', value: 'pickup' }
      if (m === 'scheduled') return { label: '预约配送', value: 'scheduled' }
      return { label: m, value: m }
    })
    const defaultD = dOpts.length > 0 ? dOpts[0].value : ''

    const pOpts = (p.processingOptions || ['整只', '切块']).map(x => ({ label: x, value: x }))
    const defaultP = pOpts.length > 0 ? pOpts[0].value : ''

    product.value = p
    images.value = p.images || []
    pricingType.value = pt
    categoryEmoji.value = emoji
    salesDisplay.value = String(p.sales || 0)
    processingOptions.value = pOpts
    selectedProcessing.value = defaultP
    deliveryOptions.value = dOpts
    selectedDelivery.value = defaultD
    loading.value = false

    initSpecsByType(p, pt, pOpts, dOpts, defaultP, defaultD)
  } catch (err) {
    console.error('加载商品详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function initSpecsByType(p, pt, pOpts, dOpts, defaultP, defaultD) {
  if (pt === 'range_weight') {
    initRangeWeightSpecs(p, pOpts, dOpts, defaultP, defaultD)
  } else if (pt === 'exact_weight') {
    initExactWeightSpecs(p, pOpts, dOpts, defaultP, defaultD)
  } else if (pt === 'per_piece') {
    initPerPieceSpecs(p, pOpts, dOpts, defaultP, defaultD)
  }
}

function initRangeWeightSpecs(p, pOpts, dOpts, defaultP, defaultD) {
  const specs = p.specs || []
  allSpecs.value = specs
  const typeSet = [...new Set(specs.map(s => s.type))]
  const tOpts = typeSet.map(t => {
    const first = specs.find(s => s.type === t)
    const ppj = first ? first.price_per_jin : 0
    return { label: t, value: t, pricePerJin: ppj, pricePerJinDisplay: formatMoney(ppj) }
  })
  const defaultT = tOpts.length > 0 ? tOpts[0].value : ''
  const wOpts = getWeightOptionsForType(specs, defaultT)
  const defaultW = wOpts.length > 0 ? wOpts[0] : null
  const initPrice = computeRangePrice(specs, defaultT, defaultW, defaultP)

  typeOptions.value = tOpts
  selectedType.value = defaultT
  weightOptions.value = wOpts
  selectedWeight.value = defaultW
  displayPriceStr.value = formatMoney(initPrice)
  priceLabel.value = '预估价'
  currentPrice.value = initPrice
  weightSpecLabel.value = getWeightSpecLabel(defaultT)
}

function getWeightSpecLabel(type) {
  const map = { '毛鸡称重': '整鸡', '光鸡称重': '整鸡', '鲜肉鸡称重': '半边鸡' }
  return map[type] || '整鸡'
}

function initExactWeightSpecs(p, pOpts, dOpts, defaultP, defaultD) {
  const gramsList = p.weightOptions || [500]
  const wOpts = gramsList.map(g => {
    const jin = g / 500
    const jinDisplay = jin % 1 === 0 ? jin : jin.toFixed(1)
    return { label: jinDisplay + '斤（' + g + 'g）', value: g, grams: g }
  })
  const defaultW = wOpts.length > 0 ? wOpts[0] : null
  const initPrice = computeExactPrice(p, defaultW, defaultP)

  weightOptions.value = wOpts
  selectedWeight.value = defaultW
  displayPriceStr.value = formatMoney(initPrice)
  priceLabel.value = '/份'
  currentPrice.value = initPrice
}

function initPerPieceSpecs(p, pOpts, dOpts, defaultP, defaultD) {
  const unitPrice = p.unitPrice || 0
  const initPrice = computePiecePrice(p, defaultP)
  const wOpts = [{ label: formatMoney(unitPrice) + '元/只', value: 'per_piece', unitPrice }]

  weightOptions.value = wOpts
  selectedWeight.value = wOpts[0]
  displayPriceStr.value = formatMoney(initPrice)
  priceLabel.value = '/只'
  currentPrice.value = initPrice
}

function getWeightOptionsForType(specs, type) {
  const filtered = specs.filter(s => s.type === type)
  const weightSet = [...new Set(filtered.map(s => s.weight_label))]
  return weightSet.map(w => {
    const match = filtered.find(s => s.weight_label === w)
    return { label: w, value: w, weight_max: match ? match.weight_max : 0 }
  })
}

function computeRangePrice(specs, type, weight, processing) {
  if (!specs || !type || !weight || !processing) return 0
  const match = specs.find(s =>
    s.type === type && s.weight_label === weight.value && s.processing === processing
  )
  if (!match) return 0
  const jin = (match.weight_max || 0) / 500
  return Math.round(match.price_per_jin * jin)
}

function computeExactPrice(p, weight, processing) {
  if (!p || !weight) return 0
  const jin = weight.grams / 500
  let price = p.pricePerJin * jin
  if (processing === '切块' && p.processingFee) price += p.processingFee
  return Math.round(price)
}

function computePiecePrice(p, processing) {
  if (!p) return 0
  const unitPrice = p.unitPrice || 0
  let price = unitPrice
  if (processing === '切块' && p.processingFee) price += p.processingFee
  return Math.round(price)
}

// ========== 规格选择事件 ==========
function onSelectType(val) {
  const specs = allSpecs.value
  const wOpts = getWeightOptionsForType(specs, val)
  let newW = selectedWeight.value
  if (!wOpts.find(w => w.value === (newW && newW.value))) {
    newW = wOpts.length > 0 ? wOpts[0] : null
  }
  const price = computeRangePrice(specs, val, newW, selectedProcessing.value)

  selectedType.value = val
  weightOptions.value = wOpts
  selectedWeight.value = newW
  currentPrice.value = price
  displayPriceStr.value = formatMoney(price * quantity.value)
  weightSpecLabel.value = getWeightSpecLabel(val)
}

function onSelectWeight(opt) {
  selectedWeight.value = opt
  recalcPrice()
}

function onSelectProcessing(val) {
  selectedProcessing.value = val
  recalcPrice()
}

function onSelectDelivery(val) {
  selectedDelivery.value = val
}

function recalcPrice() {
  const pt = pricingType.value
  const p = product.value
  const specs = allSpecs.value
  const selType = selectedType.value
  const selW = selectedWeight.value
  const selP = selectedProcessing.value
  const qty = quantity.value

  let price = 0
  if (pt === 'range_weight') {
    price = computeRangePrice(specs, selType, selW, selP)
  } else if (pt === 'exact_weight') {
    price = computeExactPrice(p, selW, selP)
  } else if (pt === 'per_piece') {
    price = computePiecePrice(p, selP)
  }

  currentPrice.value = price
  displayPriceStr.value = formatMoney(price * qty)
}

function onQuantityMinus() {
  if (quantity.value <= 1) return
  quantity.value--
  recalcPrice()
}

function onQuantityPlus() {
  if (quantity.value >= 99) return
  quantity.value++
  recalcPrice()
}

// ========== 图片预览 ==========
function onPreviewImage(src) {
  uni.previewImage({ urls: images.value, current: src })
}

// ========== 加购 & 购买 ==========
function validateSelection() {
  const pt = pricingType.value
  if (pt === 'range_weight' && !selectedType.value) {
    uni.showToast({ title: '请选择鸡肉类型', icon: 'none' })
    return false
  }
  if (!selectedWeight.value) {
    uni.showToast({ title: '请选择重量', icon: 'none' })
    return false
  }
  if (!selectedProcessing.value) {
    uni.showToast({ title: '请选择处理方式', icon: 'none' })
    return false
  }
  if (!selectedDelivery.value) {
    uni.showToast({ title: '请选择取货方式', icon: 'none' })
    return false
  }
  return true
}

function buildCartItem() {
  const p = product.value
  const pt = pricingType.value
  const selType = selectedType.value
  const selW = selectedWeight.value
  const selP = selectedProcessing.value
  const selD = selectedDelivery.value
  const price = currentPrice.value
  const qty = quantity.value
  const emoji = categoryEmoji.value

  const spec = {}
  if (pt === 'range_weight') spec.type = selType
  spec.weight = selW ? selW.label : ''
  if (selW) {
    if (selW.grams !== undefined) spec.weightGrams = selW.grams
    if (selW.value !== undefined) spec.weightValue = selW.value
    if (selW.weight_max !== undefined) spec.weight_max = selW.weight_max
  }
  spec.processing = selP
  spec.delivery = selD

  const cartKey = `${p._id}_${spec.type || ''}_${spec.weight}_${spec.processing}_${spec.delivery}`

  return {
    cartKey, productId: p._id, productName: p.name,
    image: p.images && p.images.length > 0 ? p.images[0] : '',
    pricingType: pt, spec, price, quantity: qty, emoji, remark: remark.value
  }
}

function onAddToCart() {
  if (product.value && product.value.outOfStock) {
    uni.showToast({ title: '该商品暂时缺货', icon: 'none' })
    return
  }
  if (!validateSelection()) return

  const cart = uni.getStorageSync('cart') || []
  const item = buildCartItem()
  const existIndex = cart.findIndex(c => c.cartKey === item.cartKey)
  if (existIndex >= 0) {
    cart[existIndex].quantity += item.quantity
    cart[existIndex].checked = true
  } else {
    cart.push(item)
  }
  uni.setStorageSync('cart', cart)
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}

function onBuyNow() {
  if (product.value && product.value.outOfStock) {
    uni.showToast({ title: '该商品暂时缺货', icon: 'none' })
    return
  }
  if (!validateSelection()) return

  const item = buildCartItem()
  uni.setStorageSync('buyNow', [item])
  uni.navigateTo({ url: '/pages/checkout/checkout?from=buyNow' })
}
</script>

<style scoped lang="scss">
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--color-bg-page); padding-bottom:120rpx; }

/* 图片轮播 */
.image-swiper { width:100%; height:480rpx; }
.swiper-image { width:100%; height:100%; }
.image-placeholder { width:100%; height:480rpx; background:var(--color-bg-page); display:flex; align-items:center; justify-content:center; }
.image-placeholder-emoji { font-size:144rpx; }

/* 基本信息 */
.info-card { background:var(--color-bg-card); padding:var(--space-md); margin:var(--space-sm) var(--space-md); border-radius:var(--radius-lg); }
.info-header { display:flex; justify-content:space-between; align-items:center; }
.info-name { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); flex:1; }
.info-emoji { font-size:56rpx; margin-left:16rpx; }
.info-desc { font-size:var(--font-md); color:var(--color-text-3); margin-top:8rpx; display:block; }
.info-price-row { display:flex; align-items:baseline; margin-top:16rpx; }
.info-price { font-size:var(--font-3xl); color:var(--color-primary); font-weight:var(--weight-bold); }
.info-unit { font-size:var(--font-md); color:var(--color-text-3); margin-left:6rpx; }
.info-sales { font-size:var(--font-sm); color:var(--color-text-3); margin-top:6rpx; }

/* 规格卡片 */
.spec-card { background:var(--color-bg-card); padding:24rpx; margin:0 24rpx 16rpx; border-radius:var(--radius-lg); }
.spec-title { font-size:var(--font-base); font-weight:600; color:var(--color-text-1); margin-bottom:16rpx; display:block; }
.spec-options { display:flex; flex-wrap:wrap; gap:16rpx; }
.spec-tag { padding:12rpx 28rpx; border-radius:var(--radius-md); border:2rpx solid var(--color-border); font-size:var(--font-base); color:var(--color-text-2); background:var(--color-bg-card); }
.spec-tag:active { opacity:0.8; }
.spec-tag-active { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-pale); }

/* 数量 */
.quantity-row { display:flex; align-items:center; gap:24rpx; }
.qty-btn { width:64rpx; height:64rpx; border-radius:var(--radius-full); background:var(--color-bg-page); border:2rpx solid var(--color-border); display:flex; align-items:center; justify-content:center; font-size:var(--font-xl); color:var(--color-text-1); }
.qty-btn:active { background:var(--color-border); }
.qty-value { font-size:var(--font-xl); font-weight:var(--weight-bold); color:var(--color-text-1); min-width:60rpx; text-align:center; }

/* 备注 */
.remark-input { background:var(--color-bg-page); border-radius:var(--radius-md); padding:16rpx 20rpx; font-size:var(--font-base); color:var(--color-text-1); width:100%; box-sizing:border-box; }

/* 缺货 */
.out-of-stock-banner { background:var(--color-warning-bg); padding:var(--space-sm) var(--space-md); margin:var(--space-sm) var(--space-md); border-radius:var(--radius-md); text-align:center; color:var(--color-warning); font-size:var(--font-base); }

/* 底部操作栏 */
.bottom-bar { position:fixed; bottom:0; left:0; right:0; display:flex; padding:var(--space-sm) var(--space-md); padding-bottom:calc(var(--space-sm) + env(safe-area-inset-bottom)); background:var(--color-bg-card); box-shadow:var(--shadow-float); z-index:50; gap:20rpx; }
.bottom-btn { flex:1; display:flex; align-items:center; justify-content:center; height:88rpx; border-radius:var(--radius-xl); font-size:var(--font-lg); font-weight:600; }
.bottom-btn-cart { border:2rpx solid var(--color-primary); color:var(--color-primary); background:var(--color-bg-card); }
.bottom-btn-buy { background:var(--color-primary); color:#fff; }

/* 加载状态 */
.loading-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:120rpx; }
.loading-spinner { width:60rpx; height:60rpx; border:4rpx solid var(--color-border); border-top-color:var(--color-primary); border-radius:var(--radius-full); animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.loading-text { margin-top:24rpx; font-size:var(--font-base); color:var(--color-text-3); }
</style>
