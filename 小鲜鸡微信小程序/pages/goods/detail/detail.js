const api = require('../../../utils/api');
const { formatMoney } = require('../../../utils/util');

const CATEGORY_EMOJI = {
  '整鸡': '🐔', '鸡腿': '🍗', '鸡翅': '🍖', '鸡胸': '🍗',
  '内脏': '🫀', '鸽子': '🕊'
};

Page({
  data: {
    product: null,
    images: [],
    pricingType: '',
    loading: true,

    // 展示字段（JS 预处理）
    displayPriceStr: '0.00',
    priceLabel: '',
    salesDisplay: '',
    categoryEmoji: '🐔',
    productName: '',

    // 规格一：鸡肉类型（range_weight）
    typeOptions: [],
    selectedType: '',

    // 规格二：重量
    weightOptions: [],
    selectedWeight: null,

    // 规格三：处理方式
    processingOptions: [],
    selectedProcessing: '',

    // 规格四：取货方式
    deliveryOptions: [],
    selectedDelivery: '',

    // 当前价格
    currentPrice: 0,

    // 数量（per_piece）
    quantity: 1,

    // 整鸡完整规格表（range_weight 用）
    allSpecs: null,

    // 规格二动态标签（range_weight）— 随规格一变化
    weightSpecLabel: '整鸡',

    // 备注
    remark: ''
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.loadProduct(id);
  },

  async loadProduct(id) {
    try {
      const res = await api.get('/products/' + id);
      if (!res || !res.success) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }
      const product = res.data && res.data.product;
      if (!product) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }

      const pricingType = product.pricing_type;
      const categoryEmoji = CATEGORY_EMOJI[product.category] || '🐔';

      // 取货方式选项
      const deliveryModes = product.delivery_modes || ['delivery', 'pickup'];
      const deliveryOptions = deliveryModes.map(m => {
        if (m === 'delivery') return { label: '外卖配送', value: 'delivery' };
        if (m === 'pickup') return { label: '到店自取', value: 'pickup' };
        if (m === 'scheduled') return { label: '预约配送', value: 'scheduled' };
        return { label: m, value: m };
      });
      const defaultDelivery = deliveryOptions.length > 0 ? deliveryOptions[0].value : '';

      // 处理方式选项
      const procOpts = (product.processing_options || ['整只', '切块']).map(p => ({
        label: p,
        value: p
      }));
      const defaultProc = procOpts.length > 0 ? procOpts[0].value : '';

      this.setData({
        product,
        images: product.images || [],
        pricingType,
        categoryEmoji,
        productName: product.name,
        salesDisplay: (product.sales || 0) + '',
        processingOptions: procOpts,
        selectedProcessing: defaultProc,
        deliveryOptions,
        selectedDelivery: defaultDelivery,
        loading: false
      });

      this.initSpecsByType(product, pricingType, procOpts, deliveryOptions, defaultProc, defaultDelivery);
    } catch (err) {
      console.error('加载商品详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  initSpecsByType(product, pricingType, procOpts, deliveryOptions, defaultProc, defaultDelivery) {
    if (pricingType === 'range_weight') {
      this.initRangeWeightSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery);
    } else if (pricingType === 'exact_weight') {
      this.initExactWeightSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery);
    } else if (pricingType === 'per_piece') {
      this.initPerPieceSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery);
    }
  },

  // ========== 整鸡规格初始化 ==========
  initRangeWeightSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery) {
    const specs = product.specs || [];
    const allSpecs = specs;

    const typeSet = [...new Set(specs.map(s => s.type))];
    const typeOptions = typeSet.map(t => {
      const first = specs.find(s => s.type === t);
      const ppj = first ? first.price_per_jin : 0;
      return { label: t, value: t, pricePerJin: ppj, pricePerJinDisplay: formatMoney(ppj) };
    });
    const defaultType = typeOptions.length > 0 ? typeOptions[0].value : '';

    const weightOpts = this.getWeightOptionsForType(allSpecs, defaultType);
    const defaultWeight = weightOpts.length > 0 ? weightOpts[0] : null;

    const initPrice = this.computeRangePrice(allSpecs, defaultType, defaultWeight, defaultProc);

    this.setData({
      allSpecs,
      typeOptions,
      selectedType: defaultType,
      weightOptions: weightOpts,
      selectedWeight: defaultWeight,
      displayPriceStr: formatMoney(initPrice),
      priceLabel: '预估价',
      currentPrice: initPrice,
      weightSpecLabel: this.getWeightSpecLabel(defaultType)
    });
  },

  getWeightSpecLabel(type) {
    const map = { '毛鸡称重': '整鸡', '光鸡称重': '整鸡', '鲜肉鸡称重': '半边鸡' };
    return map[type] || '整鸡';
  },

  // ========== 精确重量规格初始化 ==========
  initExactWeightSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery) {
    const gramsList = product.weight_options || [500];
    const weightOptions = gramsList.map(g => {
      const jin = g / 500;
      const jinDisplay = jin % 1 === 0 ? jin : jin.toFixed(1);
      return { label: jinDisplay + '斤（' + g + 'g）', value: g, grams: g };
    });
    const defaultWeight = weightOptions.length > 0 ? weightOptions[0] : null;

    const initPrice = this.computeExactPrice(product, defaultWeight, defaultProc);

    this.setData({
      weightOptions,
      selectedWeight: defaultWeight,
      displayPriceStr: formatMoney(initPrice),
      priceLabel: '/份',
      currentPrice: initPrice
    });
  },

  // ========== 按只计价规格初始化 ==========
  initPerPieceSpecs(product, procOpts, deliveryOptions, defaultProc, defaultDelivery) {
    const unitPrice = product.unit_price || 25;
    const initPrice = this.computePiecePrice(product, defaultProc);

    this.setData({
      weightOptions: [{ label: formatMoney(unitPrice) + '元/只', value: 'per_piece', unitPrice }],
      selectedWeight: { label: formatMoney(unitPrice) + '元/只', value: 'per_piece', unitPrice },
      displayPriceStr: formatMoney(initPrice),
      priceLabel: '/只',
      currentPrice: initPrice
    });
  },

  getWeightOptionsForType(allSpecs, type) {
    const filtered = allSpecs.filter(s => s.type === type);
    const weightSet = [...new Set(filtered.map(s => s.weight_label))];
    return weightSet.map(w => {
      const match = filtered.find(s => s.weight_label === w);
      return { label: w, value: w, weight_max: match ? match.weight_max : 0 };
    });
  },

  computeRangePrice(allSpecs, type, weight, processing) {
    if (!allSpecs || !type || !weight || !processing) return 0;
    const match = allSpecs.find(s =>
      s.type === type &&
      s.weight_label === weight.value &&
      s.processing === processing
    );
    if (!match) return 0;
    const jin = (match.weight_max || 0) / 500;
    return Math.round(match.price_per_jin * jin);
  },

  computeExactPrice(product, weight, processing) {
    if (!product || !weight) return 0;
    const jin = weight.grams / 500;
    let price = product.price_per_jin * jin;
    if (processing === '切块' && product.processing_fee) {
      price += product.processing_fee;
    }
    return Math.round(price);
  },

  computePiecePrice(product, processing) {
    if (!product) return 0;
    const unitPrice = product.unit_price || 25;
    let price = unitPrice;
    if (processing === '切块' && product.processing_fee) {
      price += product.processing_fee;
    }
    return Math.round(price);
  },

  onSelectType(e) {
    const val = e.currentTarget.dataset.value;
    const { allSpecs, selectedWeight, selectedProcessing } = this.data;

    const weightOptions = this.getWeightOptionsForType(allSpecs, val);
    let newWeight = selectedWeight;
    if (!weightOptions.find(w => w.value === (selectedWeight && selectedWeight.value))) {
      newWeight = weightOptions.length > 0 ? weightOptions[0] : null;
    }

    const price = this.computeRangePrice(allSpecs, val, newWeight, selectedProcessing);

    this.setData({
      selectedType: val,
      weightOptions,
      selectedWeight: newWeight,
      currentPrice: price,
      displayPriceStr: formatMoney(price * this.data.quantity),
      weightSpecLabel: this.getWeightSpecLabel(val)
    });
  },

  onSelectWeight(e) {
    const val = e.currentTarget.dataset.value;
    const option = this.data.weightOptions.find(o => o.value === val);
    if (!option) return;

    this.setData({ selectedWeight: option });
    this.recalcPrice();
  },

  onSelectProcessing(e) {
    const val = e.currentTarget.dataset.value;
    this.setData({ selectedProcessing: val });
    this.recalcPrice();
  },

  onSelectDelivery(e) {
    this.setData({ selectedDelivery: e.currentTarget.dataset.value });
  },

  onInputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  recalcPrice() {
    const { pricingType, product, allSpecs, selectedType, selectedWeight, selectedProcessing, quantity } = this.data;
    let price = 0;

    if (pricingType === 'range_weight') {
      price = this.computeRangePrice(allSpecs, selectedType, selectedWeight, selectedProcessing);
    } else if (pricingType === 'exact_weight') {
      price = this.computeExactPrice(product, selectedWeight, selectedProcessing);
    } else if (pricingType === 'per_piece') {
      price = this.computePiecePrice(product, selectedProcessing);
    }

    this.setData({
      currentPrice: price,
      displayPriceStr: formatMoney(price * quantity)
    });
  },

  onQuantityMinus() {
    if (this.data.quantity <= 1) return;
    this.setData({ quantity: this.data.quantity - 1 });
    this.recalcPrice();
  },

  onQuantityPlus() {
    if (this.data.quantity >= 99) return;
    this.setData({ quantity: this.data.quantity + 1 });
    this.recalcPrice();
  },

  onPreviewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({ urls: this.data.images, current: src });
  },

  onAddToCart() {
    if (this.data.product && this.data.product.out_of_stock) {
      wx.showToast({ title: '该商品暂时缺货', icon: 'none' });
      return;
    }
    if (!this.validateSelection()) return;

    const cart = wx.getStorageSync('cart') || [];
    const item = this.buildCartItem();

    const existIndex = cart.findIndex(c => c.cartKey === item.cartKey);
    if (existIndex >= 0) {
      cart[existIndex].quantity += item.quantity;
      cart[existIndex].checked = true;
    } else {
      cart.push(item);
    }

    wx.setStorageSync('cart', cart);
    const app = getApp();
    app.globalData.cartVersion = Date.now();

    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  onBuyNow() {
    if (this.data.product && this.data.product.out_of_stock) {
      wx.showToast({ title: '该商品暂时缺货', icon: 'none' });
      return;
    }
    if (!this.validateSelection()) return;

    const item = this.buildCartItem();
    wx.setStorageSync('buyNow', [item]);
    wx.navigateTo({ url: '/pages/checkout/checkout?from=buyNow' });
  },

  validateSelection() {
    const { pricingType, selectedType, selectedWeight, selectedProcessing, selectedDelivery } = this.data;

    if (pricingType === 'range_weight' && !selectedType) {
      wx.showToast({ title: '请选择鸡肉类型', icon: 'none' });
      return false;
    }
    if (!selectedWeight) {
      wx.showToast({ title: '请选择重量', icon: 'none' });
      return false;
    }
    if (!selectedProcessing) {
      wx.showToast({ title: '请选择处理方式', icon: 'none' });
      return false;
    }
    if (!selectedDelivery) {
      wx.showToast({ title: '请选择取货方式', icon: 'none' });
      return false;
    }
    return true;
  },

  buildCartItem() {
    const { product, pricingType, selectedType, selectedWeight, selectedProcessing, selectedDelivery, currentPrice, quantity, categoryEmoji, remark } = this.data;

    const spec = {};
    if (pricingType === 'range_weight') {
      spec.type = selectedType;
    }
    spec.weight = selectedWeight ? selectedWeight.label : '';
    if (selectedWeight) {
      if (selectedWeight.grams !== undefined) spec.weightGrams = selectedWeight.grams;
      if (selectedWeight.value !== undefined) spec.weightValue = selectedWeight.value;
      if (selectedWeight.weight_max !== undefined) spec.weight_max = selectedWeight.weight_max;
    }
    spec.processing = selectedProcessing;
    spec.delivery = selectedDelivery;

    const cartKey = `${product._id}_${spec.type || ''}_${spec.weight}_${spec.processing}_${spec.delivery}`;

    return {
      cartKey,
      productId: product._id,
      productName: product.name,
      image: product.images && product.images.length > 0 ? product.images[0] : '',
      pricingType,
      spec,
      price: currentPrice,
      quantity,
      emoji: categoryEmoji,
      remark
    };
  }
});
