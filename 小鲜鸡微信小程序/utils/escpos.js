/**
 * ESC/POS 热敏打印机指令构建器
 *
 * 生成标准 ESC/POS 字节指令，兼容市面上主流 58mm 热敏打印机
 * （芯烨 XPrinter、容大 Rongta、Epson 兼容机型等）。
 *
 * 全部函数返回 ArrayBuffer，通过 concatArrayBuffers() 拼接后发送。
 *
 * ========== 编码说明 ==========
 * 大部分国产 58mm 热敏打印机默认使用 GBK/GB2312 编码处理中文。
 * 本模块优先使用 GBK 编码；若小程序环境不支持 TextEncoder('gbk')，
 * 则回退为 UTF-8（多数新打印机也支持），最后回退为逐字节编码。
 *
 * 参考：EPSON ESC/POS Application Programming Guide
 *       XPrinter Programming Manual
 */

// ========== 基础指令常量 ==========

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const FF  = 0x0C;
const HT  = 0x09;
const CR  = 0x0D;

/** 对齐方式 */
const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 };

/** 文字大小倍率 */
const TEXT_SIZE = { NORMAL: 0x00, DOUBLE_H: 0x11, DOUBLE_W: 0x20, DOUBLE_HW: 0x30 };

/** 下划线样式 */
const UNDERLINE = { NONE: 0, SINGLE: 1, DOUBLE: 2 };

// ========== 二进制拼接工具 ==========

/**
 * 将多个 ArrayBuffer 合并为一个
 */
function concatArrayBuffers(buffers) {
  if (!buffers || buffers.length === 0) return new ArrayBuffer(0);
  if (buffers.length === 1) return buffers[0];
  const totalLen = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  buffers.forEach(buf => {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  });
  return result.buffer;
}

/**
 * 从字节数组创建 ArrayBuffer
 */
function bytesToBuffer(bytes) {
  return new Uint8Array(bytes).buffer;
}

// ========== 字符编码 ==========

/** 编码探测缓存 */
let _gbkEncoder = null;
let _gbkChecked = false;

/**
 * 检查 GBK TextEncoder 是否可用
 */
function _checkGbkEncoder() {
  if (_gbkChecked) return _gbkEncoder;
  _gbkChecked = true;
  try {
    if (typeof TextEncoder !== 'undefined') {
      // 尝试创建 GBK 编码器
      const encoder = new TextEncoder('gbk');
      _gbkEncoder = encoder;
    }
  } catch (_) {}
  // 某些环境可能需要 'gb2312'
  if (!_gbkEncoder) {
    try {
      if (typeof TextEncoder !== 'undefined') {
        _gbkEncoder = new TextEncoder('gb2312');
      }
    } catch (_) {}
  }
  return _gbkEncoder;
}

/**
 * 字符串转字节数组
 *
 * 编码优先级：GBK > UTF-8 TextEncoder > 回退逐字编码
 * 大多数国产 58mm 热敏打印机默认使用 GBK，但新机型也支持 UTF-8。
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
function stringToBytes(str) {
  if (!str) return new Uint8Array(0);

  // 1. 优先使用 GBK（国产打印机原生支持）
  const gbkEnc = _checkGbkEncoder();
  if (gbkEnc) {
    try {
      return gbkEnc.encode(str);
    } catch (_) {}
  }

  // 2. 使用默认 TextEncoder（UTF-8）
  if (typeof TextEncoder !== 'undefined') {
    try {
      return new TextEncoder().encode(str);
    } catch (_) {}
  }

  // 3. 回退：逐字编码
  const arr = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7F) {
      arr.push(code);
    } else if (code <= 0x7FF) {
      arr.push(0xC0 | (code >> 6));
      arr.push(0x80 | (code & 0x3F));
    } else {
      arr.push(0xE0 | (code >> 12));
      arr.push(0x80 | ((code >> 6) & 0x3F));
      arr.push(0x80 | (code & 0x3F));
    }
  }
  return new Uint8Array(arr);
}

/**
 * 计算字符串的显示宽度（中文=2，英文/数字=1）
 * @param {string} str
 * @returns {number}
 */
function displayWidth(str) {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    width += (str.charCodeAt(i) > 0x7F) ? 2 : 1;
  }
  return width;
}

// ========== 公开指令生成函数 ==========

/**
 * 初始化打印机（ESC @）
 * 清除打印缓冲区，恢复默认设置
 */
