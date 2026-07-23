<template>
  <view class="page">
    <!-- 空购物车 -->
    <view v-if="isEmpty" class="empty-state">
      <image class="empty-icon" src="/static/icons/ui/ui-empty-cart.png" mode="aspectFit" />
      <text class="empty-title">购物车是空的</text>
      <text class="empty-hint">快去首页挑选新鲜好货吧</text>
      <view class="empty-btn" @click="onGoHome"><text>去逛逛</text></view>
    </view>

    <!-- 购物车列表 -->
    <template v-else>
      <scroll-view class="cart-list" scroll-y>
        <view v-for="(item, index) in cartItems" :key="item.cartKey" class="cart-card">
          <!-- 勾选框 -->
          <view class="cart-check" @click="onCheckItem(index, !item.checked)">
            <view class="check-circle" :class="{ 'check-active': item.checked }">
              <text v-if="item.checked">✓</text>
            </view>
          </view>

          <!-- 商品图 -->
          <view class="cart-thumb" @click="onProductTap(item.productId)">
            <image v-if="item.image" class="cart-thumb-img" :src="item.image" mode="aspectFill" />
            <text v-else class="cart-thumb-emoji">{{ item.emoji || '🐔' }}</text>
          </view>

          <!-- 商品信息 -->
          <view class="cart-info" @click="onProductTap(item.productId)">
            <text class="cart-name">{{ item.productName }}</text>
            <text class="cart-spec">{{ formatSpec(item.spec) }}</text>
            <view class="cart-price-row">
              <text class="cart-price">¥{{ item.priceDisplay }}</text>
              <view class="cart-qty">
                <view class="cart-qty-btn" @click.stop="onQuantityChange(index, -1)"><text>−</text></view>
                <text class="cart-qty-val">{{ item.quantity }}</text>
                <view class="cart-qty-btn" @click.stop="onQuantityChange(index, 1)"><text>+</text></view>
              </view>
            </view>
          </view>

          <!-- 删除 -->
          <view class="cart-delete" @click="onDeleteItem(index)"><text>🗑</text></view>
        </view>
      </scroll-view>

      <!-- 底部结算栏 -->
      <view class="bottom-bar">
        <view class="bottom-left" @click="onCheckAll(!allChecked)">
          <view class="check-circle" :class="{ 'check-active': allChecked }">
            <text v-if="allChecked">✓</text>
          </view>
          <text class="bottom-all">全选</text>
        </view>
        <view class="bottom-right">
          <view class="bottom-total">
            <text class="bottom-total-label">合计：</text>
            <text class="bottom-total-value">¥{{ checkedTotalDisplay }}</text>
          </view>
          <view class="bottom-checkout-btn" :class="{ 'btn-disabled': checkedCount === 0 }" @click="onCheckout">
            <text>结算({{ checkedCount }})</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, put, isLoggedIn } from '@/utils/request'
import { formatMoney } from '@/utils/util'

// ========== State ==========
const cartItems = ref([])
const checkedTotalDisplay = ref('0.00')
const allChecked = ref(false)
const checkedCount = ref(0)
const isEmpty = ref(true)

// ========== Lifecycle ==========
onShow(() => {
  loadCart()
})

// ========== 加载购物车（本地优先 → 服务端合并） ==========
async function loadCart() {
  const localCart = uni.getStorageSync('cart') || []

  // 如果已登录，尝试从服务端加载（服务端数据优先）
  if (isLoggedIn()) {
    try {
      const res = await get('/cart')
      const serverCart = (res && res.data && res.data.cart) || []
      if (serverCart.length > 0) {
        // 服务端有数据 → 以服务端为准
        uni.setStorageSync('cart', serverCart)
        renderCart(serverCart)
        return
      } else if (localCart.length > 0) {
        // 服务端空但本地有数据 → 推送到服务端
        syncCartToServer(localCart)
      }
    } catch (err) {
      console.error('[cart] 服务端加载失败，使用本地:', err)
    }
  }

  renderCart(localCart)
}

// ========== 保存购物车（本地 + 服务端双写） ==========
function saveCart(cart) {
  uni.setStorageSync('cart', cart)
  syncCartToServer(cart)
}

async function syncCartToServer(cart) {
  if (!isLoggedIn()) return
  try {
    await put('/cart', { items: cart })
  } catch (err) {
    console.error('[cart] 服务端同步失败:', err)
  }
}

// ========== 渲染 ==========
function renderCart(cart) {
  const items = cart.map((item, index) => ({
    ...item,
    cartKey: item.cartKey || `${item.productId}_${item.spec?.type || ''}_${item.spec?.weight || ''}_${item.spec?.processing || ''}_${item.spec?.delivery || ''}_${index}`,
    checked: item.checked !== false,
    priceDisplay: formatMoney(item.price),
    subtotalDisplay: formatMoney(item.price * item.quantity)
  }))

  const checked = items.filter(i => i.checked)
  const total = checked.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const all = items.length > 0 && checked.length === items.length

  cartItems.value = items
  checkedTotalDisplay.value = formatMoney(total)
  allChecked.value = all
  checkedCount.value = checked.length
  isEmpty.value = items.length === 0
}

