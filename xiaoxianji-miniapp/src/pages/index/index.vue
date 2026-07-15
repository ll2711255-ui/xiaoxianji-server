<template>
  <view class="page">
    <!-- ========== 搜索全屏浮层 ========== -->
    <view v-if="showSearch" class="search-overlay" @touchmove.stop>
      <view class="search-header">
        <view class="search-header-input-wrap">
          <image class="search-header-icon" src="/static/icons/ui/ui-search.png" mode="aspectFit" />
          <input
            class="search-header-input"
            v-model="searchKeyword"
            placeholder="搜索鸡肉、鸭肉..."
            :focus="true"
            confirm-type="search"
            @input="onSearchInput"
            @confirm="onSearchConfirm"
          />
          <text v-if="searchKeyword" class="search-header-clear" @click="onSearchClear">✕</text>
        </view>
        <text class="search-header-cancel" @click="onSearchCancel">取消</text>
      </view>

      <!-- 搜索结果 -->
      <scroll-view v-if="searchKeyword" class="search-body" scroll-y>
        <view v-if="searchResults.length > 0" class="search-results">
          <view
            v-for="item in searchResults"
            :key="item._id"
            class="search-result-card"
            :data-id="item._id"
            @click="onSearchResultTap($event, item._id)"
          >
            <view class="sri-thumb">
              <image v-if="item.images && item.images.length > 0" class="sri-img" :src="item.images[0]" mode="aspectFill" />
              <text v-else class="sri-emoji">🐔</text>
            </view>
            <view class="sri-info">
              <text class="sri-name">{{ item.name }}</text>
              <text class="sri-desc">{{ item.sellingPoint || item.description || '' }}</text>
              <text v-if="item.specSummary" class="goods-spec">{{ item.specSummary }}</text>
              <view class="sri-price">
                <text class="price-symbol">¥</text>
                <text class="price-value">{{ item.displayPrice }}</text>
                <text class="price-unit">{{ item.priceLabel }}</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else-if="searchHasNoResult" class="search-empty">
          <image class="search-empty-icon" src="/static/icons/ui/ui-search-empty.png" mode="aspectFit" />
          <text class="search-empty-text">没有找到相关商品</text>
          <text class="search-empty-hint">换个关键词试试吧</text>
        </view>
      </scroll-view>

      <!-- 搜索历史 -->
      <scroll-view v-else class="search-body" scroll-y>
        <view v-if="searchHistory.length > 0" class="search-history">
          <view class="search-history-header">
            <text class="search-history-title">搜索历史</text>
            <text class="search-history-clear" @click="onClearHistory">清空</text>
          </view>
          <view class="search-history-tags">
            <view
              v-for="item in searchHistory"
              :key="item"
              class="search-history-tag"
              :data-keyword="item"
              @click="onHistoryTap(item)"
            >{{ item }}</view>
          </view>
        </view>
        <view v-else class="search-hot">
          <text class="search-hot-title">🔥 热门搜索</text>
          <view class="search-hot-tags">
            <view class="search-hot-tag" @click="onHistoryTap('鸡')">鸡</view>
            <view class="search-hot-tag" @click="onHistoryTap('鸡腿')">鸡腿</view>
            <view class="search-hot-tag" @click="onHistoryTap('鸡翅')">鸡翅</view>
            <view class="search-hot-tag" @click="onHistoryTap('鸽子')">鸽子</view>
            <view class="search-hot-tag" @click="onHistoryTap('鸭')">鸭</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- ========== 顶部搜索栏 ========== -->
    <view v-if="!showSearch" class="search-bar">
      <view class="search-input" @click="onSearchTap">
        <image class="search-icon" src="/static/icons/ui/ui-search.png" mode="aspectFit" />
        <text class="search-placeholder">搜索鸡肉、鸭肉...</text>
      </view>
      <text class="brand-name">小鲜鸡</text>
    </view>

    <!-- ========== Banner 轮播 ========== -->
    <swiper v-if="bannerList.length > 0" class="banner-swiper" autoplay interval="3000" circular indicator-dots indicator-color="rgba(0,0,0,0.2)" indicator-active-color="#E8712A">
      <swiper-item v-for="item in bannerList" :key="item._id">
        <view v-if="item.image" class="banner-slide">
          <image class="banner-slide-img" :src="item.image" mode="aspectFill" />
          <view v-if="item.title" class="banner-img-mask">
            <text class="banner-img-title">{{ item.title }}</text>
            <text v-if="item.subtitle" class="banner-img-sub">{{ item.subtitle }}</text>
          </view>
        </view>
        <view v-else class="banner-slide banner-slide-text" :style="{ background: item.bg || '#f5f5f5' }">
          <view class="banner-text">
            <text class="banner-title">{{ item.title }}</text>
            <text class="banner-sub">{{ item.subtitle }}</text>
          </view>
          <view class="banner-emoji-wrap">
            <text class="banner-emoji">{{ item.title && item.title.includes('鸡') ? '🐔' : (item.title && item.title.includes('鸭') ? '🦆' : (item.title && item.title.includes('鸽') ? '🕊️' : '🎉')) }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>

    <!-- ========== 加载中 ========== -->
    <view v-if="loading" class="loading-state">
      <view class="loading-spinner"></view>
      <text class="loading-text">正在加载商品...</text>
    </view>

    <!-- ========== 加载失败 ========== -->
    <view v-else-if="loadError" class="error-state">
      <image class="error-icon" src="/static/icons/ui/ui-error.png" mode="aspectFit" />
      <text class="error-text">{{ errorMsg }}</text>
      <view class="error-retry-btn" @click="reload"><text>重新加载</text></view>
    </view>

    <!-- ========== 商品为空 ========== -->
    <view v-else-if="!loading && !loadError && groupedProducts.length === 0" class="empty-state">
      <image class="empty-icon" src="/static/icons/ui/ui-empty.png" mode="aspectFit" />
      <text class="empty-text">暂无商品</text>
      <text class="empty-hint">商家正在准备新鲜好货，请稍后再来</text>
    </view>

    <!-- ========== 左右联动主体 ========== -->
    <view v-else class="main-content">
      <scroll-view class="left-nav" scroll-y>
        <view
          v-for="cat in categories"
          :key="cat._id"
          class="cate-item"
          :class="{ 'cate-active': activeCategoryId === cat._id }"
          :data-id="cat._id"
          @click="onCategoryTap(cat._id)"
        >
          <view v-if="activeCategoryId === cat._id" class="cate-bar"></view>
          <text class="cate-name">{{ cat.name }}</text>
        </view>
      </scroll-view>

      <scroll-view
        class="right-scroll"
        scroll-y
        :scroll-into-view="scrollToSection"
        @scroll="onRightScroll"
        scroll-with-animation
      >
        <view
          v-for="group in groupedProducts"
          :key="group.categoryId"
          class="section-wrap"
          :class="{ 'section-featured': group.categoryId === 'cat_00' }"
          :id="'s-' + group.categoryId"
        >
          <view class="section-title">{{ group.categoryName }}</view>

          <view
            v-for="product in group.products"
            :key="product._id"
            class="goods-card"
            :class="{ 'goods-out-of-stock': product.outOfStock }"
            @click="onProductTap(product._id)"
          >
            <view class="goods-img-wrap">
              <image v-if="product.images && product.images.length > 0" class="goods-img" :src="product.images[0]" mode="aspectFill" lazy-load />
              <view v-else class="goods-img-placeholder"><text>🐔</text></view>
              <view v-if="product.outOfStock" class="out-of-stock-mask">
                <text class="out-of-stock-text">缺货</text>
              </view>
            </view>
            <view class="goods-info">
              <text class="goods-name">{{ product.name }}</text>
              <text class="goods-desc">{{ product.sellingPoint }}</text>
              <text class="goods-sales-tag">{{ product.salesTag }}</text>
              <view class="goods-price">
                <text class="price-symbol">¥</text>
                <text class="price-value">{{ product.displayPrice }}</text>
                <text class="price-unit">{{ product.priceLabel }}</text>
              </view>
            </view>
          </view>
        </view>

        <view style="height: 120rpx;"></view>
      </scroll-view>
    </view>

    <!-- ========== 底部购物车浮栏 ========== -->
    <view v-if="cartCount > 0" class="cart-float" @click="onCartTap">
      <view class="cart-float-left">
        <view class="cart-float-icon">
          <image class="cart-float-icon-img" src="/static/icons/ui/ui-cart.png" mode="aspectFit" />
          <view class="cart-badge">{{ cartCount }}</view>
        </view>
        <text class="cart-float-total">¥{{ cartTotalDisplay }}</text>
      </view>
      <view class="cart-float-btn"><text>去结算</text></view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onLoad, onShow, onReady, onPullDownRefresh } from '@dcloudio/uni-app'
