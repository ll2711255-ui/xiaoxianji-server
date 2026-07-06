const api = require('../../utils/api');
const { formatMoney, calcDistance } = require('../../utils/util');
const pay = require('../../utils/pay');

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const DELIVERY_TIME_SLOTS = [
  '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00'
];

const PICKUP_TIME_SLOTS = [
  '09:00-11:00', '11:00-13:00', '13:00-15:00',
  '15:00-17:00', '17:00-19:00'
];

Page({
  data: {
    items: [],
    totalDisplay: '0.00',
    totalFen: 0,

    // 配送/自取 Tab
    currentTab: 'delivery',
    showDeliveryTab: true,
    showPickupTab: false,

    // 地址
    address: null,
    storeAddress: '加载中...',
    storeLat: 23.1291,
    storeLng: 113.2644,
    storeMarker: [],

    // 预约时间
    isScheduled: false,
    scheduleDate: '',
    scheduleTime: '',
    dateOptions: [],
    timeOptions: [],

    // 费用
    deliveryFeeDisplay: '0.00',
    finalTotalDisplay: '0.00',
    hasRangeWeight: false,

    // 手机号授权
    showPhoneAuth: false,
    _pendingSubmit: false,

    // 配送范围超限弹窗
    showRangeModal: false,
    rangeModalMsg: '',
    rangeModalDistance: '',
    rangeModalRadius: ''
  },

  onLoad(options) {
    const from = options.from || 'cart';
    let items = [];

    if (from === 'buyNow') {
      items = wx.getStorageSync('buyNow') || [];
      wx.removeStorageSync('buyNow');
    } else {
      // 从购物车结算：读取勾选的商品
      items = wx.getStorageSync('checkoutItems') || [];
      // 兜底：若 checkoutItems 为空（旧版或直接进入），取购物车中已勾选的
      if (items.length === 0) {
        const cart = wx.getStorageSync('cart') || [];
        items = cart.filter(i => i.checked !== false);
      }
    }

    if (items.length === 0) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    // 计算可用的取货方式
    const modes = new Set();
    items.forEach(i => {
      const d = (i.spec && i.spec.delivery) || 'pickup';
      if (d === 'delivery' || d === 'scheduled') modes.add('delivery');
      if (d === 'pickup') modes.add('pickup');
    });
    const showDeliveryTab = modes.has('delivery');
    const showPickupTab = modes.has('pickup');
    const currentTab = showDeliveryTab ? 'delivery' : 'pickup';

    // 检查是否包含整鸡（按重量范围计价）
    const hasRangeWeight = items.some(i => i.pricingType === 'range_weight');

    // 计算总金额
    const totalFen = items.reduce((s, i) => s + i.price * i.quantity, 0);

    // 预处理每个商品的展示数据
    const displayItems = items.map(i => ({
      ...i,
      priceDisplay: formatMoney(i.price),
      subtotalDisplay: formatMoney(i.price * i.quantity),
      emoji: i.emoji || '🐔'
    }));

    this.setData({
      items: displayItems,
      totalDisplay: formatMoney(totalFen),
      totalFen,
      finalTotalDisplay: formatMoney(totalFen),
      currentTab,
      showDeliveryTab,
      showPickupTab,
      hasRangeWeight
    });

    this.buildDateOptions();
    this.loadStoreInfo();
    if (currentTab === 'delivery') {
      this.loadDefaultAddress();
    }
  },

  async loadStoreInfo() {
    try {
      const res = await api.get('/store');
      const config = (res && res.data && res.data.config) || res;
      if (!config) return;

      // 兼容蛇形字段名（兜底）
      const lat = config.latitude || 23.1291;
      const lng = config.longitude || 113.2644;
      const storeAddress = config.address || '';
      const storeName = config.name || '小鲜鸡店铺';

      if (storeAddress) {
        this.setData({
          storeAddress,
          storeLat: lat,
          storeLng: lng,
          storeMarker: [{
            id: 1,
            latitude: lat,
            longitude: lng,
            title: storeName,
            iconPath: '',
            width: 28,
            height: 28,
            callout: { content: storeName, fontSize: 14, padding: 8, display: 'ALWAYS' }
          }]
        });
      } else {
        this.setData({ storeAddress: '小鲜鸡线下体验店' });
      }
    } catch (_) {
      this.setData({ storeAddress: '小鲜鸡线下体验店' });
    }
  },

  // ========== 生成日期选项（7天） ==========
  buildDateOptions() {
    const today = new Date();
    const options = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = WEEKDAY_NAMES[d.getDay()];

      let label;
      if (i === 0) {
        label = '今天 ' + month + '/' + day;
      } else if (i === 1) {
        label = '明天 ' + month + '/' + day;
      } else {
        label = weekday + ' ' + month + '/' + day;
      }

      options.push({
        label,
        value: [d.getFullYear(), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
      });
    }
    this.setData({ dateOptions: options });
  },

  // ========== 生成时段选项 ==========
  buildTimeOptions(tab) {
    const slots = tab === 'pickup' ? PICKUP_TIME_SLOTS : DELIVERY_TIME_SLOTS;
    const options = slots.map(s => ({ label: s, value: s }));
    this.setData({ timeOptions: options });
  },

  // Tab 切换
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({
      currentTab: tab,
      isScheduled: false,
      scheduleDate: '',
      scheduleTime: ''
    });
    if (tab === 'delivery' && !this.data.address) {
      this.loadDefaultAddress();
    }
  },

  // 时间胶囊切换
  onTimeCapsuleTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'now') {
      this.setData({ isScheduled: false, scheduleDate: '', scheduleTime: '' });
    } else {
      this.buildTimeOptions(this.data.currentTab);
      this.setData({ isScheduled: true });
    }
  },

  // 选择日期
  onDateSelect(e) {
    this.setData({ scheduleDate: e.currentTarget.dataset.value });
  },

  // 选择时段
  onTimeSelect(e) {
    this.setData({ scheduleTime: e.currentTarget.dataset.value });
  },

  async loadDefaultAddress() {
    try {
      const res = await api.get('/addresses');
      const addresses = (res && res.data && res.data.addresses) || [];
      const def = addresses.find(a => a.isDefault) || (addresses.length > 0 ? addresses[0] : null);
      if (def) {
        this.setData({ address: def });
      }
    } catch (err) {
      console.error('加载地址失败:', err);
    }
  },

  onSelectAddress() {
    wx.chooseAddress({
      success: (res) => {
        const address = {
          name: res.userName,
          phone: res.telNumber,
          province: res.provinceName,
          city: res.cityName,
          district: res.countyName,
          detail: res.detailInfo,
          isDefault: false
        };
        this.setData({ address });
        // 同步保存地址到后端，避免多设备/换手机时地址丢失
        api.post('/addresses', address).catch(() => {});
        // 异步获取坐标（wx.chooseAddress 不含经纬度，配送距离校验需要）
        this.fetchAddressCoordinates(address);
      },
      fail: () => {
        wx.navigateTo({ url: '/pages/mine/address/address?select=true' });
      }
    });
  },

  /**
   * 获取地址坐标，补齐 latitude/longitude
   */
  fetchAddressCoordinates(address) {
    wx.getLocation({
      type: 'gcj02',
      success: (locRes) => {
        const updated = {
          ...address,
          latitude: locRes.latitude,
          longitude: locRes.longitude
        };
        this.setData({ address: updated });
      },
      fail: () => {
        // 获取位置失败不阻塞流程，配送范围校验时会再次尝试
        console.warn('[checkout] 获取位置失败，配送校验时重试');
      }
    });
  },

  onSubmit() {
    const { currentTab, items, totalFen, address, isScheduled, scheduleDate, scheduleTime } = this.data;
    const orderType = currentTab;

    // 检查手机号：未绑定则弹窗授权
    const phone = wx.getStorageSync('phone') || getApp().globalData.phone;
    if (!phone) {
      this.setData({ showPhoneAuth: true, _pendingSubmit: true });
      return;
    }

    this._doSubmit();
  },

  async _doSubmit() {
    const { currentTab, items, totalFen, address, isScheduled, scheduleDate, scheduleTime } = this.data;
    const orderType = currentTab;

    if (orderType === 'delivery' && !address) {
      wx.showToast({ title: '请添加收货地址', icon: 'none' });
      return;
    }

    // 配送订单：校验配送范围
    if (orderType === 'delivery') {
      const rangeOk = await this.checkDeliveryRange();
      if (!rangeOk) return;
    }

    if (isScheduled && !scheduleDate) {
      wx.showToast({ title: '请选择预约日期', icon: 'none' });
      return;
    }

    if (isScheduled && !scheduleTime) {
      wx.showToast({ title: '请选择预约时段', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      // 创建一个订单，包含所有商品
      const orderItems = items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        pricingType: item.pricingType,
        spec: item.spec,
        quantity: item.quantity
      }));

      const res = await api.post('/orders', {
        items: orderItems,
        type: orderType,
        deliveryAddress: orderType === 'delivery' ? address : null,
        isScheduled,
        scheduledDate: isScheduled ? scheduleDate : '',
        scheduledTime: isScheduled ? scheduleTime : ''
      });

      wx.hideLoading();

      // 兼容两种响应格式
      const d = (res && res.data) || res || {};
      if (d.orderNo && d.payment) {
        // 拥有有效支付参数，发起支付
        this.callWxPay({ orders: [{ orderNo: d.orderNo, payment: d.payment }] });
      } else if (d.orderNo && !d.payment) {
        // 订单已创建但支付参数缺失（微信统一下单失败）
        const errorMsg = d.payError || '支付暂不可用，请在订单列表重试';
        wx.showModal({
          title: '支付失败',
          content: errorMsg,
          showCancel: false,
          confirmText: '查看订单',
          success: () => wx.redirectTo({ url: '/pages/orders/orders' })
        });
      } else {
        wx.showToast({ title: '创建订单失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('创建订单失败:', err);
      wx.showToast({ title: err.message || '创建订单失败', icon: 'none' });
    }
  },

  /**
   * 校验配送范围
   * @returns {Promise<boolean>} true = 在范围内，false = 超出范围（已弹窗提示）
   */
  async checkDeliveryRange() {
    const { address } = this.data;
    if (!address) return true;

    try {
      const configRes = await api.get('/store');
      const config = (configRes && configRes.data && configRes.data.config) || configRes || {};
      const deliveryRadius = config.deliveryRadius || 5;
      const storeLat = config.latitude || 23.1291;
      const storeLng = config.longitude || 113.2644;

      let userLat, userLng;
      if (address.latitude !== undefined && address.longitude !== undefined) {
        userLat = address.latitude;
        userLng = address.longitude;
      } else {
        try {
          const locRes = await new Promise((resolve, reject) => {
            wx.getLocation({ type: 'gcj02', success: resolve, fail: reject });
          });
          userLat = locRes.latitude;
          userLng = locRes.longitude;
        } catch (_) {
          userLat = storeLat + 0.001;
          userLng = storeLng + 0.001;
        }
      }

      const distance = calcDistance(userLat, userLng, storeLat, storeLng);

      if (distance > deliveryRadius) {
        this.setData({
          showRangeModal: true,
          rangeModalMsg: `当前地址超出配送范围（${deliveryRadius}公里）`,
          rangeModalDistance: distance.toFixed(1),
          rangeModalRadius: String(deliveryRadius)
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error('配送范围校验失败:', err);
      return true;
    }
  },

  /**
   * 点击门店地图 → 打开原生导航
   */
  onNavigateToStore() {
    const { storeLat, storeLng, storeAddress } = this.data;
    wx.openLocation({
      latitude: storeLat,
      longitude: storeLng,
      name: '小鲜鸡',
      address: storeAddress,
      scale: 16
    });
  },

  onSwitchToPickup() {
    this.setData({ showRangeModal: false });
    if (this.data.showPickupTab) {
      this.onTabTap({ currentTarget: { dataset: { tab: 'pickup' } } });
    }
  },

  onCloseRangeModal() {
    this.setData({ showRangeModal: false });
  },

  /**
   * 拉起支付（委托公共 pay 工具）
   * @param {Array<{orderNo: string, payment: object|null}>} orders
   */
  callWxPay({ orders }) {
    const order = orders[0];
    const that = this;

    // 清购物车回调
    function clearCartAndGoOrders() {
      const cart = wx.getStorageSync('cart') || [];
      const purchasedKeys = new Set(that.data.items.map(i => i.cartKey));
      const remaining = cart.filter(c => !purchasedKeys.has(c.cartKey));
      wx.setStorageSync('cart', remaining);
      wx.removeStorageSync('checkoutItems');
      getApp().globalData.cartVersion = Date.now();
    }

    pay.callWxPay({
      orderNo: order.orderNo,
      payment: order.payment,
      amountDisplay: this.data.totalDisplay,
      clearItems: clearCartAndGoOrders,
      onSuccess: () => {
        wx.switchTab({ url: '/pages/orders/orders' });
      },
      onCancel: () => {
        wx.switchTab({ url: '/pages/orders/orders' });
      }
    });
  },

  // ========== 手机号授权（下单前） ==========

  /**
   * 微信原生 getPhoneNumber 按钮回调 — 授权后自动继续提交订单
   */
  onGetPhoneForOrder(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      wx.showLoading({ title: '授权中...' });
      api.post('/auth/wx-phone', {
        phoneCode: e.detail.code
      }).then(res => {
        wx.hideLoading();
        const d = (res && res.data) || res;
        if (d.phone) {
          wx.setStorageSync('phone', d.phone);
          getApp().globalData.phone = d.phone;
          this.setData({ showPhoneAuth: false });
          wx.showToast({ title: '已绑定', icon: 'success', duration: 1000 });
          // 授权成功后自动继续提交
          setTimeout(() => this._doSubmit(), 1100);
        } else {
          wx.showToast({ title: (res && res.message) || '授权失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('手机号授权失败:', err);
        wx.showToast({ title: '授权失败，请重试', icon: 'none' });
      });
    }
  },

  /**
   * 取消手机号授权 — 关闭浮层，不提交订单
   */
  onCancelPhoneAuth() {
    this.setData({ showPhoneAuth: false, _pendingSubmit: false });
  }
});
