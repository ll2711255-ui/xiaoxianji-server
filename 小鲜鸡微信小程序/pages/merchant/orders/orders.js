const api = require('../../../utils/api');
const { formatMoney, formatTimeAgo, getStatusText } = require('../../../utils/util');
const { getOnlineOrderActions, ACTION_LABELS } = require('../../../utils/orderActions');
const printer = require('../../../utils/printer');
const auth = require('../../../utils/auth');
const { SCENE_CARD_PREFIX, FALLBACK_QR_API } = require('../../../utils/constants');

const TABS = ['新订单', '称重挂牌', '处理中', '配送/待取货', '已完成', '退款异常'];
const OFFLINE_TABS = ['新增订单', '处理中', '待取货', '已完成'];

// 线上 Tab 索引 → 查询状态列表
const TAB_STATUS_QUERIES = [
  { statuses: ['paid'],                        single: true  },  // 0: 新订单
  { statuses: ['accepted'],                    single: true  },  // 1: 称重挂牌
  { statuses: ['weighed', 'processing'],       single: false },  // 2: 处理中
  { statuses: ['ready', 'delivering'],         single: false },  // 3: 配送/待取货
  { statuses: ['completed'],                   single: true  },  // 4: 已完成
  { statuses: ['refundFailed'],                single: true  }   // 5: 退款异常
];