import { get } from '@/utils/request'
import { formatMoney, safeImageUrl } from '@/utils/util'

// ========== State ==========
const categories = ref([])
const activeCategoryId = ref('')
const allProducts = ref([])
const groupedProducts = ref([])
const loading = ref(true)
const loadError = ref(false)
const errorMsg = ref('')
const bannerList = ref([
  { _id: 'banner_default_1', image: '', bg: 'linear-gradient(135deg, #FFF9ED, #FFE082)', title: '新鲜活鸡 每日直达', subtitle: '现宰现发 · 冷链配送' },
  { _id: 'banner_default_2', image: '', bg: 'linear-gradient(135deg, #FFFBEB, #FFD166)', title: '新用户首单立减', subtitle: '满¥39减¥5' },
  { _id: 'banner_default_3', image: '', bg: 'linear-gradient(135deg, #FEF4F0, #FDE0D5)', title: '鸭肉季 清爽上线', subtitle: '半片鸭低至¥12.8/斤' }
])
const scrollToSection = ref('')
const cartCount = ref(0)
const cartTotalDisplay = ref('0.00')
const showSearch = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searchHistory = ref([])
const searchHasNoResult = ref(false)

let _scrollTimer = null
let _sectionOffsets = []

// ========== Lifecycle ==========
onLoad(() => {
  loadCategories()
  loadBanners()
})

