/**
 * 打印机面板可复用 Behavior
 *
 * 封装蓝牙打印机搜索、连接、打印、小票预览等通用逻辑，
 * 商家端各页面通过 mixin 引入，消除重复代码。
 *
 * 使用方式：
 *   const printerBehavior = require('../../utils/printerBehavior');
 *   Page({
 *     behaviors: [printerBehavior],
 *     // 页面只需提供 _buildPrintData() 方法返回打印数据
 *     // 以及 onPrintDone() 回调处理打印完成后的逻辑
 *   });
 *
 * 页面需在 wxml 中引入 printer-panel 模板：
 *   <import src="../../utils/printer-panel.wxml" />
 *   <template is="printer-panel" data="{{...printerPanelData}}" />
 *
 * 页面需在 wxss 中引入样式：
 *   @import '../../utils/printer-panel.wxss';
 */

const printer = require('./printer');
const api = require('./api');
const { SCENE_CARD_PREFIX, FALLBACK_QR_API } = require('./constants');

/**
 * 构建小票预览数据（页面可覆盖）
 * @param {object} orderData - 打印原始数据
 * @returns {object}
 */
function _buildTicketPreviewData(orderData) {
  const amountYuan = ((orderData.amountFen || 0) / 100).toFixed(2);
  const scene = orderData.scene || (SCENE_CARD_PREFIX + orderData.cardNumber);
  const payLabel = orderData.paymentType === 'wechat' ? '微信支付'
    : orderData.paymentType === 'unpaid' ? '未支付'
    : orderData.paymentType === 'cash' ? '现金/扫码'
    : '';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    orderNo: orderData.orderNo,
    cardNumber: orderData.cardNumber || '',
    amountYuan,
    paymentLabel: payLabel,
    scene,
    time: timeStr,
    // 称重小票扩展字段
    typeLabel: orderData.typeLabel || '',
    productName: orderData.productName || '',
    specSummary: orderData.specSummary || '',
    actualWeightGrams: orderData.actualWeightGrams || orderData.actualWeight || 0,
    actualWeightJin: orderData.actualWeightJin || '',
    pricePerJinYuan: orderData.pricePerJinYuan || '',
    actualAmountYuan: orderData.actualAmountYuan || '',
    refundAmountYuan: orderData.refundAmountYuan || '',
    hasRefund: orderData.hasRefund || false,
    isWeighTicket: orderData.isWeighTicket || false
  };
}

module.exports = Behavior({
  data: {
    // 打印机面板
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

  lifetimes: {
    attached() {
      // 恢复上次使用的打印机 ID
      if (!this.data.lastUsedPrinterId) {
        this.setData({ lastUsedPrinterId: printer.getLastPrinterId() || '' });
      }
    },

    detached() {
      printer.closeBluetooth();
    }
  },

  methods: {
    // ========== 打印入口 ==========

    /**
     * 触发打印（页面调用）
     * 模拟模式 → 小票预览；真实模式 → 历史打印机秒连 / 弹出选择面板
     */
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

    /**
     * 构建打印数据（页面必须覆盖此方法）
     * @returns {object|null}
     */
    _buildPrintData() {
      return this.data.printOrderData;
    },

    /**
     * 打印完成回调（页面可覆盖）
     */
    _onPrintDone() {
      // 默认：关闭面板，显示 toast
      wx.showToast({ title: '小票已打印', icon: 'success' });
    },

    // ========== 打印机面板 ==========

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

    onClosePrinterPanel() {
      this.setData({ showPrinterPanel: false });
    },

    onPreventClose() {
      // 阻止弹窗穿透
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

      await this._doPrint(this.data.printOrderData, deviceId, true);
    },

    // ========== 内部打印执行 ==========

    /**
     * @param {object} orderData
     * @param {string} deviceId
     * @param {boolean} fromPanel - 是否从选择面板触发
     */
    async _doPrint(orderData, deviceId, fromPanel) {
      if (!orderData) return;

      this.setData({ printing: true });

      const result = await printer.printReceipt(orderData, { deviceId });

      if (result.success) {
        this.setData({
          printing: false,
          showPrinterPanel: false,
          printerConnecting: false
        });
        this._onPrintDone();
      } else {
        this.setData({
          printing: false,
          printerConnecting: false
        });
        if (fromPanel) {
          wx.showToast({ title: result.error || '打印失败，请重试', icon: 'none' });
        } else {
          // 快速模式失败 → 打开选择面板让用户手动选择
          this.setData({ lastUsedPrinterId: '' });
          this.onOpenPrinterPanel();
        }
      }
    },

    // ========== 模拟打印预览 ==========

    /**
     * 显示小票预览弹窗（模拟打印）
     */
    _showTicketPreview(orderData) {
      const ticketData = _buildTicketPreviewData(orderData);

      this.setData({
        showTicketPreview: true,
        ticketQrUrl: '',
        ticketData
      });

      // 异步加载小程序码图片
      this._loadCodeImage(orderData.cardNumber, orderData.scene);
    },

    /**
     * 加载号码牌对应的小程序码图片
     */
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
      this._onPrintDone();
    },

    onClosePreview() {
      this.setData({ showTicketPreview: false });
    }
  }
});