Page({
  data: {
    segment: 'online',     // online | offline
    tabIndex: 0,
    tabs: TABS,
    orders: [],
    loading: false,
    // 配送/待取货 子 tabs
    deliverySubTab: 0,      // 0=配送订单, 1=自取订单
    deliveryOrders: [],     // 配送中订单
    pickupOrders: [],       // 待取货订单
    offlineTabIndex: 0,
    offlineTabs: OFFLINE_TABS,
    offlineOrders: [],
    loadingOff: false,
    statCards: [
      { key: 'paid',       label: '新订单',   count: 0 },
      { key: 'accepted',   label: '称重挂牌',   count: 0 },
      { key: 'processing', label: '处理中',   count: 0 },
      { key: 'delivering', label: '配送/待取货', count: 0 },
      { key: 'completed',  label: '已完成',   count: 0 },
      { key: 'refundFailed', label: '退款异常', count: 0 }
    ],
    offlineStats: [
      { key: 'processing', label: '处理中', count: 0 },
      { key: 'ready',      label: '待取货', count: 0 },
      { key: 'completed',  label: '已完成', count: 0 }
    ],
    // 收银表单
    offlineAmount: '',
    offlineAmountDisplay: '0.00',
    offlinePaymentType: 'cash',
    offlineSelectedCard: '',
    offlineCardNumbers: [],
    offlineSubmitting: false,
    offlineResult: null,
    // 计算器
    showCalculator: false,
    calcDisplay: '0',
    calcExpression: '',
    calcPending: null,
    calcFresh: true,
    // 打印机
    showPrinterPanel: false,
    printers: [],
    printerSearching: false,
    printerConnecting: false,
    printerConnected: false,
    currentPrinter: null,
    printing: false,
    printOrderData: null,
    lastUsedPrinterId: '',
    // 模拟打印预览
    showTicketPreview: false,
    ticketData: {},
    ticketQrUrl: ''
  },

  _pollTimer: null,

  onShow() {
    if (!auth.checkMerchant()) return;
    if (this.data.segment === 'online') {
      this.loadOrders(true);
      this.loadStats();
      this._startPolling();
    } else {
      this.loadOfflineStats();
      if (this.data.offlineTabIndex === 0) {
        this.loadOfflineCardNumbers();
      } else {
        this.loadOfflineOrders(true);
      }
    }
  },

  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
    printer.closeBluetooth();
  },

  onPullDownRefresh() {
    let promise;
    if (this.data.segment === 'online') {
      promise = Promise.all([this.loadOrders(true), this.loadStats()]);
    } else {
      promise = this.data.offlineTabIndex === 0
        ? Promise.all([this.loadOfflineCardNumbers(), this.loadOfflineStats()])
        : Promise.all([this.loadOfflineOrders(true), this.loadOfflineStats()]);
    }
    promise.then(() => wx.stopPullDownRefresh());
  },

  // ---- 段切换 ----
  onSegmentTap(e) {
    const seg = e.currentTarget.dataset.seg;
    if (seg === this.data.segment) return;
    this.setData({ segment: seg });
    if (seg === 'online') {
      this.loadOrders(true);
      this.loadStats();
      this._startPolling();
    } else {
      this._stopPolling();
      this.loadOfflineStats();
      if (this.data.offlineTabIndex === 0) {
        this.loadOfflineCardNumbers();
      } else {
        this.loadOfflineOrders(true);
      }
    }
  },

  // ---- 线上子 Tab ----
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.tabIndex) return;
    this.setData({ tabIndex: index });
    this.loadOrders(true);
    // 仅新订单 Tab 开启轮询
    if (index === 0) {
      this._startPolling();
    } else {
      this._stopPolling();
    }
  },

  // ---- 配送/待取货 子 Tab ----
  onDeliverySubTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.deliverySubTab) return;
    this.setData({
      deliverySubTab: index,
      orders: index === 0 ? this.data.deliveryOrders : this.data.pickupOrders
    });
  },

  // ---- 线下子 Tab ----
  onOfflineTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.offlineTabIndex) return;
    this.setData({ offlineTabIndex: index });
    if (index === 0) {
      this.loadOfflineCardNumbers();
    } else {
      this.loadOfflineOrders(true);
    }
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/merchant/' + key + '/' + key });
  },

  // ---- 新订单轮询 ----
  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      this._pollNewOrders();
    }, 30000);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async _pollNewOrders() {
    if (this.data.tabIndex !== 0 || this.data.segment !== 'online') return;
    try {
      const res = await api.get('/merchant/orders', { status: 'paid', pageSize: 50, type: 'online' });
      const incoming = (res && res.data && res.data.orders) || [];
      const oldIds = new Set(this.data.orders.map(o => o._id));
      const newCount = incoming.filter(o => !oldIds.has(o._id)).length;
      if (newCount > 0) {
        wx.showToast({ title: newCount + '笔新订单', icon: 'none', duration: 2000 });
        this.loadOrders(true);
        this.loadStats();
      }
    } catch (err) {
      // silent poll
    }
  },

  async loadStats() {
    try {
      const [paid, accepted, weighed, processing, delivering, ready, completed, refundFailed] = await Promise.all([
        api.get('/merchant/orders', { status: 'paid', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'accepted', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'weighed', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'processing', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'delivering', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'ready', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'completed', pageSize: 200, type: 'online' }),
        api.get('/merchant/orders', { status: 'refundFailed', pageSize: 200, type: 'online' })
      ]);
      const getOrders = (res) => (res && res.data && res.data.orders) || [];
      this.setData({
        'statCards[0].count': getOrders(paid).length,
        'statCards[1].count': getOrders(accepted).length,
        'statCards[2].count': getOrders(weighed).length + getOrders(processing).length,
        'statCards[3].count': getOrders(delivering).length + getOrders(ready).length,
        'statCards[4].count': getOrders(completed).length,
        'statCards[5].count': getOrders(refundFailed).length
      });
    } catch (err) {
      // stats load silently fail
    }
  },

  /**
   * 格式化订单列表项（线上订单通用）
   */
  _formatOnlineOrder(order) {
    const actions = getOnlineOrderActions(order);
    return {
      ...order,
      prepayDisplay: formatMoney(order.prepayAmount || 0),
      actualDisplay: formatMoney(order.actualAmount || 0),
      refundDisplay: formatMoney((order.refundInfo && order.refundInfo.refundAmount) || order.refundAmount || 0),
      statusText: actions.statusText,
      timeAgo: formatTimeAgo(order.createTime),
      typeLabel: order.type === 'delivery' ? '配送' : '自取',
      ...actions,
      distance: order.distance || 0,
      distanceDisplay: order.distance ? '约' + order.distance.toFixed(1) + 'km' : ''
    };
  },

  async loadOrders(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const ti = this.data.tabIndex;
      const query = TAB_STATUS_QUERIES[ti];
      if (!query) { this.setData({ loading: false }); return; }

      // 查询订单（单状态用单个请求，多状态用并行请求）
      const responses = query.single
        ? [await api.get('/merchant/orders', { status: query.statuses[0], pageSize: 50, type: 'online' })]
        : await Promise.all(query.statuses.map(s =>
            api.get('/merchant/orders', { status: s, pageSize: 50, type: 'online' })
          ));

      const results = responses.flatMap(r => (r && r.data && r.data.orders) || []);

      // Tab 3 特殊处理：配送/自取拆分
      if (ti === 3) {
        const formatted = results.map(o => this._formatOnlineOrder(o));
        const deliveryOrders = formatted.filter(o => o.type === 'delivery');
        const pickupOrders = formatted.filter(o => o.type === 'pickup');

        this.setData({
          deliveryOrders,
          pickupOrders,
          orders: this.data.deliverySubTab === 0 ? deliveryOrders : pickupOrders,
          loading: false
        });
        return;
      }

      const orders = results.map(o => this._formatOnlineOrder(o));
      this.setData({ orders, loading: false });
    } catch (err) {
      console.error('加载订单失败:', err);
      this.setData({ loading: false });
    }
  },

  // ---- 线下订单 ----
  async loadOfflineStats() {
    try {
      const [processing, ready, completed] = await Promise.all([
        api.get('/merchant/orders', { status: 'processing', pageSize: 200, type: 'offline' }),
        api.get('/merchant/orders', { status: 'ready', pageSize: 200, type: 'offline' }),
        api.get('/merchant/orders', { status: 'completed', pageSize: 200, type: 'offline' })
      ]);
      const getOrders = (res) => (res && res.data && res.data.orders) || [];
      this.setData({
        'offlineStats[0].count': getOrders(processing).length,
        'offlineStats[1].count': getOrders(ready).length,
        'offlineStats[2].count': getOrders(completed).length
      });
    } catch (err) {
      // silent
    }
  },

  async loadOfflineOrders(reset = false) {
    if (this.data.loadingOff) return;
    this.setData({ loadingOff: true });

    try {
      const ti = this.data.offlineTabIndex;
      let results = [];

      // Tab 0 只有收银打单，不加载订单列表
      if (ti === 1) {
        const res = await api.get('/merchant/orders', { status: 'processing', pageSize: 100, type: 'offline' });
        results = (res && res.data && res.data.orders) || [];
      } else if (ti === 2) {
        const res = await api.get('/merchant/orders', { status: 'ready', pageSize: 100, type: 'offline' });
        results = (res && res.data && res.data.orders) || [];
      } else {
        // ti === 3：已完成
        const res = await api.get('/merchant/orders', { status: 'completed', pageSize: 100, type: 'offline' });
        results = (res && res.data && res.data.orders) || [];
      }

      const orders = results.map(order => ({
        ...order,
        prepayDisplay: formatMoney(order.prepayAmount || order.actualAmount || 0),
        statusText: order.status === 'paid' ? '已收款' : getStatusText(order.status, order.type),
        canProcess: order.status === 'paid',
        canReady: order.status === 'processing',
        canComplete: (order.status === 'ready' || order.status === 'paid') && order.paymentType !== 'unpaid',
        canCancel: order.status === 'processing' || order.status === 'ready',
        canMarkPaid: order.status === 'ready' && order.paymentType === 'unpaid'
      }));

      this.setData({ offlineOrders: orders, loadingOff: false });
    } catch (err) {
      console.error('加载线下订单失败:', err);
      this.setData({ loadingOff: false });
    }
  },

  onAddOffline() {
    this.setData({ offlineTabIndex: 0 });
    this.loadOfflineCardNumbers();
  },

  // ---- 收银 ----
  async loadOfflineCardNumbers() {
    try {
      const res = await api.get('/pai-numbers');
      this.setData({ offlineCardNumbers: (res && res.data && res.data.numbers) || [] });
    } catch (err) {
      console.error('加载号码牌失败:', err);
    }
  },

  // ---- 计算器 ----
  onOpenCalculator() {
    const amt = this.data.offlineAmount;
    this.setData({
      showCalculator: true,
      calcDisplay: amt || '0',
      calcExpression: '',
      calcPending: null,
      calcFresh: !amt
    });
  },

  onCloseCalculator() {
    this.setData({ showCalculator: false });
  },

  onPreventClose() {
    // 阻止事件冒泡到 overlay 层
  },

  onCalcKey(e) {
    const key = e.currentTarget.dataset.key;
    let { calcDisplay: display, calcExpression: expr, calcPending: pending, calcFresh: fresh } = this.data;

    if (key === 'C') {
      this.setData({ calcDisplay: '0', calcExpression: '', calcPending: null, calcFresh: true });
      return;
    }

    if (key === '⌫') {
      if (fresh) {
        if (pending) {
          this.setData({
            calcDisplay: pending.value.toString(),
            calcExpression: '',
            calcPending: null,
            calcFresh: false
          });
        }
        return;
      }
      display = display.slice(0, -1);
      if (!display || display === '' || display === '-') {
        display = '0';
        fresh = true;
      }
      if (expr) expr = expr.slice(0, -1);
      if (!expr) { pending = null; }
      this.setData({ calcDisplay: display, calcExpression: expr, calcPending: pending, calcFresh: fresh });
      return;
    }

    const ops = ['+', '-', '×', '÷'];

    if (ops.includes(key)) {
      const num = parseFloat(display);
      if (isNaN(num)) return;
      if (pending) {
        const result = this._calcEval(pending.value, num, pending.op);
        expr = result.toString();
        display = result.toString();
      } else {
        expr = display;
      }
      this.setData({
        calcDisplay: display,
        calcExpression: expr + ' ' + key + ' ',
        calcPending: { value: parseFloat(display), op: key },
        calcFresh: true
      });
      return;
    }

    if (key === '=') {
      if (!pending) return;
      const num = parseFloat(display);
      if (isNaN(num)) return;
      const result = this._calcEval(pending.value, num, pending.op);
      this.setData({
        calcDisplay: result.toString(),
        calcExpression: expr + ' ' + display + ' =',
        calcPending: null,
        calcFresh: true
      });
      return;
    }

    // digit or decimal
    if (key === '.') {
      if (display.includes('.')) return;
    }
    if (fresh) {
      display = key;
      fresh = false;
    } else {
      if (display.replace('.', '').length >= 9) return;
      display += key;
    }
    const newExpr = pending ? expr : '';
    this.setData({ calcDisplay: display, calcExpression: newExpr, calcFresh: fresh });
  },

  _calcEval(a, b, op) {
    switch (op) {
      case '+': return Math.round((a + b) * 100) / 100;
      case '-': return Math.round((a - b) * 100) / 100;
      case '×': return Math.round((a * b) * 100) / 100;
      case '÷': return b === 0 ? 0 : Math.round((a / b) * 100) / 100;
      default: return b;
    }
  },

  onCalcConfirm() {
    const display = parseFloat(this.data.calcDisplay);
    if (isNaN(display) || display <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    const amount = display.toFixed(2);
    this.setData({
      offlineAmount: display.toString(),
      offlineAmountDisplay: amount,
      showCalculator: false
    });
  },

  onOfflinePaymentType(e) {
    this.setData({ offlinePaymentType: e.currentTarget.dataset.type });
  },

  onOfflineCardSelect(e) {
    const number = e.currentTarget.dataset.number;
    const card = this.data.offlineCardNumbers.find(c => c.number === number);
    if (!card || card.status !== 'idle') return;
    this.setData({ offlineSelectedCard: number === this.data.offlineSelectedCard ? '' : number });
  },

  onOfflineSubmit() {
    const { offlineAmount: amount, offlinePaymentType: paymentType, offlineSelectedCard: selectedCard, offlineAmountDisplay: amountDisplay } = this.data;
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
      title: '确认打单',
      content: `金额：¥${amountDisplay}\n付款方式：${paymentType === 'cash' ? '现金/扫码' : paymentType === 'wechat' ? '微信' : '未支付'}\n号码牌：${selectedCard}`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ offlineSubmitting: true });
        try {
          const result = await api.post('/merchant/offline-orders', {
            amount: amountFen,
            cardNumber: selectedCard,
            paymentType
          });
          const d = (result && result.data) || result || {};
          if (!d.orderNo) {
            this.setData({ offlineSubmitting: false });
            wx.showToast({ title: '创建订单超时，请重试', icon: 'none' });
            return;
          }
          // 自动进入处理中
          await api.post('/merchant/orders/' + d.orderNo + '/process');
          // 保存打印数据
          const printData = {
            orderNo: d.orderNo,
            cardNumber: selectedCard,
            amountFen: amountFen,
            scene: SCENE_CARD_PREFIX + selectedCard,
            paymentType
          };
          this.setData({
            offlineSubmitting: false,
            printOrderData: printData,
            lastUsedPrinterId: printer.getLastPrinterId() || ''
          });
          this.loadOfflineOrders(true);
          this.loadOfflineStats();
          // 直接触发打印
          this.onPrintReceipt();
        } catch (err) {
          console.error('创建订单失败:', err);
          this.setData({ offlineSubmitting: false });
          wx.showToast({ title: '创建失败', icon: 'none' });
        }
      }
    });
  },

  onOfflineNewOrder() {
    this.setData({
      offlineAmount: '',
      offlineAmountDisplay: '0.00',
      offlinePaymentType: 'cash',
      offlineSelectedCard: '',
      offlineResult: null,
      printOrderData: null,
      showPrinterPanel: false,
      showTicketPreview: false,
      showCalculator: false,
      calcDisplay: '0',
      calcExpression: '',
      calcPending: null,
      calcFresh: true
    });
    this.loadOfflineCardNumbers();
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
      showPrinterPanel: true,
      printers: [],
      printerSearching: false,
      printerConnecting: false,
      printerConnected: false,
      currentPrinter: null,
      printing: false
    });
    this.onSearchPrinters();
  },

  onClosePrinterPanel() {
    const { printOrderData } = this.data;
    this.setData({
      showPrinterPanel: false,
      offlineResult: printOrderData ? { orderNo: printOrderData.orderNo, cardNumber: printOrderData.cardNumber } : null
    });
  },

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
      if (devices.length === 0) {
        wx.showToast({ title: '未发现蓝牙打印机，请确认打印机已开机', icon: 'none', duration: 2000 });
      }
    }).catch(() => {
      this.setData({ printerSearching: false });
    });
  },

  async onSelectPrinter(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceName = e.currentTarget.dataset.deviceName;
    if (!deviceId) return;

    this.setData({
      printerConnecting: true,
      currentPrinter: { deviceId, name: deviceName }
    });

    const { printOrderData } = this.data;
    await this._doPrint(printOrderData, deviceId, true);
  },

  async _doPrint(orderData, deviceId, fromPanel) {
    if (!orderData) return;

    this.setData({ printing: true });

    const result = await printer.printReceipt(orderData, { deviceId });

    if (result.success) {
      this.setData({
        printing: false,
        showPrinterPanel: false,
        printerConnecting: false,
        printerConnected: false
      });
      setTimeout(() => {
        this.onOfflineNewOrder();
        wx.showToast({ title: '打印成功', icon: 'success' });
      }, 600);
    } else {
      this.setData({
        printing: false,
        printerConnecting: false
      });
      if (fromPanel) {
        wx.showToast({ title: result.error || '打印失败，请重试', icon: 'none', duration: 2000 });
      } else {
        this.setData({ lastUsedPrinterId: '' });
        this.onOpenPrinterPanel();
      }
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
    const qrUrl = `${FALLBACK_QR_API}?size=200x200&data=${encodeURIComponent(scene || '')}`;
    this.setData({ ticketQrUrl: qrUrl });
  },

  onMockPrintDone() {
    this.setData({ showTicketPreview: false });
    wx.showToast({ title: '小票已打印', icon: 'success' });
    setTimeout(() => {
      this.onOfflineNewOrder();
    }, 800);
  },

  onClosePreview() {
    const { printOrderData } = this.data;
    this.setData({
      showTicketPreview: false,
      offlineResult: printOrderData ? { orderNo: printOrderData.orderNo, cardNumber: printOrderData.cardNumber } : null
    });
  },

  // ---- 通用 ----
  onOrderTap(e) {
    const orderNo = e.currentTarget.dataset.orderNo;
    wx.navigateTo({ url: `/pages/merchant/orders/detail/detail?orderNo=${orderNo}` });
  },

  onReject(e) {
    const orderNo = e.currentTarget.dataset.orderNo;
    wx.showModal({
      title: '拒绝订单',
      content: '确定要拒绝此订单吗？款项将全额原路退回。',
      confirmText: '拒绝',
      confirmColor: '#A83108',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.post('/orders/' + orderNo + '/cancel');
          wx.showToast({ title: '已拒绝', icon: 'success' });
          this.loadOrders(true);
          this.loadStats();
        } catch (err) {
          console.error('拒单失败:', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  onAction(e) {
    const { orderNo, action } = e.currentTarget.dataset;
    if (action === 'weigh') {
      wx.navigateTo({ url: `/pages/merchant/orders/detail/detail?orderNo=${orderNo}&action=weigh` });
      return;
    }

    if (action === 'retryRefund') {
      const currentOrder = this.data.orders.find(o => o.orderNo === orderNo) || {};
      const refundInfo = currentOrder.refundInfo || {};
      const refundAmount = refundInfo.refundAmount || currentOrder.refundAmount || 0;

      wx.showModal({
        title: '重新发起退款',
        content: `确定要重新发起退款吗？\n退款金额：¥${formatMoney(refundAmount)}`,
        confirmText: '确认退款',
        success: async (res) => {
          if (!res.confirm) return;
          wx.showLoading({ title: '退款中...' });
          try {
            const result = await api.post('/merchant/orders/' + orderNo + '/refund', {
              actualWeight: (currentOrder.weighInfo && currentOrder.weighInfo.actualWeight) || currentOrder.actualWeight || 0,
              weighPhoto: (currentOrder.weighInfo && currentOrder.weighInfo.weighPhoto) || currentOrder.weighPhoto || '',
              cardNumber: currentOrder.cardNumber || (currentOrder.weighInfo && currentOrder.weighInfo.cardNumber) || ''
            });
            wx.hideLoading();
            if (result && result.success) {
              wx.showToast({ title: '退款成功', icon: 'success' });
            } else {
              wx.showToast({ title: (result && result.message) || '退款失败', icon: 'none' });
            }
            this.loadOrders(true);
            this.loadStats();
          } catch (err) {
            wx.hideLoading();
            console.error('重新退款失败:', err);
            wx.showToast({ title: '退款失败，请重试', icon: 'none' });
          }
        }
      });
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
            await api.post('/orders/' + orderNo + '/cancel');
            wx.showToast({ title: '已取消', icon: 'success' });
            if (this.data.segment === 'online') {
              this.loadOrders(true);
              this.loadStats();
            } else {
              this.loadOfflineOrders(true);
              this.loadOfflineStats();
            }
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
            await api.post('/merchant/orders/' + orderNo + '/mark-paid');
            wx.showToast({ title: '已标记为已支付', icon: 'success' });
            const list = this.data.offlineOrders;
            const idx = list.findIndex(o => o.orderNo === orderNo);
            if (idx !== -1) {
              this.setData({
                ['offlineOrders[' + idx + '].paymentType']: 'cash',
                ['offlineOrders[' + idx + '].canComplete']: true,
                ['offlineOrders[' + idx + '].canMarkPaid']: false
              });
            }
            this.loadOfflineStats();
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
          await api.post('/merchant/orders/' + orderNo + '/' + action);
          wx.showToast({ title: '操作成功', icon: 'success' });
          if (this.data.segment === 'online') {
            this.loadOrders(true);
            this.loadStats();
          } else {
            this.loadOfflineOrders(true);
            this.loadOfflineStats();
          }
        } catch (err) {
          console.error('操作失败:', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  }
});