onShow(() => {
  loadCartInfo()
})

onReady(() => {
  setTimeout(() => calcSectionOffsets(), 500)
})

onPullDownRefresh(() => {
  loading.value = true
  loadError.value = false
  errorMsg.value = ''
  loadCategories().finally(() => uni.stopPullDownRefresh())
})

// ========== 购物车信息 ==========
function loadCartInfo() {
  const cart = uni.getStorageSync('cart') || []
  const count = cart.reduce((s, i) => s + i.quantity, 0)
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  cartCount.value = count
  cartTotalDisplay.value = formatMoney(total)
}

// ========== 加载 Banner ==========
async function loadBanners() {
  try {
    const res = await get('/store/banners')
    if (res && res.success && res.data) {
      const banners = res.data.banners || []
      if (banners.length > 0) {
        bannerList.value = banners.map(b => ({
          _id: b._id,
          image: safeImageUrl(b.imageUrl || b.image_url || b.image),
          linkUrl: b.linkUrl || b.link_url || b.link || '',
          bg: '#FFF9ED',
          title: b.title || '',
          subtitle: b.subtitle || ''
        }))
      }
    }
  } catch (err) {
    console.error('加载Banner失败:', err)
  }
}

// ========== 加载分类 ==========
async function loadCategories() {
  try {
    const res = await get('/categories')
    const cats = (res && res.data && res.data.categories) || []
    if (cats.length > 0) {
      categories.value = cats
      activeCategoryId.value = cats[0]._id
      loadError.value = false
      errorMsg.value = ''
      loadAllProducts()
    } else {
      loading.value = false
      loadError.value = false
    }
  } catch (err) {
    console.error('加载分类失败:', err)
    loading.value = false
    loadError.value = true
    errorMsg.value = '加载失败，请检查网络后重试'
  }
}

// ========== 加载全部商品 ==========
async function loadAllProducts() {
  try {
    const res = await get('/products', { pageSize: 50 })
    const products = ((res && res.data && res.data.products) || []).map(p => ({
      ...p,
      // 归一化 images 为字符串数组，防止对象/布尔值被用作 <image> src
      images: normalizeImages(p.images),
      priceLabel: getPriceLabel(p),
      displayPrice: getDisplayPrice(p),
      sellingPoint: p.sellingPoint || p.description || '',
      salesTag: getSalesTag(p),
      specSummary: getSpecSummary(p)
    }))
    allProducts.value = products
    loading.value = false
    loadError.value = false
    buildGroupedProducts(products)
  } catch (err) {
    console.error('加载商品失败:', err)
    loading.value = false
    loadError.value = true
    errorMsg.value = '商品加载失败，请下拉刷新重试'
  }
}

