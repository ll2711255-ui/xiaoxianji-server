const api = require('../../../../utils/api');
const { formatMoney, getStatusText, getRefundStatusText, getRefundStatusClass, getOrderTypeLabel } = require('../../../../utils/util');
const { getDetailOrderActions, ACTION_LABELS } = require('../../../../utils/orderActions');
const { buildWeighInfoDisplay, buildRefundInfoDisplay } = require('../../../../utils/orderDisplay');
const printer = require('../../../../utils/printer');
const auth = require('../../../../utils/auth');
const { SCENE_CARD_PREFIX, FALLBACK_QR_API } = require('../../../../utils/constants');

Page({
  data: {
    order: null,
    orderNo: '',

    // 称重记录展示
    weighInfo: null,
    refundInfo: null,
    // 打印机
    showPrinterPanel: false,
    printers: [],
    printerSearching: false,
    printerConnecting: false,
    printing: false,
    currentPrinter: null,
    // 模拟打印预览
    showTicketPreview: false,
    ticketData: {},
    ticketQrUrl: ''
  },

  onLoad(options) {
    const orderNo = options.orderNo;
    if (!orderNo) { wx.showToast({ title: '订单不存在', icon: 'none' }); return; }
    this.setData({ orderNo });

    // 称重操作：跳转到独立的称重页面
    if (options.action === 'weigh') {
      wx.navigateTo({ url: `/pages/merchant/orders/weigh/weigh?orderNo=${orderNo}` });
    }
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const res = await api.get('/orders/' + this.data.orderNo);
      const d = (res && res.data) || res || {};
      const order = d.order;
      if (!order) return;

      order.prepayDisplay = formatMoney(order.prepayAmount || 0);
      order.actualDisplay = formatMoney(order.actualAmount || 0);
      order.refundDisplay = formatMoney(order.refundAmount || 0);
      order.actualWeightDisplay = (order.actualWeight && !isNaN(order.actualWeight))
        ? (order.actualWeight / 500).toFixed(2) + '斤（' + order.actualWeight + '克）' : '';
      order.statusText = getStatusText(order.status, order.type);
      order.typeLabel = getOrderTypeLabel(order.type);

      // 使用共享工具构建展示数据
      const weighInfo = buildWeighInfoDisplay(order);
      const refundInfo = buildRefundInfoDisplay(order);

      // 使用共享工具获取操作权限
      const actions = getDetailOrderActions(order);
      Object.assign(order, actions);

      this.setData({ order, weighInfo, refundInfo });
    } catch (err) {
      console.error('加载订单详情失败:', err);
    }
  },

  // ========== 导航 & 拨号 ==========
  onNavigateToAddress() {
    const addr = this.data.order && this.data.order.deliveryAddress;
    if (!addr) return;

    const lat = addr.latitude;
    const lng = addr.longitude;
    if (!lat || !lng) {
      wx.showToast({ title: '该地址无坐标信息，请手动导航', icon: 'none' });
      return;
    }

    const addressStr = [addr.province, addr.city, addr.district, addr.detail]
      .filter(Boolean).join('');

    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name: '收货地址',
      address: addressStr || addr.address || '',
      scale: 16
    });
  },

  onCallPhone() {
    const phone = this.data.order && this.data.order.deliveryAddress
      && this.data.order.deliveryAddress.phone;
    if (!phone) return;

    wx.makePhoneCall({ phoneNumber: phone });
  },

  // ========== 复制 ==========
  onCopyAddress() {
    const addr = this.data.order && this.data.order.deliveryAddress;
    if (!addr) return;
    const text = [addr.province, addr.city, addr.district, addr.detail]
      .filter(Boolean).join('');
    if (text) {
      wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '地址已复制', icon: 'success' }) });
    }
  },

  onCopyPhone() {
    const phone = this.data.order && this.data.order.deliveryAddress
      && this.data.order.deliveryAddress.phone;
    if (phone) {
      wx.setClipboardData({ data: phone, success: () => wx.showToast({ title: '电话已复制', icon: 'success' }) });
    }
  },

  // ========== 状态操作 ==========
  onStatusAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action === 'weigh') {
      wx.navigateTo({ url: `/pages/merchant/orders/weigh/weigh?orderNo=${this.data.orderNo}` });
      return;
    }

    if (action === 'cancel') {
      wx.showModal({
        title: '取消订单',
        content: '确定要取消此订单吗？款项将全额退回。',
        confirmText: '取消订单',
        confirmColor: '#A83108',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api.post('/orders/' + this.data.orderNo + '/cancel');
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadOrder();
          } catch (err) {
            console.error('取消订单失败:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      });
      return;
    }

    if (action === 'markPaid') {
      wx.showModal({
        title: '确认收款',
        content: '确认已收到该订单的付款？',
        confirmText: '确认收款',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api.post('/merchant/orders/' + this.data.orderNo + '/mark-paid');
            wx.showToast({ title: '已标记为已支付', icon: 'success' });
            this.loadOrder();
          } catch (err) {
            console.error('标记支付失败:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      });
      return;
    }

    const labels = ACTION_LABELS;
    wx.showModal({
      title: labels[action] || '操作确认',
      content: `确定要${labels[action] || '执行此操作'}吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.post('/merchant/orders/' + this.data.orderNo + '/' + action);
          wx.showToast({ title: '操作成功', icon: 'success' });
          this.loadOrder();
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // ========== 称重照片预览 ==========
  onPreviewWeighPhoto() {
    const photo = (this.data.weighInfo && this.data.weighInfo.weighPhoto) ||
                  (this.data.order && this.data.order.weighPhoto);
    if (photo) wx.previewImage({ urls: [photo], current: photo });
  },

  // ========== 打印小票 ==========

  onUnload() {
    printer.closeBluetooth();
  },

  /**
   * 从订单详情页补打小票
   */
  onPrintReceipt() {
    const order = this.data.order;
    if (!order) return;

    const printData = {
      orderNo: order.orderNo,
      cardNumber: order.cardNumber || '',
      amountFen: order.actualAmount || order.prepayAmount || 0,
      scene: SCENE_CARD_PREFIX + (order.cardNumber || ''),
      paymentType: order.paymentType || ''
    };

    // 模拟模式：直接显示小票预览
    if (printer.MOCK_PRINT) {
      this._showTicketPreview(printData);
      return;
    }

    this._printOrderData = printData;
    this.onOpenPrinterPanel();
  },

  /**
   * 打开打印机选择面板
   */
  onOpenPrinterPanel() {
    this.setData({
      showPrinterPanel: true,
      printers: [],
      printerSearching: false,
      printerConnecting: false,
      currentPrinter: null,
      printing: false
    });
    this.onSearchPrinters();
  },

  /**
   * 关闭打印机选择面板
   */
  onClosePrinterPanel() {
    this.setData({ showPrinterPanel: false });
  },

  /**
   * 阻止事件冒泡到 overlay 层
   */
  onPreventClose() {},

  /**
   * 搜索蓝牙打印机
   */
  async onSearchPrinters() {
    this.setData({ printerSearching: true, printers: [] });
    printer.searchPrinters((devices) => {
      devices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
      this.setData({ printers: devices.slice(0, 20) });
    }).then((devices) => {
      devices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
      this.setData({
        printers: devices.slice(0, 20),
        printerSearching: false
      });
    }).catch(() => {
      this.setData({ printerSearching: false });
    });
  },

  /**
   * 连接选中打印机并打印
   */
  async onSelectPrinterDetail(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceName = e.currentTarget.dataset.deviceName;
    if (!deviceId || !this._printOrderData) return;

    this.setData({
      printerConnecting: true,
      currentPrinter: { deviceId, name: deviceName }
    });

    this.setData({ printing: true });
    const result = await printer.printReceipt(this._printOrderData, { deviceId });

    if (result.success) {
      this.setData({
        printing: false,
        showPrinterPanel: false,
        printerConnecting: false
      });
    } else {
      this.setData({
        printing: false,
        printerConnecting: false
      });
      wx.showToast({ title: result.error || '打印失败，请重试', icon: 'none' });
    }
  },

  // ========== 模拟打印预览 ==========

  _showTicketPreview(orderData) {
    const amountYuan = ((orderData.amountFen || 0) / 100).toFixed(2);
    const scene = orderData.scene || (SCENE_CARD_PREFIX + orderData.cardNumber);
    const payLabel = orderData.paymentType === 'wechat' ? '微信支付'
      : orderData.paymentType === 'unpaid' ? '未支付'
      : '现金/扫码';
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.setData({
      showTicketPreview: true,
      ticketQrUrl: '',
      ticketData: {
        orderNo: orderData.orderNo,
        cardNumber: orderData.cardNumber || '',
        amountYuan,
        paymentLabel: payLabel,
        scene,
        time: timeStr
      }
    });

    this._loadCodeImage(orderData.cardNumber, scene);
  },

  _loadCodeImage(cardNumber, scene) {
    if (!cardNumber) return;
    api.get('/pai-numbers/' + cardNumber + '/code')
      .then(res => {
        const d = (res && res.data) || res || {};
        if (d.codeImageUrl) {
          this.setData({ ticketQrUrl: d.codeImageUrl });
        } else {
          this._fallbackQrUrl(scene);
        }
      })
      .catch(() => this._fallbackQrUrl(scene));
  },

  _fallbackQrUrl(scene) {
    if (this.data.ticketQrUrl) return;
    this.setData({
      ticketQrUrl: `${FALLBACK_QR_API}?size=200x200&data=${encodeURIComponent(scene || '')}`
    });
  },

  onMockPrintDone() {
    this.setData({ showTicketPreview: false });
    wx.showToast({ title: '小票已打印', icon: 'success' });
  },

  onClosePreview() {
    this.setData({ showTicketPreview: false });
  }
});
