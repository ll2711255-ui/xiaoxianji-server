const api = require('../../../../utils/api');
const { formatMoney } = require('../../../../utils/util');
const auth = require('../../../../utils/auth');
const printer = require('../../../../utils/printer');
const { SCENE_CARD_PREFIX, FALLBACK_QR_API } = require('../../../../utils/constants');

Page({
  data: {
    orderNo: '',
    order: null,

    // 商品信息（从订单读取）
    productName: '',
    specTags: [],
    pricePerJin: 0,
    pricePerJinDisplay: '0.00',
    processingFee: 0,
    processingFeeDisplay: '0.00',
    prepayAmount: 0,
    prepayDisplay: '0.00',

    // 重量输入
    weightInput: '',
    weightGrams: 0,

    // 重量约束 & 校验
    weightConstraint: null,
    weightWarning: '',

    // 实时计算结果
    actualWeightJin: '0.00',
    actualAmount: 0,
    actualAmountDisplay: '0.00',
    refundAmount: 0,
    refundAmountDisplay: '0.00',
    showRefund: false,

    // 照片
    weighPhoto: '',
    weighPhotoFileId: '',
    photoUploading: false,

    // 号码牌
    cardNumbers: [],
    selectedCard: '',

    // 提交
    submitting: false,

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

  onLoad(options) {
    const orderNo = options.orderNo;
    if (!orderNo) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ orderNo });
  },

  async onShow() {
    if (!auth.checkMerchant()) return;
    await this.loadOrder();
    this.loadCardNumbers();
    if (!this.data.lastUsedPrinterId) {
      this.setData({ lastUsedPrinterId: printer.getLastPrinterId() || '' });
    }
  },

  onUnload() {
    printer.closeBluetooth();
  },

  async loadOrder() {
    try {
      const res = await api.get('/orders/' + this.data.orderNo);
      const d = (res && res.data) || res || {};
      const order = d.order;
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        return;
      }

      // 校验状态
      if (order.status !== 'accepted') {
        wx.showToast({ title: '订单状态不可称重', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      // 提取商品信息
      const item = (order.items && order.items[0]) || {};
      const spec = item.spec || {};

      // 构建规格标签
      const specTags = [];
      if (spec.type) specTags.push({ text: spec.type });
      if (spec.weight) specTags.push({ text: spec.weight });
      if (spec.processing) specTags.push({ text: spec.processing });

      // 单价取 spec.type_price_per_jin（锁定价），回退到 item.unitPrice
      const pricePerJin = spec.type_price_per_jin || item.unitPrice || 0;
      // 处理附加费（切块才有）
      const processingFee = spec.processing_fee || 0;
      const prepayAmount = order.prepayAmount || 0;

      // 构建重量输入约束
      const pricingType = item.pricingType || '';
      let weightConstraint = null;
      if (pricingType === 'range_weight') {
        const weightMax = spec.weight_max;
        if (weightMax && weightMax > 0) {
          const maxJin = (weightMax / 500).toFixed(2);
          weightConstraint = {
            type: 'max',
            value: weightMax,
            label: `最大不超过 ${weightMax}克（${maxJin}斤）`
          };
        }
      } else if (pricingType === 'exact_weight') {
        const targetGrams = spec.weightGrams;
        if (targetGrams && targetGrams > 0) {
          const targetJin = (targetGrams / 500).toFixed(2);
          weightConstraint = {
            type: 'equal',
            value: targetGrams,
            label: `须等于 ${targetGrams}克（${targetJin}斤）`
          };
        }
      }

      const existingCard = order.cardNumber || '';
      const setDataObj = {
        order,
        productName: item.productName || '',
        specTags,
        pricePerJin,
        pricePerJinDisplay: formatMoney(pricePerJin),
        processingFee,
        processingFeeDisplay: formatMoney(processingFee),
        prepayAmount,
        prepayDisplay: formatMoney(prepayAmount),
        weightConstraint,
        weightWarning: ''
      };
      if (!this._cardInitDone) {
        setDataObj.selectedCard = existingCard;
        this._cardInitDone = true;
      }

      this.setData(setDataObj);
    } catch (err) {
      console.error('加载订单失败:', err);
      wx.showToast({ title: '加载订单失败', icon: 'none' });
    }
  },

  // 重量输入（克）+ 实时校验
  onWeightInput(e) {
    const value = e.detail.value;
    const filtered = value.replace(/[^0-9]/g, '');
    this.setData({ weightInput: filtered });

    const grams = parseInt(filtered) || 0;
    this.setData({ weightGrams: grams });

    if (grams > 0) {
      this.calculate(grams);
    } else {
      this.setData({
        actualWeightJin: '0.00',
        actualAmount: 0,
        actualAmountDisplay: '0.00',
        refundAmount: 0,
        refundAmountDisplay: '0.00',
        showRefund: false
      });
    }

    // 实时校验重量约束
    let weightWarning = '';
    const constraint = this.data.weightConstraint;
    if (constraint && grams > 0) {
      if (constraint.type === 'max' && grams > constraint.value) {
        const maxJin = (constraint.value / 500).toFixed(2);
        weightWarning = `重量超出订单范围（最大${constraint.value}克/${maxJin}斤）`;
      } else if (constraint.type === 'equal' && grams !== constraint.value) {
        const diff = Math.abs(grams - constraint.value);
        const targetJin = (constraint.value / 500).toFixed(2);
        weightWarning = `重量须等于${constraint.value}克/${targetJin}斤（差${diff}克）`;
      }
    }
    this.setData({ weightWarning });
  },

  // 实时计算
  calculate(grams) {
    const { pricePerJin, processingFee, prepayAmount } = this.data;

    const actualWeightJin = (grams / 500).toFixed(2);

    const actualAmountFloat = (grams / 500) * pricePerJin + processingFee;
    const actualAmount = Math.floor(actualAmountFloat);

    const refundAmount = Math.max(0, prepayAmount - actualAmount);

    this.setData({
      actualWeightJin,
      actualAmount,
      actualAmountDisplay: formatMoney(actualAmount),
      refundAmount,
      refundAmountDisplay: formatMoney(refundAmount),
      showRefund: true
    });
  },

  // 选择照片
  onChoosePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        this.setData({ weighPhoto: res.tempFilePaths[0] });
      }
    });
  },

  // 删除照片
  onRemovePhoto() {
    this.setData({ weighPhoto: '', weighPhotoFileId: '' });
  },

  // ========== 号码牌选择 ==========

  async loadCardNumbers() {
    try {
      const res = await api.get('/pai-numbers');
      const allNumbers = (res && res.data && res.data.numbers) || [];
      this.setData({ cardNumbers: allNumbers });
    } catch (err) {
      console.error('加载号码牌失败:', err);
    }
  },

  onCardSelect(e) {
    const number = e.currentTarget.dataset.number;
    const card = this.data.cardNumbers.find(c => c.number === number);
    if (!card) return;
    const existingCard = (this.data.order && this.data.order.cardNumber) || '';
    const isAllowed = card.status === 'idle' || card.number === existingCard;
    if (!isAllowed) return;
    this.setData({ selectedCard: number === this.data.selectedCard ? '' : number });
  },

  // 提交称重
  onSubmit() {
    const { weightGrams, weighPhoto, order, weightWarning } = this.data;

    if (!weightGrams || weightGrams <= 0) {
      wx.showToast({ title: '请输入实际重量', icon: 'none' });
      return;
    }

    if (weightWarning) {
      wx.showToast({ title: weightWarning, icon: 'none' });
      return;
    }

    const actualWeightDisplay = weightGrams + '克（' + this.data.actualWeightJin + '斤）';
    let content = `确认称重信息？\n实际重量：${actualWeightDisplay}\n实际金额：¥${this.data.actualAmountDisplay}`;

    if (this.data.refundAmount > 0) {
      content += `\n将退款：¥${this.data.refundAmountDisplay} 给用户`;
    } else {
      content += '\n无需退款';
    }
    if (this.data.selectedCard) {
      content += `\n绑定号码牌：${this.data.selectedCard}`;
    }
    if (!this.data.weighPhoto) {
      content += '\n⚠ 未上传称重照片';
    }
    content += '\n确认后无法修改';

    wx.showModal({
      title: '确认称重',
      content,
      confirmText: '确认提交',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ submitting: true });

        try {
          // 上传照片到自建后端
          const app = getApp();
          const useMock = app && app.globalData && app.globalData.useMock;
          let photoUrl = weighPhoto;

          if (!useMock && weighPhoto && !weighPhoto.startsWith('cloud://') && !weighPhoto.startsWith('http')) {
            try {
              photoUrl = await api.upload('/upload/image', weighPhoto);
            } catch (uploadErr) {
              console.error('照片上传失败:', uploadErr);
              this.setData({ submitting: false });
              wx.showToast({ title: '照片上传失败，请重试', icon: 'none' });
              return;
            }
          }

          // 调用称重接口
          const result = await api.post('/merchant/orders/' + order.orderNo + '/weigh', {
            actualWeight: weightGrams,
            weighPhoto: photoUrl,
            cardNumber: this.data.selectedCard || order.cardNumber || '',
            pricePerJin: this.data.pricePerJin,
            processingFee: this.data.processingFee
          });

          this.setData({ submitting: false });

          const rd = (result && result.data) || result || {};
          if (result && result.success) {
            const refundAmount = rd.refundAmount || 0;
            const tips = refundAmount > 0
              ? `称重完成，已退款 ¥${formatMoney(refundAmount)}`
              : '称重完成';

            // 准备称重小票打印数据
            const printData = this._buildWeighPrintData(rd);
            this.setData({ printOrderData: printData });

            wx.showModal({
              title: '提交成功',
              content: tips + '\n\n是否打印称重小票？',
              confirmText: '打印小票',
              cancelText: '暂不打印',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  setTimeout(() => this.onPrintWeighReceipt(), 300);
                } else {
                  wx.navigateBack();
                }
              }
            });
          } else {
            wx.showToast({ title: (result && result.message) || '提交失败', icon: 'none', duration: 2500 });
          }
        } catch (err) {
          this.setData({ submitting: false });
          console.error('称重提交失败:', err);
          wx.showToast({ title: '提交失败，请重试', icon: 'none' });
        }
      }
    });
  },

  // ========== 称重小票打印 ==========

  _buildWeighPrintData(result) {
    const order = this.data.order || {};
    const item = (order.items && order.items[0]) || {};
    const spec = item.spec || {};

    const specParts = [];
    if (spec.type) specParts.push(spec.type);
    if (spec.processing) specParts.push(spec.processing);
    const specSummary = specParts.join('/');

    return {
      orderNo: order.orderNo || this.data.orderNo,
      cardNumber: result.cardNumber || order.cardNumber || '',
      type: order.type || 'pickup',
      productName: item.productName || this.data.productName,
      specSummary,
      actualWeight: this.data.weightGrams,
      pricePerJin: this.data.pricePerJin,
      actualAmount: this.data.actualAmount,
      refundAmount: this.data.refundAmount,
      scene: SCENE_CARD_PREFIX + (result.cardNumber || order.cardNumber || ''),
      shopName: '小鲜鸡'
    };
  },

  onPrintWeighReceipt() {
    const { printOrderData, lastUsedPrinterId } = this.data;
    if (!printOrderData) return;

    if (printer.MOCK_PRINT) {
      this._showWeighTicketPreview(printOrderData);
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
      currentPrinter: null,
      printing: false
    });
    this.onSearchPrinters();
  },

  onClosePrinterPanel() {
    this.setData({ showPrinterPanel: false });
  },

  onPreventClose() {},

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
      wx.showToast({ title: '打印成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } else {
      this.setData({ printing: false, printerConnecting: false });
      if (fromPanel) {
        wx.showToast({ title: result.error || '打印失败', icon: 'none' });
      } else {
        this.setData({ lastUsedPrinterId: '' });
        this.onOpenPrinterPanel();
      }
    }
  },

  // ========== 模拟打印预览 ==========

  _showWeighTicketPreview(orderData) {
    const actualWeightJin = orderData.actualWeight ? (orderData.actualWeight / 500).toFixed(2) : '0.00';
    const actualAmountYuan = ((orderData.actualAmount || 0) / 100).toFixed(2);
    const refundAmountYuan = ((orderData.refundAmount || 0) / 100).toFixed(2);
    const hasRefund = orderData.refundAmount > 0;
    const pricePerJinYuan = orderData.pricePerJin ? (orderData.pricePerJin / 100).toFixed(2) : '--';
    const typeLabel = orderData.type === 'delivery' ? '配送上门' : orderData.type === 'pickup' ? '到店自取' : '线下订单';
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.setData({
      showTicketPreview: true,
      ticketQrUrl: '',
      ticketData: {
        orderNo: orderData.orderNo,
        cardNumber: orderData.cardNumber || '',
        typeLabel,
        productName: orderData.productName || '',
        specSummary: orderData.specSummary || '',
        actualWeightGrams: orderData.actualWeight || 0,
        actualWeightJin,
        pricePerJinYuan,
        actualAmountYuan,
        refundAmountYuan,
        hasRefund,
        scene: orderData.scene || '',
        time: timeStr
      }
    });

    this._loadCodeImage(orderData.cardNumber, orderData.scene);
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
    setTimeout(() => wx.navigateBack(), 800);
  },

  onClosePreview() {
    this.setData({ showTicketPreview: false });
    wx.navigateBack();
  }
});