function init() {
  return bytesToBuffer([ESC, 0x40]);
}

/**
 * 设置对齐方式
 * @param {number} alignment - 0=左 1=中 2=右
 */
function align(alignment) {
  return bytesToBuffer([ESC, 0x61, alignment]);
}

/**
 * 设置文字格式
 * @param {object} opts
 * @param {boolean} [opts.bold] - 加粗
 * @param {boolean} [opts.doubleH] - 倍高
 * @param {boolean} [opts.doubleW] - 倍宽
 * @param {number}  [opts.underline] - 下划线 0=无 1=单线 2=双线
 * @param {boolean} [opts.invert] - 反白
 * @param {boolean} [opts.upsideDown] - 倒置
 */
function textStyle(opts = {}) {
  const buffers = [];

  // ESC ! n — 字符模式（加粗/倍高/倍宽/下划线/倒置组合）
  let n = 0x00;
  if (opts.bold) n |= 0x08;
  if (opts.doubleH) n |= 0x10;
  if (opts.doubleW) n |= 0x20;
  if (opts.underline) n |= 0x80; // 单下划线（双下划线用 ESC - 单独设）
  if (opts.upsideDown) n |= 0x40;
  buffers.push(bytesToBuffer([ESC, 0x21, n]));

  // ESC - n — 下划线（0=无 1=单线 2=双线）
  const ul = opts.underline === 2 ? 2 : (opts.underline ? 1 : 0);
  buffers.push(bytesToBuffer([ESC, 0x2D, ul]));

  // 反白 GS B n
  if (opts.invert) {
    buffers.push(bytesToBuffer([GS, 0x42, 1]));
  }

  return concatArrayBuffers(buffers);
}

/**
 * 恢复普通文字格式
 */
function textNormal() {
  return concatArrayBuffers([
    bytesToBuffer([ESC, 0x21, 0x00]),
    bytesToBuffer([ESC, 0x2D, 0x00]),
    bytesToBuffer([GS, 0x42, 0x00])
  ]);
}

/**
 * 打印一行文字（自动追加换行，格式应用后可自动恢复）
 * @param {string} content - 文本内容
 * @param {object} [opts] - 文字格式选项（见 textStyle）
 */
function textLine(content, opts = {}) {
  const buffers = [];
  const hasStyle = opts.bold || opts.doubleH || opts.doubleW || opts.underline || opts.invert;

  if (hasStyle) {
    buffers.push(textStyle(opts));
  }
  buffers.push(stringToBytes(content).buffer);
  buffers.push(bytesToBuffer([LF]));

  if (hasStyle) {
    buffers.push(textNormal());
  }
  return concatArrayBuffers(buffers);
}

/**
 * 打印多行文字（不自动恢复格式，适用于统一格式的多行）
 * @param {string[]} lines
 * @param {object} [opts]
 */
function textLines(lines, opts = {}) {
  const buffers = [];
  const hasStyle = opts.bold || opts.doubleH || opts.doubleW;

  if (hasStyle) buffers.push(textStyle(opts));

  lines.forEach(line => {
    buffers.push(stringToBytes(line).buffer);
    buffers.push(bytesToBuffer([LF]));
  });

  if (hasStyle) buffers.push(textNormal());
  return concatArrayBuffers(buffers);
}

/**
 * 打印分隔线
 * @param {string} [char='-'] - 分隔符
 * @param {number} [width=32] - 字符宽度（58mm 纸约 32 字符/行）
 */
function separator(char, width) {
  const c = char || '-';
  const w = width || 32;
  return concatArrayBuffers([
    stringToBytes(c.repeat(w)).buffer,
    bytesToBuffer([LF])
  ]);
}

/**
 * 空行
 * @param {number} [n=1] - 行数
 */
function blankLine(n) {
  const count = n || 1;
  const buf = new Uint8Array(count);
  buf.fill(LF);
  return buf.buffer;
}

/**
 * 走纸 n 行
 * @param {number} [n=1]
 */
function feed(n) {
  return bytesToBuffer([ESC, 0x64, n || 1]);
}

/**
 * 切纸（半切，留一点连接）
 */
function cut() {
  // GS V m n  — m=66 (feed & cut), n=3 (feed 3 dots)
  return bytesToBuffer([GS, 0x56, 66, 3]);
}

/**
 * 全切纸（完全切断）
 */
function cutFull() {
  return bytesToBuffer([GS, 0x56, 65, 0]);
}