function buildGroupedProducts(products) {
  const grouped = categories.value.map(cat => {
    let items
    if (cat._id === 'cat_00') {
      items = []
      const seen = new Set()
      for (const p of products) {
        if (!seen.has(p.categoryId) && p.categoryId !== 'cat_00') {
          seen.add(p.categoryId)
          items.push(...products.filter(x => x.categoryId === p.categoryId).slice(0, 2))
        }
      }
    } else {
      items = products.filter(p => p.categoryId === cat._id)
    }
    return { categoryId: cat._id, categoryName: cat.name, products: items }
  }).filter(g => g.products.length > 0)
  groupedProducts.value = grouped
}

function reload() {
  loading.value = true
  loadError.value = false
  errorMsg.value = ''
  loadCategories()
}

// ========== 左侧分类点击 ==========
function onCategoryTap(id) {
  if (id === activeCategoryId.value) return
  activeCategoryId.value = id
  scrollToSection.value = 's-' + id
}

// ========== 右侧滚动联动 ==========
function onRightScroll(e) {
  const scrollTop = e.detail.scrollTop
  if (_scrollTimer) return
  _scrollTimer = setTimeout(() => {
    _scrollTimer = null
    detectActiveCategory(scrollTop)
  }, 100)
}

function detectActiveCategory(scrollTop) {
  if (!_sectionOffsets || _sectionOffsets.length === 0) return
  let activeId = activeCategoryId.value
  for (let i = _sectionOffsets.length - 1; i >= 0; i--) {
    if (scrollTop >= _sectionOffsets[i].top - 10) {
      activeId = _sectionOffsets[i].id
      break
    }
  }
  if (activeId !== activeCategoryId.value) {
    activeCategoryId.value = activeId
  }
}

function calcSectionOffsets() {
  const query = uni.createSelectorQuery()
  query.selectAll('.section-wrap').boundingClientRect()
  query.select('.right-scroll').boundingClientRect()
  query.exec(res => {
    if (!res || !res[0] || !res[1]) return
    const sections = res[0]
    const scrollView = res[1]
    _sectionOffsets = sections.map(s => ({
      id: s.id.replace('s-', ''),
      top: s.top - scrollView.top
    }))
  })
}

// ========== 商品点击 ==========
function onProductTap(id) {
  uni.navigateTo({ url: '/pages/goods/detail/detail?id=' + id })
}

// ========== 搜索 ==========
function onSearchTap() {
  const history = uni.getStorageSync('search_history') || []
  showSearch.value = true
  searchKeyword.value = ''
  searchResults.value = []
  searchHistory.value = history.slice(0, 10)
  searchHasNoResult.value = false
}

function onSearchInput() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    searchResults.value = []
    searchHasNoResult.value = false
    return
  }
  const lower = keyword.toLowerCase()
  const results = allProducts.value.filter(p => {
    if (p.outOfStock) return false
    return (p.name && p.name.toLowerCase().includes(lower)) ||
           (p.sellingPoint && p.sellingPoint.toLowerCase().includes(lower)) ||
           (p.description && p.description.toLowerCase().includes(lower))
  })
  searchResults.value = results
  searchHasNoResult.value = results.length === 0
}

function onSearchClear() {
  searchKeyword.value = ''
  searchResults.value = []
  searchHasNoResult.value = false
}

function onSearchCancel() {
  showSearch.value = false
  searchKeyword.value = ''
  searchResults.value = []
  searchHasNoResult.value = false
}

function onSearchConfirm() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  let history = uni.getStorageSync('search_history') || []
  history = history.filter(h => h !== keyword)
  history.unshift(keyword)
  if (history.length > 10) history = history.slice(0, 10)
  uni.setStorageSync('search_history', history)
  searchHistory.value = history
  if (searchResults.value.length === 0) onSearchInput()
}

function onHistoryTap(keyword) {
  searchKeyword.value = keyword
  onSearchInput()
  onSearchConfirm()
}

function onClearHistory() {
  uni.showModal({
    title: '清除历史',
    content: '确定要清除所有搜索历史吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('search_history')
        searchHistory.value = []
      }
    }
  })
}

function onSearchResultTap(e, id) {
  onSearchCancel()
  uni.navigateTo({ url: '/pages/goods/detail/detail?id=' + id })
}

// ========== 购物车 ==========
function onCartTap() {
  uni.switchTab({ url: '/pages/cart/cart' })
}

