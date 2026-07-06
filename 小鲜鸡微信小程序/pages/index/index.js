const api = require('../../utils/api');
const { formatMoney, getPricingUnit, getPricingLabel } = require('../../utils/util');

Page({
  data: {
    categories: [],
    activeCategoryId: '',
    allProducts: [],
    groupedProducts: [],

    // 页面状态
    loading: true,
    loadError: false,
    errorMsg: '',

    // Banner（默认兜底数据，API 返回后覆盖）
    bannerList: [
      { _id: 'banner_default_1', image: '', bg: 'linear-gradient(135deg, #FFF9ED, #FFE082)', title: '新鲜活鸡 每日直达', subtitle: '现宰现发 · 冷链配送' },
      { _id: 'banner_default_2', image: '', bg: 'linear-gradient(135deg, #FFFBEB, #FFD166)', title: '新用户首单立减', subtitle: '满¥39减¥5' },
      { _id: 'banner_default_3', image: '', bg: 'linear-gradient(135deg, #FEF4F0, #FDE0D5)', title: '鸭肉季 清爽上线', subtitle: '半片鸭低至¥12.8/斤' }
    ],

    // 右侧 scroll-into-view
    scrollToSection: '',

    // 购物车
    cartCount: 0,
    cartTotalDisplay: '0.00',

    // 搜索
    showSearch: false,
    searchKeyword: '',
    searchResults: [],
    searchHistory: [],
    searchHasNoResult: false
  },

  onLoad() {
    this.loadCategories();
    this.loadBanners();
  },

  onShow() {
    this.loadCartInfo();
  },

  onReady() {
    setTimeout(() => {
      this.calcSectionOffsets();
    }, 500);
  },

  // ========== 下拉刷新 ==========
  onPullDownRefresh() {
    this.setData({ loading: true, loadError: false, errorMsg: '' });
    this.loadCategories().finally(() => wx.stopPullDownRefresh());
  },

  // ========== 重新加载 ==========
  reload() {
    this.setData({ loading: true, loadError: false, errorMsg: '' });
    this.loadCategories();
  },

  // ========== 购物车信息 ==========
  loadCartInfo() {
    const cart = wx.getStorageSync('cart') || [];
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    this.setData({
      cartCount: count,
      cartTotalDisplay: formatMoney(total)
    });
  },

  // ========== 加载广告 Banner ==========
  async loadBanners() {
    try {
      const res = await api.get('/store/banners');
      if (res && res.success && res.data) {
        const banners = res.data.banners || [];
        if (banners.length > 0) {
          const bannerList = banners.map(b => ({
            _id: b._id,
            image: b.image || '',
            bg: b.bg || '#FFF9ED',
            title: b.title || '',
            subtitle: b.subtitle || ''
          }));
          this.setData({ bannerList });
        }
      }
    } catch (err) {
      console.error('加载Banner失败:', err);
      // 静默失败，使用默认 bannerList
    }
  },

  // ========== 加载分类 ==========
  async loadCategories() {
    try {
      const res = await api.get('/categories');
      const categories = (res && res.data && res.data.categories) || [];
      if (categories.length > 0) {
        this.setData({
          categories,
          activeCategoryId: categories[0]._id,
          loadError: false,
          errorMsg: ''
        });
        this.loadAllProducts();
      } else {
        this.setData({ loading: false, loadError: false });
      }
    } catch (err) {
      console.error('加载分类失败:', err);
      this.setData({
        loading: false,
        loadError: true,
        errorMsg: '加载失败，请检查网络后重试'
      });
    }
  },

  // ========== 加载全部商品 ==========
  async loadAllProducts() {
    try {
      const res = await api.get('/products', { pageSize: 50 });
      const products = ((res && res.data && res.data.products) || []).map(p => ({
        ...p,
        priceLabel: getPriceLabel(p),
        displayPrice: getDisplayPrice(p),
        sellingPoint: p.selling_point || p.description || '',
        salesTag: getSalesTag(p),
        specSummary: getSpecSummary(p)
      }));
      this.setData({ allProducts: products, loading: false, loadError: false });
      this.buildGroupedProducts(products);
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({
        loading: false,
        loadError: true,
        errorMsg: '商品加载失败，请下拉刷新重试'
      });
    }
  },

  buildGroupedProducts(products) {
    const { categories } = this.data;
    const grouped = categories.map(cat => {
      let items;
      if (cat._id === 'cat_00') {
        items = [];
        const seen = new Set();
        for (const p of products) {
          if (!seen.has(p.categoryId) && p.categoryId !== 'cat_00') {
            seen.add(p.categoryId);
            const catProducts = products.filter(x => x.categoryId === p.categoryId).slice(0, 2);
            items.push(...catProducts);
          }
        }
      } else {
        items = products.filter(p => p.categoryId === cat._id);
      }
      return { categoryId: cat._id, categoryName: cat.name, products: items };
    }).filter(g => g.products.length > 0);

    this.setData({ groupedProducts: grouped });
  },

  // ========== 左侧分类点击 ==========
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.activeCategoryId) return;
    this.setData({
      activeCategoryId: id,
      scrollToSection: 's-' + id
    });
  },

  // ========== 右侧滚动 ==========
  onRightScroll(e) {
    const scrollTop = e.detail.scrollTop;
    if (this._scrollTimer) return;
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      this.detectActiveCategory(scrollTop);
    }, 100);
  },

  detectActiveCategory(scrollTop) {
    if (!this._sectionOffsets || this._sectionOffsets.length === 0) return;
    let activeId = this.data.activeCategoryId;
    for (let i = this._sectionOffsets.length - 1; i >= 0; i--) {
      const offset = this._sectionOffsets[i];
      if (scrollTop >= offset.top - 10) {
        activeId = offset.id;
        break;
      }
    }
    if (activeId !== this.data.activeCategoryId) {
      this.setData({ activeCategoryId: activeId });
    }
  },

  // ========== 计算 section 偏移量 ==========
  calcSectionOffsets() {
    const query = wx.createSelectorQuery();
    query.selectAll('.section-wrap').boundingClientRect();
    query.select('.right-scroll').boundingClientRect();
    query.exec(res => {
      if (!res || !res[0] || !res[1]) return;
      const sections = res[0];
      const scrollView = res[1];
      this._sectionOffsets = sections.map(s => ({
        id: s.id.replace('s-', ''),
        top: s.top - scrollView.top
      }));
    });
  },

  // ========== 商品点击 ==========
  onProductTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/goods/detail/detail?id=' + id });
  },

  // ========== 搜索 ==========
  onSearchTap() {
    const history = wx.getStorageSync('search_history') || [];
    this.setData({
      showSearch: true,
      searchKeyword: '',
      searchResults: [],
      searchHistory: history.slice(0, 10),
      searchHasNoResult: false
    });
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });

    if (!keyword) {
      this.setData({ searchResults: [], searchHasNoResult: false });
      return;
    }

    const lower = keyword.toLowerCase();
    const results = this.data.allProducts.filter(p => {
      if (p.out_of_stock) return false;
      return (p.name && p.name.toLowerCase().includes(lower)) ||
             (p.sellingPoint && p.sellingPoint.toLowerCase().includes(lower)) ||
             (p.description && p.description.toLowerCase().includes(lower));
    });

    this.setData({
      searchResults: results,
      searchHasNoResult: results.length === 0
    });
  },

  onSearchClear() {
    this.setData({ searchKeyword: '', searchResults: [], searchHasNoResult: false });
  },

  onSearchCancel() {
    this.setData({ showSearch: false, searchKeyword: '', searchResults: [], searchHasNoResult: false });
  },

  onSearchConfirm() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) return;

    let history = wx.getStorageSync('search_history') || [];
    history = history.filter(h => h !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10);
    wx.setStorageSync('search_history', history);
    this.setData({ searchHistory: history });

    if (this.data.searchResults.length === 0) {
      this.onSearchInput({ detail: { value: keyword } });
    }
  },

  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ searchKeyword: keyword });
    this.onSearchInput({ detail: { value: keyword } });
    this.onSearchConfirm();
  },

  onClearHistory() {
    wx.showModal({
      title: '清除历史',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('search_history');
          this.setData({ searchHistory: [] });
        }
      }
    });
  },

  onSearchResultTap(e) {
    const id = e.currentTarget.dataset.id;
    this.onSearchCancel();
    wx.navigateTo({ url: '/pages/goods/detail/detail?id=' + id });
  },

  // ========== 购物车 ==========
  onCartTap() {
    wx.redirectTo({ url: '/pages/cart/cart' });
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/' + key + '/' + key });
  }
});