// ========== 操作 ==========
function onCheckItem(index, checked) {
  const cart = uni.getStorageSync('cart') || []
  if (index < 0 || index >= cart.length) return
  cart[index].checked = checked
  saveCart(cart)
  renderCart(cart)
}

function onCheckAll(checked) {
  const cart = uni.getStorageSync('cart') || []
  cart.forEach(item => { item.checked = checked })
  saveCart(cart)
  renderCart(cart)
}

function onQuantityChange(index, delta) {
  const cart = uni.getStorageSync('cart') || []
  if (index < 0 || index >= cart.length) return
  cart[index].quantity += delta
  if (cart[index].quantity <= 0) cart.splice(index, 1)
  saveCart(cart)
  renderCart(cart)
}

function onDeleteItem(index) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该商品吗？',
    success: (res) => {
      if (res.confirm) {
        const cart = uni.getStorageSync('cart') || []
        cart.splice(index, 1)
        saveCart(cart)
  renderCart(cart)
      }
    }
  })
}

function onCheckout() {
  const checked = cartItems.value.filter(i => i.checked)
  if (checked.length === 0) {
    uni.showToast({ title: '请至少勾选一件商品', icon: 'none' })
    return
  }
  uni.setStorageSync('checkoutItems', checked)
  uni.navigateTo({ url: '/pages/checkout/checkout?from=cart' })
}

function onProductTap(id) {
  uni.navigateTo({ url: '/pages/goods/detail/detail?id=' + id })
}

function onGoHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

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
.page { display:flex; flex-direction:column; height:100vh; background:var(--color-bg-page); }

/* 空状态 */
.empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80rpx; }
.empty-icon { width:120rpx; height:120rpx; margin-bottom:24rpx; }
.empty-title { font-size:var(--font-lg); color:var(--color-text-2); font-weight:var(--weight-bold); }
.empty-hint { font-size:var(--font-md); color:var(--color-text-3); margin-top:12rpx; }
.empty-btn { margin-top:40rpx; background:var(--color-primary); color:#fff; padding:16rpx 64rpx; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); }

/* 列表 */
.cart-list { flex:1; padding:16rpx 24rpx; padding-bottom:140rpx; }
.cart-card { display:flex; align-items:center; background:var(--color-bg-card); padding:20rpx 16rpx; border-radius:var(--radius-lg); margin-bottom:12rpx; gap:16rpx; }

.cart-check { padding:8rpx; }
.check-circle { width:40rpx; height:40rpx; border-radius:var(--radius-full); border:3rpx solid var(--color-border-dark); display:flex; align-items:center; justify-content:center; font-size:var(--font-sm); color:var(--color-text-4); }
.check-active { border-color:var(--color-primary); background:var(--color-primary); color:#fff; }

.cart-thumb { width:140rpx; height:140rpx; border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-page); flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.cart-thumb-img { width:100%; height:100%; }
.cart-thumb-emoji { font-size:54rpx; }

.cart-info { flex:1; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; min-height:140rpx; }
.cart-name { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cart-spec { font-size:var(--font-sm); color:var(--color-text-3); margin-top:4rpx; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cart-price-row { display:flex; align-items:center; justify-content:space-between; margin-top:8rpx; }
.cart-price { font-size:var(--font-lg); color:var(--color-primary); font-weight:var(--weight-bold); }
.cart-qty { display:flex; align-items:center; gap:12rpx; }
.cart-qty-btn { width:48rpx; height:48rpx; border-radius:var(--radius-full); background:var(--color-bg-page); border:2rpx solid var(--color-border); display:flex; align-items:center; justify-content:center; font-size:var(--font-lg); color:var(--color-text-2); }
.cart-qty-val { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); min-width:40rpx; text-align:center; }

.cart-delete { padding:8rpx; font-size:var(--font-xl); opacity:0.6; }

/* 底部结算栏 */
.bottom-bar { position:fixed; bottom:0; left:0; right:0; display:flex; align-items:center; justify-content:space-between; background:var(--color-bg-card); padding:16rpx 24rpx; padding-bottom:calc(16rpx + env(safe-area-inset-bottom)); box-shadow:var(--shadow-float); z-index:50; }
.bottom-left { display:flex; align-items:center; gap:12rpx; }
.bottom-all { font-size:var(--font-base); color:var(--color-text-2); }
.bottom-right { display:flex; align-items:center; gap:16rpx; }
.bottom-total { display:flex; align-items:baseline; }
.bottom-total-label { font-size:var(--font-md); color:var(--color-text-2); }
.bottom-total-value { font-size:var(--font-xl); color:var(--color-primary); font-weight:var(--weight-bold); }
.bottom-checkout-btn { background:var(--color-primary); color:#fff; padding:16rpx 40rpx; border-radius:var(--radius-xl); font-size:var(--font-base); font-weight:var(--weight-bold); }
.btn-disabled { background:var(--color-border-dark); color:var(--color-text-3); }
</style>