// ========== 辅助函数 ==========
/** 将 images 字段归一化为纯字符串数组，防止对象/布尔值被用作 <image> src */
function normalizeImages(images) {
  if (!images) return []
  if (!Array.isArray(images)) {
    // 单个对象/字符串
    const url = safeImageUrl(images)
    return url ? [url] : []
  }
  return images.map(img => safeImageUrl(img)).filter(Boolean)
}

function getPriceLabel(product) {
  switch (product.pricingType) {
    case 'range_weight': return '/斤起'
    case 'exact_weight': return '/斤'
    case 'per_piece': return '/只'
    default: return '/斤'
  }
}

function getDisplayPrice(product) {
  if (product.pricingType === 'range_weight') {
    const specs = product.specs || []
    let minPrice = Infinity
    for (const s of specs) {
      if (s.price_per_jin && s.price_per_jin < minPrice) minPrice = s.price_per_jin
    }
    if (minPrice < Infinity) return (minPrice / 100).toFixed(2)
  }
  if (product.pricingType === 'exact_weight' && product.pricePerJin) {
    return (product.pricePerJin / 100).toFixed(2)
  }
  if (product.pricingType === 'per_piece' && product.unitPrice) {
    return (product.unitPrice / 100).toFixed(2)
  }
  if (product.minPrice) return (Number(product.minPrice) / 100).toFixed(2)
  return '0.00'
}

function getSalesTag(product) {
  const sales = product.sales || 0
  if (sales >= 2000) return '热销爆款'
  if (sales >= 1000) return '销量飙升'
  return '已售 ' + sales + ' 份'
}

function getSpecSummary(product) {
  if (product.pricingType === 'range_weight') {
    const specs = product.specs || []
    if (specs.length === 0) return '称重计价 · 多规格可选'
    const typeSet = []
    const seenTypes = new Set()
    for (const s of specs) {
      let short = (s.type || '').replace('称重', '')
      if (short && !seenTypes.has(short)) { seenTypes.add(short); typeSet.push(short) }
    }
    let minJin = Infinity, maxJin = 0
    for (const s of specs) {
      const label = s.weight_label || ''
      const parts = label.split('-')
      if (parts.length === 2) {
        const lo = parseFloat(parts[0]), hi = parseFloat(parts[1])
        if (!isNaN(lo) && lo < minJin) minJin = lo
        if (!isNaN(hi) && hi > maxJin) maxJin = hi
      }
    }
    const typeStr = typeSet.join('/')
    const weightStr = minJin < Infinity ? (minJin + '-' + maxJin + '斤') : '多规格'
    return typeStr + ' · ' + weightStr
  }
  if (product.pricingType === 'exact_weight') {
    const priceFen = product.pricePerJin
    const opts = product.weightOptions || []
    if (priceFen) {
      const priceYuan = formatMoney(priceFen)
      if (opts.length > 0) return '¥' + priceYuan + '/斤 · ' + opts.map(w => (w >= 500 ? (w / 500) + '斤' : w + 'g')).join('/') + '可选'
      return '¥' + priceYuan + '/斤'
    }
    return '按斤计价'
  }
  if (product.pricingType === 'per_piece') {
    const priceFen = product.unitPrice
    if (priceFen) return '¥' + formatMoney(priceFen) + '/只'
    return '按只计价'
  }
  return ''
}
</script>