// ========== 辅助函数 ==========
function getPriceLabel(product) {
  const unit = getPricingUnit(product.pricing_type);
  if (product.pricing_type === 'range_weight') return unit + '起';
  return unit;
}

function getDisplayPrice(product) {
  if (product.pricing_type === 'range_weight') {
    const specs = product.specs || [];
    let minPrice = Infinity;
    for (const s of specs) {
      if (s.price_per_jin && s.price_per_jin < minPrice) {
        minPrice = s.price_per_jin;
      }
    }
    if (minPrice < Infinity) return (minPrice / 100).toFixed(2);
  }
  if (product.pricing_type === 'exact_weight' && product.price_per_jin) {
    return (product.price_per_jin / 100).toFixed(2);
  }
  if (product.pricing_type === 'per_piece' && product.unit_price) {
    return (product.unit_price / 100).toFixed(2);
  }
  if (product.minPrice) {
    return (Number(product.minPrice) / 100).toFixed(2);
  }
  return '0.00';
}

function getSalesTag(product) {
  const sales = product.sales || 0;
  if (sales >= 2000) return '热销爆款';
  if (sales >= 1000) return '销量飙升';
  return '已售 ' + sales + ' 份';
}

function getSpecSummary(product) {
  if (product.pricing_type === 'range_weight') {
    const specs = product.specs || [];
    if (specs.length === 0) return '称重计价 · 多规格可选';
    const typeSet = [];
    const seenTypes = new Set();
    for (const s of specs) {
      let short = (s.type || '').replace('称重', '');
      if (short && !seenTypes.has(short)) {
        seenTypes.add(short);
        typeSet.push(short);
      }
    }
    let minJin = Infinity, maxJin = 0;
    for (const s of specs) {
      const label = s.weight_label || '';
      const parts = label.split('-');
      if (parts.length === 2) {
        const lo = parseFloat(parts[0]);
        const hi = parseFloat(parts[1]);
        if (!isNaN(lo) && lo < minJin) minJin = lo;
        if (!isNaN(hi) && hi > maxJin) maxJin = hi;
      }
    }
    const typeStr = typeSet.join('/');
    const weightStr = minJin < Infinity ? (minJin + '-' + maxJin + '斤') : '多规格';
    return typeStr + ' · ' + weightStr;
  }
  if (product.pricing_type === 'exact_weight') {
    const priceFen = product.price_per_jin;
    const opts = product.weight_options || [];
    if (priceFen) {
      const priceYuan = formatMoney(priceFen);
      if (opts.length > 0) {
        return '¥' + priceYuan + '/斤 · ' + opts.map(w => (w >= 500 ? (w / 500) + '斤' : w + 'g')).join('/') + '可选';
      }
      return '¥' + priceYuan + '/斤';
    }
    return '按斤计价';
  }
  if (product.pricing_type === 'per_piece') {
    const priceFen = product.unit_price;
    if (priceFen) {
      return '¥' + formatMoney(priceFen) + '/只';
    }
    return '按只计价';
  }
  return '';
}