/**
 * 蜂鸣提示
 * @param {number} [times=3] - 次数
 * @param {number} [duration=50] - 每次时长（×50ms）
 */
function beep(times, duration) {
  const n = times || 3;
  const t = duration || 50;
  return bytesToBuffer([ESC, 0x42, n, t]);
}

/**
 * 打印机自检页（诊断用）
 * 打印固件版本、打印头状态、编码测试等信息
 */
function selfTest() {
  const buffers = [];
  buffers.push(init());
  buffers.push(align(ALIGN.CENTER));

  // 标题
  buffers.push(textLine('=== 打印机自检 ===', { bold: true, doubleH: true }));
  buffers.push(blankLine());

  // 编码测试
  buffers.push(align(ALIGN.LEFT));
  buffers.push(textLine('编码测试(GBK/UTF-8):', { bold: true }));
  buffers.push(textLine('  ASCII: ABC abc 123 !@#'));
  buffers.push(textLine('  中文: 小鲜鸡新鲜直达'));
  buffers.push(textLine('  符号: ¥ 元 ￥ £ €'));
  buffers.push(blankLine());

  // 格式测试
  buffers.push(textLine('格式测试:', { bold: true }));
  buffers.push(textLine('  正常文字 Normal text'));
  buffers.push(textLine('  加粗 Bold text', { bold: true }));
  buffers.push(textLine('  倍高 Double height', { doubleH: true }));
  buffers.push(textLine('  倍宽 Double width', { doubleW: true }));
  buffers.push(textLine('  倍高倍宽 Double HW', { doubleH: true, doubleW: true }));
  buffers.push(blankLine());

  // 对齐测试
  buffers.push(align(ALIGN.LEFT));
  buffers.push(textLine('  左对齐 <<<'));
  buffers.push(align(ALIGN.CENTER));
  buffers.push(textLine('  居中 ^^^'));
  buffers.push(align(ALIGN.RIGHT));
  buffers.push(textLine('  右对齐 >>>'));
  buffers.push(blankLine());

  // QR 码
  buffers.push(align(ALIGN.CENTER));
  buffers.push(textLine('QR码测试:', { bold: true }));
  buffers.push(buildQRCode('https://weixin.qq.com', 5, 'M'));
  buffers.push(blankLine());

  // 分隔线
  buffers.push(align(ALIGN.LEFT));
  buffers.push(separator('=', 32));
  buffers.push(textLine('自检完成 - 打印机工作正常'));
  buffers.push(blankLine(3));
  buffers.push(cut());

  return concatArrayBuffers(buffers);
}

// ========== QR 码指令 ==========

/**
 * 生成 QR 码打印指令序列（标准 ESC/POS GS ( k）
 *
 * 兼容性说明：
 * - 大部分打印机支持此标准指令（芯烨 XPrinter、容大 Rongta 等）
 * - 部分老打印机仅支持 GS k 简化指令，会自动回退
 *
 * @param {string} data - 要编码到 QR 码中的数据
 * @param {number} [moduleSize=5] - 模块大小（1-16，58mm 纸推荐 4-6）
 * @param {string} [errorLevel='M'] - 纠错级别 L(7%)/M(15%)/Q(25%)/H(30%)
 */
function buildQRCode(data, moduleSize, errorLevel) {
  const size = moduleSize || 5;
  const level = errorLevel || 'M';

  const dataBytes = stringToBytes(data);
  const dataLen = dataBytes.length;

  // pL + pH*256 = dataLen + 3
  const totalLen = dataLen + 3;
  const pL = totalLen & 0xFF;
  const pH = (totalLen >> 8) & 0xFF;

  const buffers = [];

  // 1. 选择 QR Code Model 2
  // GS ( k 04 00 31 41 n1 n2 00  — n1n2=50 (Model 2)
  buffers.push(bytesToBuffer([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));

  // 2. 设置模块大小
  // GS ( k 03 00 31 43 n  — n=1~16
  buffers.push(bytesToBuffer([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size]));

  // 3. 设置纠错级别
  // GS ( k 03 00 31 45 n  — n=48(L)/49(M)/50(Q)/51(H)
  const ecMap = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };
  const ec = ecMap[level] || 0x31;
  buffers.push(bytesToBuffer([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, ec]));

  // 4. 存入 QR 数据
  // GS ( k pL pH 31 50 30 [data...]
  const storeCmd = [GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30];
  const storeBytes = new Uint8Array(storeCmd.length + dataLen);
  storeBytes.set(storeCmd);
  storeBytes.set(dataBytes, storeCmd.length);
  buffers.push(storeBytes.buffer);

  // 5. 打印 QR 码
  // GS ( k 03 00 31 51 30
  buffers.push(bytesToBuffer([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]));

  return concatArrayBuffers(buffers);
}

