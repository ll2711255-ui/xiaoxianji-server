const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const printer = require('../../../utils/printer');
const { SCENE_CARD_PREFIX, FALLBACK_QR_API } = require('../../../utils/constants');

Page({
  data: {
    amount: '',
    amountDisplay: '0.00',
    paymentType: 'cash',
    cardNumbers: [],
    selectedCard: '',
    submitting: false,
    result: null,

    // 打印机
    showPrinterPanel: false,
    printers: [],
    printerSearching: false,
    printerConnecting: false,
    printing: false,
    currentPrinter: null,
    lastUsedPrinterId: '',
    printOrderData: null,

    // 模拟打印预览
    showTicketPreview: false,
    ticketData: {},
    ticketQrUrl: ''
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.loadCardNumbers();
    if (!this.data.lastUsedPrinterId) {
      this.setData({ lastUsedPrinterId: printer.getLastPrinterId() || '' });
    }
  },

  onUnload() {
    printer.closeBluetooth();
  },

  async loadCardNumbers() {
    try {
      const res = await api.get('/pai-numbers');
      const allNumbers = (res && res.data && res.data.numbers) || [];
      const idleCards = allNumbers.filter(c => c.status === 'idle');
      this.setData({ cardNumbers: idleCards });
    } catch (err) {
      console.error('加载号码牌失败:', err);
    }
  },

  // 数字键盘输入
  onKeyTap(e) {
    const key = e.currentTarget.dataset.key;
    let { amount } = this.data;

    if (key === 'clear') {
      amount = '';
    } else if (key === 'backspace') {
      amount = amount.slice(0, -1);
    } else if (key === '.') {
      if (amount.includes('.')) return;
      amount += '.';
    } else if (key === 'submit') {
      this.onSubmit();
      return;
    } else {
      const parts = amount.split('.');
      if (parts.length === 2 && parts[1].length >= 2) return;
      amount += key;
    }

    const display = amount ? (parseFloat(amount) || 0).toFixed(2) : '0.00';
    this.setData({ amount, amountDisplay: display });
  },

  onPaymentType(e) {
    this.setData({ paymentType: e.currentTarget.dataset.type });
  },

  onCardSelect(e) {
    const number = e.currentTarget.dataset.number;
    this.setData({ selectedCard: number === this.data.selectedCard ? '' : number });
  },

  onSubmit() {
    const { amount, paymentType, selectedCard, amountDisplay } = this.data;
    const amountFen = Math.round(parseFloat(amount) * 100);

    if (!amount || isNaN(amountFen) || amountFen <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    if (!selectedCard) {
      wx.showToast({ title: '请选择号码牌', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认收款',
      content: `金额：¥${amountDisplay}\n付款方式：${paymentType === 'cash' ? '现金' : '微信支付'}\n号码牌：${selectedCard}`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        try {
          const result = await api.post('/merchant/offline-orders', {
            amount: amountFen,
            cardNumber: selectedCard,
            paymentType
          });
          const d = (result && result.data) || result || {};
          if (!d.orderNo) {
            this.setData({ submitting: false });
            wx.showToast({ title: '创建订单超时，请重试', icon: 'none' });
            return;
          }
          // 自动进入处理中
          await api.post('/merchant/orders/' + d.orderNo + '/process');

          const printData = {
            orderNo: d.orderNo,
            cardNumber: selectedCard,
            amountFen,
            scene: SCENE_CARD_PREFIX + selectedCard,
            paymentType
          };

          this.setData({
            submitting: false,
            printOrderData: printData,
            lastUsedPrinterId: printer.getLastPrinterId() || ''
          });

          this.onPrintReceipt();
        } catch (err) {
          console.error('创建订单失败:', err);
          this.setData({ submitting: false });
          wx.showToast({ title: '创建失败', icon: 'none' });
        }
      }
    });
  },

  onNewOrder() {
    this.setData({
      amount: '', amountDisplay: '0.00',
      selectedCard: '', result: null, printOrderData: null,
      showPrinterPanel: false, showTicketPreview: false
    });
    this.loadCardNumbers();
  },

  onBackToOrders() {
    wx.navigateBack();
  },

  // ========== 打印机 ==========

  onPrintReceipt() {
    const { printOrderData, lastUsedPrinterId } = this.data;
    if (!printOrderData) return;

    if (printer.MOCK_PRINT) {
      this._showTicketPreview(printOrderData);
      return;
    }

    if (lastUsedPrinterId) {
      this._doPrint(printOrderData, lastUsedPrinterId, false);
    } else {
      this.onOpenPrinterPanel();
    }
  },

  onOpenPrinterPanel() {
    this.setData({
      showPrinterPanel: true, printers: [], printerSearching: false,
      printerConnecting: false, currentPrinter: null, printing: false
    });
    this.onSearchPrinters();
  },

  onClosePrinterPanel() {
    const { printOrderData } = this.data;
    this.setData({
      showPrinterPanel: false,
      result: printOrderData ? { orderNo: printOrderData.orderNo, cardNumber: printOrderData.cardNumber } : null
    });
  },

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

  async onSelectPrinter(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceName = e.currentTarget.dataset.deviceName;
    if (!deviceId) return;

    this.setData({ printerConnecting: true, currentPrinter: { deviceId, name: deviceName } });
    await this._doPrint(this.data.printOrderData, deviceId, true);
  },

  async _doPrint(orderData, deviceId, fromPanel) {
    if (!orderData) return;
    this.setData({ printing: true });

    const result = await printer.printReceipt(orderData, { deviceId });

    if (result.success) {
      this.setData({ printing: false, showPrinterPanel: false, printerConnecting: false });
      setTimeout(() => {
        this.onNewOrder();
        wx.showToast({ title: '打印成功', icon: 'success' });
      }, 600);
    } else {
      this.setData({ printing: false, printerConnecting: false });
      if (fromPanel) {
        wx.showToast({ title: result.error || '打印失败，请重试', icon: 'none' });
      } else {
        this.setData({ lastUsedPrinterId: '' });
        this.onOpenPrinterPanel();
      }
    }
  },

  onPreventClose() {},

  // ========== 模拟打印预览 ==========

  _showTicketPreview(orderData) {
    const amountYuan = ((orderData.amountFen || 0) / 100).toFixed(2);
    const scene = orderData.scene || (SCENE_CARD_PREFIX + orderData.cardNumber);
    const payLabel = orderData.paymentType === 'wechat' ? '微信支付' : '现金/扫码';
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.setData({
      showTicketPreview: true, ticketQrUrl: '',
      ticketData: { orderNo: orderData.orderNo, cardNumber: orderData.cardNumber || '', amountYuan, paymentLabel: payLabel, scene, time: timeStr }
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
    this.setData({ ticketQrUrl: `${FALLBACK_QR_API}?size=200x200&data=${encodeURIComponent(scene || '')}` });
  },

  onMockPrintDone() {
    this.setData({ showTicketPreview: false });
    setTimeout(() => {
      this.onNewOrder();
      wx.showToast({ title: '小票已打印', icon: 'success' });
    }, 600);
  },

  onClosePreview() {
    const { printOrderData } = this.data;
    this.setData({
      showTicketPreview: false,
      result: printOrderData ? { orderNo: printOrderData.orderNo, cardNumber: printOrderData.cardNumber } : null
    });
  }
});
