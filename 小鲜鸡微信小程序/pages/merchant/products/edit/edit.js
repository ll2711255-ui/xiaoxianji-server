const api = require('../../../../utils/api');
const auth = require('../../../../utils/auth');

const PRICING_TYPES = [
  { label: '按斤范围计价（整鸡）', value: 'range_weight' },
  { label: '按斤计价（鸡腿/鸡翅等）', value: 'exact_weight' },
  { label: '按只计价（鸽子）', value: 'per_piece' }
];

const DELIVERY_MODE_OPTIONS = [
  { label: '外卖配送', value: 'delivery' },
  { label: '到店自取', value: 'pickup' }
];

Page({
  data: {
    isEdit: false,
    productId: '',
    categories: [],
    categoryNames: [],
    categoryIndex: 0,

    pricingTypes: PRICING_TYPES.map(t => t.label),
    pricingIndex: 1,
    pricingType: 'exact_weight',

    name: '',
    sellingPoint: '',
    description: '',

    pricePerJin: '',
    weightOptionsList: [{ idx: 1, grams: 500, jinDisplay: '1斤' }, { idx: 2, grams: 1000, jinDisplay: '2斤' }, { idx: 3, grams: 1500, jinDisplay: '3斤' }],
    weightOptionSeq: 3,
    processingFee: '0',
    unitPrice: '',

    procOptions: [
      { label: '整只', checked: true },
      { label: '切块', checked: true }
    ],
    showAddProc: false,
    newProcName: '',

    deliveryModes: DELIVERY_MODE_OPTIONS.map(d => ({ ...d, checked: true })),

    images: [],

    saving: false,

    showAddCat: false,
    newCatName: '',

    // 整鸡规格编辑（range_weight）
    typeConfigs: [],
    typeConfigSeq: 0,
    specsPreviewCount: 0,
    procOptCount: 2
  },

  async onLoad(options) {
    if (!auth.checkMerchant()) return;

    const id = options.id;
    if (id) {
      this.setData({ isEdit: true, productId: id });
      wx.setNavigationBarTitle({ title: '编辑商品' });
    } else {
      wx.setNavigationBarTitle({ title: '新增商品' });
    }
    await this.loadCategories();
    if (id) {
      this.loadProduct(id);
    }
  },

  async loadCategories() {
    try {
      const res = await api.get('/categories');
      const categories = (res && res.data && res.data.categories) || [];
      this.setData({
        categories,
        categoryNames: categories.map(c => c.name)
      });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  async loadProduct(id) {
    try {
      const res = await api.get('/products/' + id);
      if (!res || !res.success) return;
      const p = res.data && res.data.product;
      if (!p) return;

      const pricingIndex = PRICING_TYPES.findIndex(t => t.value === p.pricing_type);
      const catIndex = (this.data.categories || []).findIndex(c => c._id === p.categoryId);

      const data = {
        pricingIndex: pricingIndex >= 0 ? pricingIndex : 1,
        pricingType: p.pricing_type || 'exact_weight',
        categoryIndex: catIndex >= 0 ? catIndex : 0,
        name: p.name || '',
        sellingPoint: p.selling_point || '',
        description: p.description || '',
        images: p.images || []
      };

      if (p.pricing_type === 'exact_weight') {
        data.pricePerJin = String(p.price_per_jin || '');
        const gramsArr = p.weight_options || [500, 1000];
        data.weightOptionsList = gramsArr.map((g, i) => ({ idx: i + 1, grams: g, jinDisplay: this.formatJinDisplay(g) }));
        data.weightOptionSeq = gramsArr.length;
        data.processingFee = String(p.processing_fee || 0);
        data.procOptions = this.buildProcOptions(p.processing_options || ['整只', '切块']);
      } else if (p.pricing_type === 'per_piece') {
        data.unitPrice = String(p.unit_price || '');
        data.processingFee = String(p.processing_fee || 0);
        data.procOptions = this.buildProcOptions(p.processing_options || ['整只', '切块']);
      } else if (p.pricing_type === 'range_weight') {
        const configs = this.parseSpecsToConfigs(p.specs || []);
        data.typeConfigs = configs.typeConfigs;
        data.typeConfigSeq = configs.typeConfigs.length;
        data.procOptions = this.buildProcOptions(configs.processingOptions);
      }

      if (p.delivery_modes) {
        const modes = p.delivery_modes;
        data.deliveryModes = DELIVERY_MODE_OPTIONS.map(d => ({
          ...d,
          checked: modes.includes(d.value)
        }));
      }

      this.setData(data);
    } catch (err) {
      console.error('加载商品失败:', err);
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({ [field]: e.detail.value });
    }
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: parseInt(e.detail.value) });
  },

  onPricingChange(e) {
    const idx = parseInt(e.detail.value);
    const newType = PRICING_TYPES[idx].value;
    const data = {
      pricingIndex: idx,
      pricingType: newType
    };
    if (newType === 'range_weight') {
      if (this.data.typeConfigs.length === 0) {
        data.typeConfigs = [
          { idx: 1, type: '毛鸡称重', price_per_jin: 1700, weightConfigs: [
            { idx: 1, weight_label: '3.0-3.5斤', weight_max: 1750 },
            { idx: 2, weight_label: '3.5-4.0斤', weight_max: 2000 },
            { idx: 3, weight_label: '4.0-4.5斤', weight_max: 2250 }
          ], weightConfigSeq: 3 },
          { idx: 2, type: '光鸡称重', price_per_jin: 1800, weightConfigs: [
            { idx: 1, weight_label: '2.5-3.0斤', weight_max: 1500 },
            { idx: 2, weight_label: '3.0-3.5斤', weight_max: 1750 },
            { idx: 3, weight_label: '3.5-4.0斤', weight_max: 2000 }
          ], weightConfigSeq: 3 }
        ];
        data.typeConfigSeq = 2;
      }
    } else if (newType === 'exact_weight') {
      if (!this.data.weightOptionsList || this.data.weightOptionsList.length === 0) {
        data.weightOptionsList = [
          { idx: 1, grams: 500, jinDisplay: this.formatJinDisplay(500) },
          { idx: 2, grams: 1000, jinDisplay: this.formatJinDisplay(1000) },
          { idx: 3, grams: 1500, jinDisplay: this.formatJinDisplay(1500) }
        ];
        data.weightOptionSeq = 3;
      }
    }
    this.setData(data, () => this.updateSpecsPreview());
  },

  onDeliveryTap(e) {
    const value = e.currentTarget.dataset.value;
    const modes = this.data.deliveryModes.map(d => {
      if (d.value === value) return { ...d, checked: !d.checked };
      return d;
    });
    this.setData({ deliveryModes: modes });
  },

  onAddImage() {
    wx.chooseImage({
      count: 6 - this.data.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ images: [...this.data.images, ...res.tempFilePaths] });
      }
    });
  },

  onDelImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  async onSave() {
    const { name, categoryIndex, categories, pricingType } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }
    if (categoryIndex < 0 || categoryIndex >= categories.length) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }

    const deliveryModes = this.data.deliveryModes
      .filter(d => d.checked)
      .map(d => d.value);

    if (deliveryModes.length === 0) {
      wx.showToast({ title: '请至少选择一种取货方式', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const payload = {
      productId: this.data.productId,
      categoryId: categories[categoryIndex]._id,
      name: name.trim(),
      pricingType,
      sellingPoint: this.data.sellingPoint.trim(),
      description: this.data.description.trim(),
      deliveryModes,
      images: this.data.images
    };

    const procOpts = this.getCheckedProcOpts();

    if (pricingType === 'exact_weight') {
      payload.pricePerJin = parseInt(this.data.pricePerJin) || 0;
      const weightOpts = (this.data.weightOptionsList || [])
        .map(item => item.grams)
        .filter(g => g > 0);
      if (weightOpts.length === 0) {
        wx.showToast({ title: '请至少添加一个重量选项', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      const emptyItem = this.data.weightOptionsList.find(item => !item.grams || item.grams <= 0);
      if (emptyItem) {
        wx.showToast({ title: '请填写所有重量选项的克重', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      payload.weightOptions = weightOpts;
      payload.processingFee = parseInt(this.data.processingFee) || 0;
      payload.processingOptions = procOpts;
    } else if (pricingType === 'per_piece') {
      payload.unitPrice = parseInt(this.data.unitPrice) || 0;
      payload.processingFee = parseInt(this.data.processingFee) || 0;
      payload.processingOptions = procOpts;
    } else if (pricingType === 'range_weight') {
      if (this.data.typeConfigs.length === 0) {
        wx.showToast({ title: '请至少添加一个称重类型', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      for (const tc of this.data.typeConfigs) {
        if (!tc.weightConfigs || tc.weightConfigs.length === 0) {
          wx.showToast({ title: `「${tc.type || '未命名类型'}」请至少添加一个重量范围`, icon: 'none' });
          this.setData({ saving: false });
          wx.hideLoading();
          return;
        }
      }
      if (procOpts.length === 0) {
        wx.showToast({ title: '请至少勾选一种处理方式', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      const emptyType = this.data.typeConfigs.find(c => !c.type.trim());
      if (emptyType) {
        wx.showToast({ title: '请填写所有称重类型的名称', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      const emptyWeight = this.data.typeConfigs.some(tc =>
        (tc.weightConfigs || []).some(w => !w.weight_label.trim() || !w.weight_max)
      );
      if (emptyWeight) {
        wx.showToast({ title: '请填写所有重量范围的标签和克重', icon: 'none' });
        this.setData({ saving: false });
        wx.hideLoading();
        return;
      }
      payload.specs = this.generateSpecs(this.data.typeConfigs, procOpts);
      payload.processingOptions = procOpts;
    }

    try {
      let res;
      if (this.data.isEdit) {
        res = await api.put('/products/' + this.data.productId, payload);
      } else {
        res = await api.post('/products', payload);
      }
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' });
        this.setData({ saving: false });
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        throw new Error((res && res.message) || '保存失败');
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ saving: false });
      console.error('保存失败:', err);
      wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
    }
  },

  // ========== 添加分类 ==========
  onShowAddCategory() {
    this.setData({ showAddCat: true, newCatName: '' });
  },

  onNewCatInput(e) {
    this.setData({ newCatName: e.detail.value });
  },

  onCancelAddCat() {
    this.setData({ showAddCat: false, newCatName: '' });
  },

  async onConfirmAddCat() {
    const name = this.data.newCatName.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    if (this.data.categoryNames.includes(name)) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '添加中...' });
      const res = await api.post('/categories', { name });
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '分类已添加', icon: 'success' });
        this.setData({ showAddCat: false, newCatName: '' });
        await this.loadCategories();
        const idx = this.data.categoryNames.indexOf(name);
        if (idx >= 0) {
          this.setData({ categoryIndex: idx });
        }
      } else {
        wx.showToast({ title: (res && res.message) || '添加失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('添加分类失败:', err);
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
    }
  },

  onDeleteCategory() {
    const { categories, categoryIndex, isEdit } = this.data;
    const cat = categories[categoryIndex];
    if (!cat) {
      wx.showToast({ title: '请先选择要删除的分类', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '删除分类',
      content: `确定要删除分类「${cat.name}」吗？\n\n删除后不可恢复。如果分类下有商品，需要先将商品移走。`,
      confirmText: '删除',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          const result = await api.del('/categories/' + cat._id);
          wx.hideLoading();
          if (result && result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            await this.loadCategories();
            this.setData({ categoryIndex: 0 });
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

  // ========== 整鸡规格编辑（range_weight）==========

  parseSpecsToConfigs(specs) {
    const typeMap = {};
    const procSet = new Set();
    let typeIdx = 0;

    for (const s of specs) {
      if (!typeMap[s.type]) {
        typeIdx++;
        typeMap[s.type] = { idx: typeIdx, type: s.type, price_per_jin: s.price_per_jin, weightMap: {} };
      }
      const wkey = s.weight_label + '|' + s.weight_max;
      typeMap[s.type].weightMap[wkey] = { weight_label: s.weight_label, weight_max: s.weight_max };
      procSet.add(s.processing);
    }

    const typeConfigs = Object.values(typeMap).map(t => {
      let wi = 0;
      const weightConfigs = Object.values(t.weightMap).map(w => {
        wi++;
        return { idx: wi, weight_label: w.weight_label, weight_max: w.weight_max };
      });
      delete t.weightMap;
      return { ...t, weightConfigs, weightConfigSeq: weightConfigs.length };
    });

    return { typeConfigs, processingOptions: [...procSet] };
  },

  generateSpecs(typeConfigs, procOpts) {
    const specs = [];
    for (const t of typeConfigs) {
      for (const w of (t.weightConfigs || [])) {
        for (const p of procOpts) {
          specs.push({
            type: t.type,
            weight_label: w.weight_label,
            weight_max: w.weight_max,
            price_per_jin: t.price_per_jin,
            processing: p
          });
        }
      }
    }
    return specs;
  },

  updateSpecsPreview() {
    const { typeConfigs } = this.data;
    const checkedCount = this.getCheckedProcOpts().length;
    let totalWeights = 0;
    for (const t of (typeConfigs || [])) {
      totalWeights += (t.weightConfigs || []).length;
    }
    const count = totalWeights * checkedCount;
    this.setData({ specsPreviewCount: count, procOptCount: checkedCount });
  },

  onAddTypeConfig() {
    const seq = this.data.typeConfigSeq + 1;
    const configs = [...this.data.typeConfigs, { idx: seq, type: '', price_per_jin: 0, weightConfigs: [], weightConfigSeq: 0 }];
    this.setData({ typeConfigs: configs, typeConfigSeq: seq }, () => this.updateSpecsPreview());
  },

  onDelTypeConfig(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const configs = this.data.typeConfigs.filter(c => c.idx !== idx);
    this.setData({ typeConfigs: configs }, () => this.updateSpecsPreview());
  },

  onTypeConfigInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const field = e.currentTarget.dataset.field;
    const val = e.detail.value;
    const configs = this.data.typeConfigs.map(c => {
      if (c.idx === idx) {
        const updated = { ...c };
        updated[field] = field === 'price_per_jin' ? (parseInt(val) || 0) : val;
        return updated;
      }
      return c;
    });
    this.setData({ typeConfigs: configs }, () => this.updateSpecsPreview());
  },

  onAddWeightConfig(e) {
    const typeIdx = Number(e.currentTarget.dataset.typeIdx);
    const configs = this.data.typeConfigs.map(tc => {
      if (tc.idx === typeIdx) {
        const seq = (tc.weightConfigSeq || 0) + 1;
        return {
          ...tc,
          weightConfigs: [...(tc.weightConfigs || []), { idx: seq, weight_label: '', weight_max: 0 }],
          weightConfigSeq: seq
        };
      }
      return tc;
    });
    this.setData({ typeConfigs: configs }, () => this.updateSpecsPreview());
  },

  onDelWeightConfig(e) {
    const typeIdx = Number(e.currentTarget.dataset.typeIdx);
    const idx = Number(e.currentTarget.dataset.idx);
    const configs = this.data.typeConfigs.map(tc => {
      if (tc.idx === typeIdx) {
        return { ...tc, weightConfigs: (tc.weightConfigs || []).filter(w => w.idx !== idx) };
      }
      return tc;
    });
    this.setData({ typeConfigs: configs }, () => this.updateSpecsPreview());
  },

  onWeightConfigInput(e) {
    const typeIdx = Number(e.currentTarget.dataset.typeIdx);
    const idx = Number(e.currentTarget.dataset.idx);
    const field = e.currentTarget.dataset.field;
    const val = e.detail.value;
    const configs = this.data.typeConfigs.map(tc => {
      if (tc.idx === typeIdx) {
        return {
          ...tc,
          weightConfigs: (tc.weightConfigs || []).map(w => {
            if (w.idx === idx) {
              const updated = { ...w };
              updated[field] = field === 'weight_max' ? (parseInt(val) || 0) : val;
              return updated;
            }
            return w;
          })
        };
      }
      return tc;
    });
    this.setData({ typeConfigs: configs }, () => this.updateSpecsPreview());
  },

  // ========== 精确重量选项编辑（exact_weight）==========

  formatJinDisplay(grams) {
    if (!grams || grams <= 0) return '';
    const jin = grams / 500;
    return (jin % 1 === 0 ? jin : jin.toFixed(1)) + '斤';
  },

  onAddWeightOption() {
    const seq = this.data.weightOptionSeq + 1;
    const list = [...this.data.weightOptionsList, { idx: seq, grams: 0, jinDisplay: '' }];
    this.setData({ weightOptionsList: list, weightOptionSeq: seq });
  },

  onDelWeightOption(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const list = this.data.weightOptionsList.filter(item => item.idx !== idx);
    this.setData({ weightOptionsList: list });
  },

  onWeightOptionInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const raw = e.detail.value;
    const filtered = raw.replace(/[^0-9]/g, '');
    const grams = parseInt(filtered) || 0;
    const list = this.data.weightOptionsList.map(item => {
      if (item.idx === idx) {
        return { ...item, grams, jinDisplay: this.formatJinDisplay(grams) };
      }
      return item;
    });
    this.setData({ weightOptionsList: list });
  },

  // ========== 处理方式选项 ==========

  buildProcOptions(labels) {
    return (labels || []).map(l => ({ label: l, checked: true }));
  },

  getCheckedProcOpts() {
    return (this.data.procOptions || [])
      .filter(o => o.checked)
      .map(o => o.label);
  },

  onToggleProcOption(e) {
    const label = e.currentTarget.dataset.label;
    const options = this.data.procOptions.map(o => {
      if (o.label === label) return { ...o, checked: !o.checked };
      return o;
    });
    this.setData({ procOptions: options }, () => {
      if (this.data.pricingType === 'range_weight') {
        this.updateSpecsPreview();
      }
    });
  },

  onShowAddProcOption() {
    this.setData({ showAddProc: true, newProcName: '' });
  },

  onCancelAddProcOption() {
    this.setData({ showAddProc: false, newProcName: '' });
  },

  onNewProcInput(e) {
    this.setData({ newProcName: e.detail.value });
  },

  onConfirmAddProcOption() {
    const name = this.data.newProcName.trim();
    if (!name) {
      wx.showToast({ title: '请输入处理方式名称', icon: 'none' });
      return;
    }
    if (this.data.procOptions.some(o => o.label === name)) {
      wx.showToast({ title: '该处理方式已存在', icon: 'none' });
      return;
    }
    const options = [...this.data.procOptions, { label: name, checked: true }];
    this.setData({
      procOptions: options,
      showAddProc: false,
      newProcName: ''
    }, () => {
      if (this.data.pricingType === 'range_weight') {
        this.updateSpecsPreview();
      }
    });
  },

  onCancel() {
    wx.navigateBack();
  }
});