/**
 * 生成 QR 码（兼容旧接口，内部调用 buildQRCode）
 * @deprecated 请使用 buildQRCode
 */
function qrcode(data, moduleSize, errorLevel) {
  return buildQRCode(data, moduleSize, errorLevel);
}

/**
 * 生成 QR 码数据内容
 *
 * @param {object} order
 * @param {string} order.scene     - 优先：预生成的 scene（如 "card=07"）
 * @param {string} order.orderNo   - 兼容：订单号
 * @param {string} order.token     - 兼容：取货 token
 * @returns {string}
 */
function qrcodeContent(order) {
  if (order.scene) return order.scene;
  if (order.orderNo && order.token) {
    return `orderNo=${order.orderNo}&token=${order.token}`;
  }
  return order.orderNo || '';
}

// ========== 条形码指令 ==========

/**
 * 生成条形码（CODE128）
 *
 * @param {string} data - 条码数据
 * @param {number} [height=80] - 条码高度（点）
 * @param {number} [width=2] - 条码窄单元宽度（1-6）
 * @param {number} [textPosition=2] - 文字位置 0=无 1=上 2=下 3=上下
 */
function barcode128(data, height, width, textPosition) {
  const h = height || 80;
  const w = width || 2;
  const tpos = textPosition ?? 2;

  const dataBytes = stringToBytes(data);

  const buffers = [];

  // 设置条码高度 GS h n
  buffers.push(bytesToBuffer([GS, 0x68, h]));

  // 设置条码宽度 GS w n
  buffers.push(bytesToBuffer([GS, 0x77, w]));

  // 设置文字位置 GS H n
  buffers.push(bytesToBuffer([GS, 0x48, tpos]));

  // 打印 CODE128 条码 GS k 73 n data
  const cmd = [GS, 0x6B, 0x49, dataBytes.length];
  const cmdBytes = new Uint8Array(cmd.length + dataBytes.length);
  cmdBytes.set(cmd);
  cmdBytes.set(dataBytes, cmd.length);
  buffers.push(cmdBytes.buffer);
  buffers.push(bytesToBuffer([LF]));

  return concatArrayBuffers(buffers);
}

// ========== 收据布局 ==========

/**
 * 58mm 热敏纸每行约可容纳的字符数
 * 中文全角 ~16 字符，英文/数字 ~32 字符
 */
const CHARS_PER_LINE = 32;
const CJK_CHARS_PER_LINE = 16;

/**
 * 生成完整小票打印缓冲
 *
 * 小票布局：
 * ```
 *        小鲜鸡
 *      鲜鸡现宰 新鲜直达
 *   ──────────────────
 *   【线下订单】（加粗）
 *   订单号：B001
 *   号码牌：07
 *   金额：¥120.40（大字）
 *   ──────────────────
 *       [QR码]
 *    扫码查看取货进度
 *   ──────────────────
 *   2026-06-08 14:35
 *   谢谢惠顾，欢迎再次光临
 * ```
 *
 * @param {object} order
 * @param {string} order.orderNo      - 订单号
 * @param {string} order.cardNumber   - 号码牌编号
 * @param {number} order.amountFen    - 金额（分）
 * @param {string} order.scene        - 二维码数据（scene 参数）
 * @param {string} [order.shopName]   - 店铺名称
 * @param {string} [order.paymentType] - 支付方式
 * @param {string} [order.customerName] - 顾客姓名
 * @param {string} [order.remark]     - 备注
 */
