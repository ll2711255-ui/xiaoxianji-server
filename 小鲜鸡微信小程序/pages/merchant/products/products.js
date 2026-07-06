const api = require('../../../utils/api');
const { getPricingLabel, getPricingUnit } = require('../../../utils/util');
const auth = require('../../../utils/auth');

Page({
  data: {
    categories: [],
    activeCat: '',
    products: [],
    loading: false,

    // 搜索
    showSearch: false,
    searchKeyword: '',
    filteredProducts: [],

    // 分类排序
    sortMode: false,
    sortedCategories: [],

    // 广告管理
    bannerMode: false,
    banners: [],
    editingBannerIndex: -1
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.loadCategories();
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/merchant/' + key + '/' + key });
  },

  async loadCategories() {
    try {
      const res = await api.get('/categories');
      const categories = (res && res.data && res.data.categories) || [];
      const isFirstLoad = this.data.categories.length === 0;
      const prevActive = this.data.activeCat;
      const catStillExists = !isFirstLoad && (
        prevActive === '' || categories.some(c => c._id === prevActive)
      );
      const activeCat = isFirstLoad
        ? (categories.length > 0 ? categories[0]._id : '')
        : (catStillExists ? prevActive : (categories.length > 0 ? categories[0]._id : ''));

      if (this.data.sortMode) {
        this.setData({ categories, activeCat });
      } else {
        this.setData({ categories, activeCat, sortedCategories: categories });
      }
      this.loadProducts();
    } catch (err) {
      console.error('加载分类失败:', err);
      if (this.data.categories.length === 0) {
        this.loadProducts();
      }
    }
  },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const params = { pageSize: 50, status: 'all' };
      if (this.data.activeCat) params.categoryId = this.data.activeCat;

      const res = await api.get('/products', params);
      const products = ((res && res.data && res.data.products) || []).map(p => ({
        ...p,
        pricingLabel: getPricingLabel(p),
        priceUnit: getPricingUnit(p)
      }));
      this.setData({ products, loading: false, filteredProducts: products });
      if (this.data.showSearch) {
        this.applySearchFilter();
      }
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ loading: false });
    }
  },

  onCatTap(e) {
    if (this.data.sortMode) return;
    const id = e.currentTarget.dataset.id;
    if (id === this.data.activeCat) {
      this.setData({ activeCat: '' });
    } else {
      this.setData({ activeCat: id });
    }
    this.loadProducts();
  },

  /**
   * 长按分类 → 删除
   */
  onCatLongPress(e) {
    if (this.data.sortMode) return;
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    if (!id) return;

    wx.showModal({
      title: '删除分类',
      content: `确定要删除分类「${name}」吗？\n\n删除后不可恢复。如果分类下有商品，需要先将商品移走。`,
      confirmText: '删除',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          const result = await api.del('/categories/' + id);
          wx.hideLoading();
          if (result && result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            if (this.data.activeCat === id) {
              this.setData({ activeCat: '' });
            }
            this.loadCategories();
          } else {
            wx.showToast({ title: (result && result.message) || '删除失败', icon: 'none', duration: 2500 });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('删除分类失败:', err);
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
        }
      }
    });
  },

  // ========== 分类排序 ==========

  onToggleSortMode() {
    const enter = !this.data.sortMode;
    if (enter) {
      this.setData({ sortMode: true, sortedCategories: [...this.data.categories] });
    } else {
      this.setData({ sortMode: false });
    }
  },

  onCatMoveUp(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx <= 0) return;
    const list = [...this.data.sortedCategories];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    this.setData({ sortedCategories: list });
  },

  onCatMoveDown(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.sortedCategories;
    if (idx >= list.length - 1) return;
    const copy = [...list];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    this.setData({ sortedCategories: copy });
  },

  async onSaveSort() {
    const list = this.data.sortedCategories;
    if (!list || list.length === 0) {
      wx.showToast({ title: '没有可保存的分类', icon: 'none' });
      return;
    }
    const sorts = list.map(({ _id }, i) => ({ _id, sort: i + 1 }));
    try {
      wx.showLoading({ title: '保存中...' });
      const res = await api.put('/categories/sort', { sorts });
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '排序已保存', icon: 'success' });
        this.setData({ categories: list, sortMode: false, sortedCategories: [] });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存排序失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  // ========== 首页广告管理 ==========

  async onToggleBannerMode() {
    const enter = !this.data.bannerMode;
    if (enter) {
      if (this.data.sortMode) {
        this.setData({ sortMode: false, sortedCategories: [] });
      }
      this.setData({ bannerMode: true });
      await this.loadBanners();
    } else {
      this.setData({ bannerMode: false, editingBannerIndex: -1 });
    }
  },

  async loadBanners() {
    try {
      const res = await api.get('/store/banners');
      this.setData({ banners: (res && res.data && res.data.banners) || [] });
    } catch (err) {
      console.error('加载广告失败:', err);
    }
  },

  onAddBanner() {
    const banners = [...this.data.banners];
    const newBanner = {
      _id: 'banner_new_' + Date.now(),
      image: '',
      title: '',
      subtitle: '',
      bg: '#FFF8F5',
      sort: banners.length + 1,
      status: 'on',
      merchantId: ''
    };
    banners.push(newBanner);
    this.setData({ banners, editingBannerIndex: banners.length - 1 });
  },

  onEditBanner(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.editingBannerIndex) {
      this.setData({ editingBannerIndex: -1 });
    } else {
      this.setData({ editingBannerIndex: index });
    }
  },

  onDelBanner(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    wx.showModal({
      title: '删除广告',
      content: '确定要删除该广告吗？',
      success: (res) => {
        if (!res.confirm) return;
        const banners = [...this.data.banners];
        banners.splice(index, 1);
        this.setData({ banners, editingBannerIndex: -1 });
      }
    });
  },

  onBannerMoveUp(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    if (idx <= 0) return;
    const list = [...this.data.banners];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    list.forEach((b, i) => { b.sort = i + 1; });
    this.setData({ banners: list, editingBannerIndex: idx - 1 });
  },

  onBannerMoveDown(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const list = this.data.banners;
    if (idx >= list.length - 1) return;
    const copy = [...list];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    copy.forEach((b, i) => { b.sort = i + 1; });
    this.setData({ banners: copy, editingBannerIndex: idx + 1 });
  },

  onBannerInput(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const banners = [...this.data.banners];
    if (banners[index]) {
      banners[index][field] = value;
      this.setData({ banners });
    }
  },

  onBannerToggleStatus(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const banners = [...this.data.banners];
    if (banners[index]) {
      banners[index].status = banners[index].status === 'on' ? 'off' : 'on';
      this.setData({ banners });
    }
  },

  onBannerImageUpload(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths[0];
        const app = getApp();
        const useMock = app && app.globalData && app.globalData.useMock;

        if (useMock) {
          const banners = [...this.data.banners];
          if (banners[index]) {
            banners[index].image = tempPath;
            this.setData({ banners });
          }
          return;
        }

        // 上传到自建后端
        wx.showLoading({ title: '上传中...' });
        try {
          const url = await api.upload('/upload/image', tempPath);
          wx.hideLoading();
          const banners = [...this.data.banners];
          if (banners[index]) {
            banners[index].image = url || tempPath;
            this.setData({ banners });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('上传失败:', err);
          wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        }
      }
    });
  },

  async onSaveBanners() {
    const banners = this.data.banners;
    const emptyBanner = banners.find(b => !(b.title || '').trim());
    if (emptyBanner) {
      wx.showToast({ title: '请填写所有广告的标题', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '保存中...' });
      const res = await api.put('/store/banners', { banners });
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '广告已保存', icon: 'success' });
        this.setData({ bannerMode: false, editingBannerIndex: -1 });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存广告失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  onToggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const newStatus = e.detail.value ? 'on' : 'off';
    const label = newStatus === 'on' ? '上架' : '下架';

    wx.showModal({
      title: `确认${label}`,
      content: `确定要${label}该商品吗？`,
      success: async (res) => {
        if (!res.confirm) {
          this.loadProducts();
          return;
        }
        try {
          await api.patch('/products/' + id + '/status', { status: newStatus });
          wx.showToast({ title: `已${label}`, icon: 'success' });
          this.loadProducts();
        } catch (err) {
          console.error('更新状态失败:', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
          this.loadProducts();
        }
      }
    });
  },

  onToggleOutOfStock(e) {
    const id = e.currentTarget.dataset.id;
    const newVal = e.detail.value;

    wx.showModal({
      title: newVal ? '标记为缺货' : '取消缺货标记',
      content: newVal ? '标记缺货后，用户端仍展示该商品但不可加购。确定吗？' : '确定取消缺货标记，恢复购买吗？',
      success: async (res) => {
        if (!res.confirm) {
          this.loadProducts();
          return;
        }
        try {
          await api.patch('/products/' + id + '/status', { outOfStock: newVal });
          wx.showToast({ title: newVal ? '已标记缺货' : '已取消缺货', icon: 'success' });
          this.loadProducts();
        } catch (err) {
          console.error('更新缺货状态失败:', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
          this.loadProducts();
        }
      }
    });
  },

  onEditProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/merchant/products/edit/edit?id=${id}` });
  },

  onAddProduct() {
    wx.navigateTo({ url: '/pages/merchant/products/edit/edit' });
  },

  // ========== 搜索 ==========
  onSearch() {
    this.setData({ showSearch: true, searchKeyword: '' });
    this.applySearchFilter();
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });
    this.applySearchFilter();
  },

  onSearchCancel() {
    this.setData({ showSearch: false, searchKeyword: '' });
    this.loadProducts();
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' });
    this.applySearchFilter();
  },

  applySearchFilter() {
    const keyword = this.data.searchKeyword.toLowerCase();
    const source = this.data.products;
    if (!keyword) {
      this.setData({ filteredProducts: source });
      return;
    }
    const filtered = source.filter(p => {
      return (p.name && p.name.toLowerCase().includes(keyword)) ||
             (p.selling_point && p.selling_point.toLowerCase().includes(keyword)) ||
             (p.description && p.description.toLowerCase().includes(keyword));
    });
    this.setData({ filteredProducts: filtered });
  }
});
