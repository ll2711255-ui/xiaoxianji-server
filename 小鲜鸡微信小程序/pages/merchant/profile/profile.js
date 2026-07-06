const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const printer = require('../../../utils/printer');

Page({
  data: {
    shopName: '小鲜鸡店铺',
    merchantId: '',
    roleLabel: '商家',

    // 店铺信息弹窗
    showShopModal: false,
    shopNameInput: '',
    shopAddressInput: '',
    shopLat: 23.1291,
    shopLng: 113.2644,
    savingShop: false,

    // 账号信息弹窗
    showAccountModal: false,
    accountNameInput: '',
    accountPhoneInput: '',
    savingAccount: false,

    // 店铺地图标记
    shopMarker: [],

    // 配送设置弹窗
    showDeliveryModal: false,
    deliveryRadius: 5,
    deliveryRadiusInput: '',
    savingDelivery: false,

    // 打印机连接
    showPrinterPanel: false,
    printers: [],
    printerSearching: false,
    printerConnecting: false,
    connectedPrinterName: '',
    connectedPrinterId: '',
    currentPrinter: null,

    // 营业时间弹窗
    showBusinessHoursModal: false,
    openTime: '08:00',
    closeTime: '21:00',
    openTimeDisplay: '08:00',
    closeTimeDisplay: '21:00',
    savingHours: false
  },

  onShow() {
    if (!auth.checkMerchant()) return;

    const role = wx.getStorageSync(auth.STORAGE_KEYS.role) || 'merchant';
    const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || '';

    const roleLabels = { merchant: '商家', admin: '管理员' };

    this.setData({
      merchantId,
      roleLabel: roleLabels[role] || '商家'
    });

    this.loadShopConfig();
    this.loadDeliveryConfig();
    this.loadPrinterStatus();
  },

  onUnload() {
    printer.closeBluetooth();
  },

  loadPrinterStatus() {
    if (printer.isConnected()) {
      const id = printer.getConnectedDeviceId() || '';
      this.setData({
        connectedPrinterName: '已连接',
        connectedPrinterId: id
      });
    } else {
      const lastId = printer.getLastPrinterId();
      this.setData({
        connectedPrinterName: lastId ? '未连接（可重连）' : '',
        connectedPrinterId: lastId || ''
      });
    }
  },

  async loadShopConfig() {
    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.get('/store', { merchantId });
      const d = (res && res.data) || res || {};
      const config = d.config || d;
      if (config && config.address) {
        const lat = config.latitude || 23.1291;
        const lng = config.longitude || 113.2644;
        const marker = [{
          id: 1, latitude: lat, longitude: lng,
          title: config.name || '店铺位置',
          iconPath: '', width: 32, height: 32
        }];
        const openTime = config.openTime || '08:00';
        const closeTime = config.closeTime || '21:00';
        this.setData({
          shopName: config.name || '小鲜鸡店铺',
          shopNameInput: config.name || '',
          shopAddressInput: config.address || '',
          shopLat: lat, shopLng: lng, shopMarker: marker,
          accountNameInput: config.contactName || '',
          accountPhoneInput: config.contactPhone || '',
          openTime, closeTime,
          openTimeDisplay: openTime, closeTimeDisplay: closeTime
        });
      }
    } catch (err) {
      console.error('加载店铺配置失败:', err);
    }
  },

  async loadDeliveryConfig() {
    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.get('/store', { merchantId });
      const d = (res && res.data) || res || {};
      const config = d.config || d;
      if (config && config.deliveryRadius !== undefined) {
        this.setData({
          deliveryRadius: config.deliveryRadius || 5,
          deliveryRadiusInput: String(config.deliveryRadius || 5)
        });
      }
    } catch (err) {
      console.error('加载配送配置失败:', err);
    }
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/merchant/' + key + '/' + key });
  },

  // ========== 店铺管理 ==========
  onShopInfo() {
    const marker = [{
      id: 1, latitude: this.data.shopLat, longitude: this.data.shopLng,
      title: this.data.shopName, iconPath: '', width: 32, height: 32
    }];
    this.setData({
      showShopModal: true,
      shopNameInput: this.data.shopName,
      shopAddressInput: this.data.shopAddressInput,
      shopMarker: marker
    });
  },

  onShopNameInput(e) {
    this.setData({ shopNameInput: e.detail.value });
  },

  onChooseLocation() {
    wx.chooseLocation({
      latitude: this.data.shopLat,
      longitude: this.data.shopLng,
      success: (res) => {
        this.setData({
          shopAddressInput: res.address || res.name || '',
          shopLat: res.latitude,
          shopLng: res.longitude,
          shopMarker: [{
            id: 1, latitude: res.latitude, longitude: res.longitude,
            title: res.name || '店铺位置', iconPath: '', width: 32, height: 32
          }]
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选点失败，请重试', icon: 'none' });
        }
      }
    });
  },

  onCloseShopModal() {
    this.setData({ showShopModal: false });
  },

  async onSaveShopInfo() {
    const { shopNameInput, shopAddressInput, shopLat, shopLng } = this.data;
    if (!shopNameInput.trim()) { wx.showToast({ title: '请输入店铺名称', icon: 'none' }); return; }
    if (!shopAddressInput.trim()) { wx.showToast({ title: '请选择店铺地址', icon: 'none' }); return; }

    this.setData({ savingShop: true });

    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.put('/store', {
        merchantId, name: shopNameInput.trim(),
        address: shopAddressInput.trim(),
        latitude: shopLat, longitude: shopLng
      });

      if (res && res.success) {
        this.setData({ shopName: shopNameInput.trim(), showShopModal: false });
        wx.showToast({ title: '店铺信息已更新', icon: 'success' });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存店铺信息失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ savingShop: false });
    }
  },

  onNumbers() {
    wx.navigateTo({ url: '/pages/merchant/numbers/numbers' });
  },

  onOfflineCashier() {
    wx.navigateTo({ url: '/pages/merchant/offline/offline' });
  },

  onDeliverySettings() {
    this.setData({ showDeliveryModal: true, deliveryRadiusInput: String(this.data.deliveryRadius) });
  },

  onDeliveryRadiusInput(e) {
    this.setData({ deliveryRadiusInput: e.detail.value });
  },

  onPreventClose() {},

  onCloseDeliveryModal() {
    this.setData({ showDeliveryModal: false });
  },

  async onSaveDelivery() {
    const val = parseFloat(this.data.deliveryRadiusInput);
    if (isNaN(val) || val <= 0 || val > 50) {
      wx.showToast({ title: '请输入1-50之间的公里数', icon: 'none' });
      return;
    }

    this.setData({ savingDelivery: true });

    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.put('/store', { merchantId, deliveryRadius: val });

      if (res && res.success) {
        this.setData({ deliveryRadius: val, showDeliveryModal: false });
        wx.showToast({ title: '配送范围已更新', icon: 'success' });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存配送配置失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ savingDelivery: false });
    }
  },

  // ========== 营业时间设置 ==========
  onBusinessHours() {
    this.setData({
      showBusinessHoursModal: true,
      openTimeDisplay: this.data.openTime,
      closeTimeDisplay: this.data.closeTime
    });
  },

  onOpenTimeChange(e) { this.setData({ openTimeDisplay: e.detail.value }); },
  onCloseTimeChange(e) { this.setData({ closeTimeDisplay: e.detail.value }); },
  onCloseBusinessHoursModal() { this.setData({ showBusinessHoursModal: false }); },

  async onSaveBusinessHours() {
    const { openTimeDisplay, closeTimeDisplay } = this.data;
    if (!openTimeDisplay || !closeTimeDisplay) { wx.showToast({ title: '请设置完整的营业时间', icon: 'none' }); return; }
    if (openTimeDisplay >= closeTimeDisplay) { wx.showToast({ title: '开始时间必须早于结束时间', icon: 'none' }); return; }

    this.setData({ savingHours: true });

    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.put('/store', {
        merchantId, openTime: openTimeDisplay, closeTime: closeTimeDisplay
      });

      if (res && res.success) {
        this.setData({ openTime: openTimeDisplay, closeTime: closeTimeDisplay, showBusinessHoursModal: false });
        wx.showToast({ title: '营业时间已更新', icon: 'success' });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存营业时间失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ savingHours: false });
    }
  },

  // ========== 打印机连接 ==========
  onConnectPrinter() {
    const lastId = printer.getLastPrinterId();
    const isConnected = printer.isConnected();
    const connectedId = printer.getConnectedDeviceId();

    this.setData({
      showPrinterPanel: true, printers: [], printerSearching: false,
      printerConnecting: false, currentPrinter: null,
      connectedPrinterName: isConnected ? '已连接' : (lastId ? '上次使用: ' + lastId : ''),
      connectedPrinterId: connectedId || lastId || ''
    });
    this.onSearchPrinters();
  },

  onClosePrinterPanel() { this.setData({ showPrinterPanel: false }); },

  async onSearchPrinters() {
    this.setData({ printerSearching: true, printers: [] });
    printer.searchPrinters((devices) => {
      devices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
      this.setData({ printers: devices.slice(0, 20) });
    }).then((devices) => {
      devices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
      this.setData({ printers: devices.slice(0, 20), printerSearching: false });
    }).catch(() => {
      this.setData({ printerSearching: false });
    });
  },

  async onSelectPrinterProfile(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceName = e.currentTarget.dataset.deviceName;
    if (!deviceId) return;

    this.setData({ printerConnecting: true, currentPrinter: { deviceId, name: deviceName } });

    const result = await printer.connectPrinter(deviceId);
    this.setData({ printerConnecting: false });

    if (result.success) {
      this.setData({ showPrinterPanel: false, connectedPrinterName: deviceName || '打印机', connectedPrinterId: deviceId });
      wx.showToast({ title: '打印机连接成功', icon: 'success' });
    } else {
      wx.showToast({ title: result.error || '连接失败', icon: 'none' });
    }
  },

  onDisconnectPrinter() {
    printer.disconnectPrinter();
    this.setData({ connectedPrinterName: '', connectedPrinterId: '' });
    wx.showToast({ title: '已断开打印机', icon: 'none' });
  },

  // ========== 账号管理 ==========
  onAccountInfo() { this.setData({ showAccountModal: true }); },
  onAccountNameInput(e) { this.setData({ accountNameInput: e.detail.value }); },
  onAccountPhoneInput(e) { this.setData({ accountPhoneInput: e.detail.value }); },
  onCloseAccountModal() { this.setData({ showAccountModal: false }); },

  async onSaveAccountInfo() {
    const { accountNameInput, accountPhoneInput } = this.data;
    if (!accountNameInput.trim()) { wx.showToast({ title: '请输入联系人姓名', icon: 'none' }); return; }
    if (!accountPhoneInput.trim()) { wx.showToast({ title: '请输入联系电话', icon: 'none' }); return; }
    if (!/^1\d{10}$/.test(accountPhoneInput.trim())) { wx.showToast({ title: '请输入正确的手机号', icon: 'none' }); return; }

    this.setData({ savingAccount: true });

    try {
      const merchantId = wx.getStorageSync(auth.STORAGE_KEYS.merchantId) || 'merchant_01';
      const res = await api.put('/store', {
        merchantId, contactName: accountNameInput.trim(), contactPhone: accountPhoneInput.trim()
      });

      if (res && res.success) {
        this.setData({ showAccountModal: false });
        wx.showToast({ title: '账号信息已更新', icon: 'success' });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存账号信息失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ savingAccount: false });
    }
  },

  onChangePassword() {
    wx.showModal({ title: '修改密码', content: '请联系管理员重置密码', showCancel: false });
  },

  onHelp() {
    wx.showModal({ title: '使用帮助', content: '如有问题请联系客服\n400-000-0000', showCancel: false });
  },

  onAbout() {
    wx.showModal({ title: '小鲜鸡商家端', content: '新鲜鸡肉，品质保证\n商家管理后台 v1.0.0', showCancel: false });
  },

  // ========== 退出 ==========
  onLogout() {
    wx.showModal({
      title: '退出商家模式',
      content: '确定要退出吗？退出后需重新登录。',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('merchant_role');
          auth.clearAuth();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