function buildReceipt(order) {
  const shopName = order.shopName || '小鲜鸡';
  const orderNo = order.orderNo || '';
  const cardNumber = order.cardNumber || '';
  const amountYuan = ((order.amountFen || 0) / 100).toFixed(2);
  const scene = order.scene || qrcodeContent(order);
  const paymentType = order.paymentType || '';
  const remark = order.remark || '';
  const now = new Date();
  const dateStr = formatDate(now);
  const timeStr = formatTime(now);

  const parts = [];

  // 初始化
  parts.push(init());

  // ===== 头部 =====
  parts.push(align(ALIGN.CENTER));

  // 店名（倍高倍宽 + 加粗）
  parts.push(textStyle({ bold: true, doubleH: true, doubleW: true }));
  parts.push(textLine(padCenterCJK(shopName, CJK_CHARS_PER_LINE)));
  parts.push(textNormal());

  // 副标题
  parts.push(textLine('鲜鸡现宰  新鲜直达'));
  parts.push(blankLine());

  // 分隔线
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== 订单信息 =====
  parts.push(align(ALIGN.CENTER));
  parts.push(textLine('【线下订单】', { bold: true }));
  parts.push(blankLine());

  parts.push(align(ALIGN.LEFT));
  parts.push(textLine('订单号：' + orderNo));
  parts.push(textLine('号码牌：' + cardNumber));

  if (paymentType) {
    const payLabel = paymentType === 'cash' ? '现金/扫码'
      : paymentType === 'wechat' ? '微信支付'
      : paymentType === 'unpaid' ? '未支付'
      : paymentType;
    parts.push(textLine('支付方式：' + payLabel));
  }

  // 金额（大字加粗 + 倍高倍宽）
  parts.push(blankLine());
  parts.push(align(ALIGN.CENTER));
  parts.push(textStyle({ bold: true, doubleH: true, doubleW: true }));
  parts.push(textLine(padCenter('¥' + amountYuan, CJK_CHARS_PER_LINE)));
  parts.push(textNormal());

  if (remark) {
    parts.push(blankLine());
    parts.push(align(ALIGN.LEFT));
    parts.push(textLine('备注：' + remark));
  }

  parts.push(blankLine());
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== QR 码 =====
  parts.push(align(ALIGN.CENTER));
  if (scene) {
    parts.push(buildQRCode(scene, 5, 'M'));
    parts.push(blankLine());
    parts.push(textLine('扫码查看取货进度'));
  }

  parts.push(blankLine());
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== 底部 =====
  parts.push(align(ALIGN.CENTER));
  parts.push(textLine(dateStr + ' ' + timeStr));
  parts.push(blankLine());
  parts.push(textLine('谢谢惠顾，欢迎再次光临'));

  // 走纸 + 切纸
  parts.push(blankLine(3));
  parts.push(cut());

  return concatArrayBuffers(parts);
}

/**
 * 称重后打印小票（含重量信息）
 *
 * 布局比线下订单小票多称重信息：
 * ```
 *        小鲜鸡
 *      鲜鸡现宰 新鲜直达
 *   ──────────────────
 *   订单号：A023
 *   订单类型：配送上门
 *   号码牌：07
 *   ──────────────────
 *   商品：整鸡（毛鸡/整只）
 *   实际重量：2.76斤（1380克）
 *   实收金额：¥120.40
 *   （退款金额：¥9.60）
 *   ──────────────────
 *       [QR码]
 *    扫码查看订单详情
 *   ──────────────────
 *   2026-06-08 14:35
 *   谢谢惠顾，欢迎再次光临
 * ```
 *
 * @param {object} order
 * @param {string} order.orderNo
 * @param {string} order.cardNumber
 * @param {string} order.type       - delivery/pickup/offline
 * @param {string} order.productName - 商品名
 * @param {string} order.specSummary - 规格摘要
 * @param {number} order.actualWeight - 实际重量（克）
 * @param {number} order.pricePerJin  - 单价（分/斤）
 * @param {number} order.actualAmount - 实收金额（分）
 * @param {number} order.refundAmount - 退款金额（分）
 * @param {string} order.scene       - 二维码数据
 * @param {string} [order.shopName]
 */