<style scoped lang="scss">
/* ========== 搜索浮层 ========== */
.search-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:var(--color-bg-page); z-index:200; display:flex; flex-direction:column; }
.search-header { display:flex; align-items:center; padding:var(--space-sm) var(--space-md); padding-top:calc(var(--space-sm) + env(safe-area-inset-top)); background:var(--color-bg-card); gap:var(--space-sm); flex-shrink:0; box-shadow:var(--shadow-card); }
.search-header-input-wrap { flex:1; display:flex; align-items:center; background:var(--color-bg-input); border-radius:var(--radius-full); padding:12rpx var(--space-md); }
.search-header-icon { width:28rpx; height:28rpx; margin-right:12rpx; flex-shrink:0; }
.search-header-input { flex:1; font-size:var(--font-base); color:var(--color-text-1); }
.search-header-clear { font-size:var(--font-base); color:var(--color-text-3); padding:var(--space-xs); flex-shrink:0; }
.search-header-cancel { font-size:var(--font-base); color:var(--color-primary); flex-shrink:0; padding:var(--space-xs) 0; }
.search-body { flex:1; overflow:hidden; }
.search-results { padding:var(--space-sm) var(--space-md); }
.search-result-card { display:flex; padding:var(--space-sm); border-radius:var(--radius-md); margin-bottom:12rpx; background:var(--color-bg-card); border:1rpx solid transparent; border-bottom-color:var(--color-border); }
.search-result-card:active { background:var(--color-bg-page); }
.sri-thumb { width:140rpx; height:140rpx; border-radius:var(--radius-md); background:var(--color-bg-page); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }
.sri-img { width:100%; height:100%; }
.sri-emoji { font-size:54rpx; }
.sri-info { flex:1; margin-left:20rpx; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; }
.sri-name { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sri-desc { font-size:var(--font-sm); color:var(--color-text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:4rpx; }
.sri-price { display:flex; align-items:baseline; margin-top:4rpx; }
.sri-price .price-symbol { font-size:var(--font-sm); color:var(--color-primary); font-weight:var(--weight-bold); }
.sri-price .price-value { font-size:var(--font-lg); color:var(--color-primary); font-weight:var(--weight-bold); line-height:1; }
.sri-price .price-unit { font-size:var(--font-sm); color:var(--color-text-3); margin-left:4rpx; }
.search-empty { display:flex; flex-direction:column; align-items:center; padding:120rpx var(--space-xl); }
.search-empty-icon { width:88rpx; height:88rpx; margin-bottom:var(--space-md); opacity:0.5; }
.search-empty-text { font-size:var(--font-base); color:var(--color-text-3); }
.search-empty-hint { font-size:var(--font-md); color:var(--color-text-3); margin-top:12rpx; }
.search-history { padding:var(--space-md); }
.search-history-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20rpx; }
.search-history-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); }
.search-history-clear { font-size:var(--font-md); color:var(--color-text-3); }
.search-history-tags { display:flex; flex-wrap:wrap; gap:var(--space-sm); }
.search-history-tag { padding:12rpx 28rpx; background:var(--color-bg-card); border-radius:var(--radius-lg); font-size:var(--font-base); color:var(--color-text-2); border:1rpx solid var(--color-border); }
.search-hot { padding:var(--space-md); }
.search-hot-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); display:block; margin-bottom:20rpx; }
.search-hot-tags { display:flex; flex-wrap:wrap; gap:var(--space-sm); }
.search-hot-tag { padding:12rpx 28rpx; background:var(--color-primary-pale); border-radius:var(--radius-lg); font-size:var(--font-base); color:var(--color-primary); }

/* ========== 页面 ========== */
.page { display:flex; flex-direction:column; height:100vh; background:var(--color-bg-page); overflow:hidden; }
.search-bar { display:flex; align-items:center; padding:var(--space-sm) var(--space-md); background:var(--color-bg-card); gap:20rpx; flex-shrink:0; }
.search-input { flex:1; display:flex; align-items:center; background:var(--color-bg-input); border-radius:var(--radius-full); padding:16rpx var(--space-md); }
.search-icon { width:28rpx; height:28rpx; margin-right:12rpx; }
.search-placeholder { font-size:var(--font-base); color:var(--color-text-3); }
.brand-name { font-size:var(--font-lg); font-weight:var(--weight-bold); color:var(--color-primary); flex-shrink:0; }

/* Banner */
.banner-swiper { flex-shrink:0; height:180rpx; margin:var(--space-sm) var(--space-md); border-radius:var(--radius-lg); overflow:hidden; }
.banner-slide { display:flex; align-items:center; justify-content:space-between; padding:var(--space-md) var(--space-lg); height:100%; box-sizing:border-box; }
.banner-text { display:flex; flex-direction:column; }
.banner-title { font-size:var(--font-lg); font-weight:var(--weight-bold); color:var(--color-text-1); }
.banner-sub { font-size:var(--font-md); color:var(--color-text-2); margin-top:var(--space-xs); }
.banner-emoji { font-size:88rpx; }

/* 左右联动 */
.main-content { flex:1; display:flex; overflow:hidden; margin:0 var(--space-md) var(--space-sm); border-radius:var(--radius-lg); overflow:hidden; }
.left-nav { width:180rpx; background:var(--color-bg-page); flex-shrink:0; }
.cate-item { position:relative; display:flex; align-items:center; justify-content:center; height:96rpx; padding:0 12rpx; }
.cate-bar { position:absolute; left:0; top:50%; transform:translateY(-50%); width:6rpx; height:40rpx; background:var(--color-primary); border-radius:0 3rpx 3rpx 0; }
.cate-name { font-size:var(--font-base); color:var(--color-text-2); }
.cate-active { background:var(--color-bg-card); }
.cate-active .cate-name { color:var(--color-primary); font-weight:var(--weight-bold); }