function buildWeighReceipt(order) {
  const shopName = order.shopName || '小鲜鸡';
  const orderNo = order.orderNo || '';
  const cardNumber = order.cardNumber || '';
  const productName = order.productName || '';
  const specSummary = order.specSummary || '';
  const actualWeightGrams = order.actualWeight || 0;
  const actualWeightJin = (actualWeightGrams / 500).toFixed(2);
  const pricePerJinDisplay = (order.pricePerJin || 0) > 0 ? ((order.pricePerJin) / 100).toFixed(2) : '--';
  const actualAmountYuan = ((order.actualAmount || 0) / 100).toFixed(2);
  const refundAmountYuan = ((order.refundAmount || 0) / 100).toFixed(2);
  const hasRefund = (order.refundAmount || 0) > 0;
  const scene = order.scene || qrcodeContent(order);
  const typeLabel = order.type === 'delivery' ? '配送上门' : order.type === 'pickup' ? '到店自取' : '线下订单';
  const now = new Date();
  const dateStr = formatDate(now);
  const timeStr = formatTime(now);

  const parts = [];
  parts.push(init());

  // ===== 头部 =====
  parts.push(align(ALIGN.CENTER));
  parts.push(textStyle({ bold: true, doubleH: true, doubleW: true }));
  parts.push(textLine(padCenterCJK(shopName, CJK_CHARS_PER_LINE)));
  parts.push(textNormal());
  parts.push(textLine('鲜鸡现宰  新鲜直达'));
  parts.push(blankLine());

  // 分隔线
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== 订单信息 =====
  parts.push(align(ALIGN.LEFT));
  parts.push(textLine('订单号：' + orderNo));
  parts.push(textLine('订单类型：' + typeLabel));
  if (cardNumber) {
    parts.push(textLine('号码牌：' + cardNumber));
  }
  parts.push(blankLine());

  // 商品信息
  if (productName) {
    parts.push(textLine('商品：' + productName + (specSummary ? '（' + specSummary + '）' : '')));
  }
  parts.push(textLine('实际重量：' + actualWeightJin + '斤（' + actualWeightGrams + '克）'));
  parts.push(textLine('单价：¥' + pricePerJinDisplay + '/斤'));
  parts.push(blankLine());

  // 金额（大字）
  parts.push(align(ALIGN.CENTER));
  parts.push(textStyle({ bold: true, doubleH: true, doubleW: true }));
  parts.push(textLine(padCenter('¥' + actualAmountYuan, CJK_CHARS_PER_LINE)));
  parts.push(textNormal());
  parts.push(textLine('实收金额'));
  parts.push(blankLine());

  // 退款信息
  if (hasRefund) {
    parts.push(align(ALIGN.CENTER));
    parts.push(textLine('(退款 ¥' + refundAmountYuan + ')'));
    parts.push(blankLine());
  }

  // 分隔线
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== QR 码 =====
  parts.push(align(ALIGN.CENTER));
  if (scene) {
    parts.push(buildQRCode(scene, 5, 'M'));
    parts.push(blankLine());
    parts.push(textLine('扫码查看订单详情'));
  }
  parts.push(blankLine());
  parts.push(align(ALIGN.LEFT));
  parts.push(separator('-', CHARS_PER_LINE));
  parts.push(blankLine());

  // ===== 底部 =====
  parts.push(align(ALIGN.CENTER));
  parts.push(textLine(dateStr + ' ' + timeStr));
  parts.push(blankLine());
  parts.push(textLine('谢谢惠顾，欢迎再次光临'));
  parts.push(blankLine(3));
  parts.push(cut());

  return concatArrayBuffers(parts);
}

// ========== 内部工具 ==========

/**
 * CJK 字符串居中填充（考虑了中英文混排的显示宽度）
 *
 * @param {string} str
 * @param {number} totalCJKWidth - 以 CJK 字符宽度为单位的总宽（58mm 纸 ≈ 16 CJK 字符）
 * @returns {string}
 */
function padCenterCJK(str, totalCJKWidth) {
  const dw = displayWidth(str);
  const totalDisplayWidth = totalCJKWidth * 2; // 转为英文字符宽度

  if (dw >= totalDisplayWidth) return str;

  const leftPad = Math.floor((totalDisplayWidth - dw) / 2);
  return ' '.repeat(leftPad) + str;
}

/**
 * 居中填充（英文宽度）
 * @deprecated 请使用 padCenterCJK
 */
function padCenter(str, totalWidth) {
  return padCenterCJK(str, totalWidth / 2);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return h + ':' + min;
}

// ========== 导出 ==========

module.exports = {
  // 基础指令
  init,
  align,
  textStyle,
  textNormal,
  textLine,
  textLines,
  separator,
  blankLine,
  feed,
  cut,
  cutFull,
  beep,
  selfTest,
  // 条码
  barcode128,
  // QR 码
  qrcode,
  buildQRCode,
  qrcodeContent,
  // 收据
  buildReceipt,
  buildWeighReceipt,
  // 拼接工具
  concatArrayBuffers,
  bytesToBuffer,
  stringToBytes,
  displayWidth,
  // 常量
  ALIGN,
  TEXT_SIZE,
  UNDERLINE,
  CHARS_PER_LINE,
  CJK_CHARS_PER_LINE
};