/* 商品列表 */
.right-scroll { flex:1; background:var(--color-bg-card); padding:0 var(--space-sm); }
.section-title { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); text-align:center; padding:var(--space-md) 0 var(--space-sm); }
.goods-card { display:flex; padding:12rpx 0; border-bottom:1rpx solid var(--color-border); }
.goods-card:active { opacity:0.9; }
.goods-out-of-stock { opacity:0.65; }
.out-of-stock-mask { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; }
.out-of-stock-text { color:#fff; font-size:var(--font-base); font-weight:var(--weight-bold); padding:var(--space-xs) var(--space-md); border:2px solid rgba(255,255,255,0.8); border-radius:var(--radius-md); }
.goods-img-wrap { position:relative; width:200rpx; height:200rpx; border-radius:var(--radius-md); overflow:hidden; flex-shrink:0; background:var(--color-bg-page); }
.goods-img { width:100%; height:100%; }
.goods-img-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:64rpx; background:var(--color-bg-page); }
.goods-info { flex:1; margin-left:20rpx; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; }
.goods-name { font-size:var(--font-base); font-weight:var(--weight-bold); color:var(--color-text-1); display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; line-height:1.4; }
.goods-desc { font-size:var(--font-sm); color:var(--color-text-3); margin-top:6rpx; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:1; overflow:hidden; }
.goods-sales-tag { font-size:var(--font-sm); color:var(--color-primary); margin-top:var(--space-xs); }
.goods-price { display:flex; align-items:baseline; margin-top:4rpx; }
.goods-price .price-symbol { font-size:var(--font-sm); color:var(--color-primary); font-weight:var(--weight-bold); }
.goods-price .price-value { font-size:var(--font-lg); color:var(--color-primary); font-weight:var(--weight-bold); line-height:1; }
.goods-price .price-unit { font-size:var(--font-sm); color:var(--color-text-3); margin-left:4rpx; flex-shrink:0; }

/* 购物车浮栏 */
.cart-float { position:fixed; bottom:var(--space-sm); left:var(--space-md); right:var(--space-md); display:flex; align-items:center; justify-content:space-between; background:var(--color-text-1); border-radius:var(--radius-full); padding:14rpx var(--space-md); z-index:100; box-shadow:var(--shadow-float); }
.cart-float-left { display:flex; align-items:center; gap:var(--space-sm); }
.cart-float-icon { position:relative; width:60rpx; height:60rpx; background:var(--color-primary); border-radius:var(--radius-full); display:flex; align-items:center; justify-content:center; }
.cart-float-icon-img { width:32rpx; height:32rpx; }
.cart-badge { position:absolute; top:-6rpx; right:-6rpx; min-width:30rpx; height:30rpx; background:var(--color-primary); color:#fff; font-size:var(--font-xs); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; padding:0 5rpx; line-height:1; }
.cart-float-total { font-size:var(--font-lg); color:#fff; font-weight:var(--weight-bold); }
.cart-float-btn { background:var(--color-primary); color:#fff; padding:14rpx 36rpx; border-radius:var(--radius-full); font-size:var(--font-base); font-weight:var(--weight-bold); }

/* 加载/错误/空状态 */
.loading-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80rpx var(--space-xl); }
.loading-spinner { width:60rpx; height:60rpx; border:4rpx solid var(--color-border); border-top-color:var(--color-primary); border-radius:var(--radius-full); animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.loading-text { margin-top:var(--space-md); font-size:var(--font-base); color:var(--color-text-3); }
.error-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80rpx var(--space-xl); }
.error-icon { width:88rpx; height:88rpx; margin-bottom:var(--space-md); }
.error-text { font-size:var(--font-base); color:var(--color-text-3); text-align:center; margin-bottom:var(--space-lg); }
.error-retry-btn { display:flex; align-items:center; justify-content:center; width:240rpx; height:72rpx; background:var(--color-primary); border-radius:var(--radius-xl); font-size:var(--font-base); color:#fff; font-weight:var(--weight-bold); }
</style>
