/**
 * BLE 热敏打印机连接管理
 *
 * 封装微信小程序蓝牙 BLE API，提供打印机搜索、连接、打印等一站式操作。
 *
 * 使用方式：
 *   const printer = require('../../utils/printer');
 *   printer.searchPrinters((devices) => { ... });
 *   printer.connectPrinter(deviceId);
 *   printer.printReceipt(order, { deviceId });
 *
 * ========== 调试说明 ==========
 * - 开发阶段无蓝牙打印机时，MOCK_PRINT = true 用小票预览弹窗代替真实打印
 * - 真机调试时设置 DEBUG = true 打开详细日志
 * - 上线前 MOCK_PRINT 改为 false，DEBUG 改为 false
 */

const escpos = require('./escpos');

// ========== 常量 ==========

/**
 * 模拟打印开关
 * 开发阶段无蓝牙打印机时设为 true，用小票预览弹窗代替真实打印
 * 上线前改为 false
 */
const MOCK_PRINT = false;

/** 调试日志开关 */
const DEBUG = false;

/** BLE 设备扫描超时（毫秒） */
const SCAN_TIMEOUT = 10000;

/** 连接超时（毫秒） */
const CONNECT_TIMEOUT = 8000;

/** 服务发现等待（毫秒），Android 端需等待 GATT 服务就绪 */
const SERVICE_DISCOVERY_DELAY = 800;

/** 写入操作间隔（毫秒），给打印机处理时间 */
const WRITE_INTERVAL = 30;

/** 「写响应」模式下的写入间隔（毫秒），需等待设备确认 */
const WRITE_WITH_RESPONSE_INTERVAL = 80;

/** 单次写入最大字节数（默认 BLE MTU=23，减去 3 字节头部） */
const MAX_WRITE_SIZE = 20;

/** MTU 协商目标值 */
const TARGET_MTU = 185;

/** 打印机设备名称关键字（用于过滤） */
const PRINTER_NAME_KEYWORDS = [
  'printer', 'thermal', 'POS', 'pos',
  'Printer', 'PRINTER', 'THERMAL',
  '打印', '热敏', '小票', '票据',
  'XPrinter', 'Rongta', '芯烨', '容大',
  'MTP', 'SPT', 'PP', 'BT',
  'BlueTooth', 'BT-Printer'
];

/** BLE 错误码映射 */
const BLE_ERROR_MAP = {
  0:    '正常',
  10000: '未初始化蓝牙适配器',
  10001: '未检测到蓝牙（请开启手机蓝牙）',
  10002: '未找到指定设备',
  10003: '设备连接失败',
  10004: '未发现设备服务',
  10005: '未发现设备特征值',
  10006: '当前连接已断开',
  10007: '设备特征值不支持此操作',
  10008: '其他错误',
  10009: 'Android 系统版本低于 6.0 不支持 BLE',
  10012: '扫描超时',
  10013: '设备已断开，请重新搜索'
};

// ========== 内部状态 ==========

let connectedDeviceId = null;
let writeCharacteristic = null;
let bleAdapterReady = false;
let scanning = false;
let connecting = false;
let negotiatedMTU = 23;  // 默认 BLE MTU

// BLE 连接状态监听器
let _connectionStateListener = null;
// 断开回调（外部注册）
let _onDisconnect = null;
// 搜索回调
let _scanTimer = null;

// ========== 调试日志 ==========

/** @param {...any} args */
function _log(...args) {
  if (DEBUG) console.log('[printer]', ...args);
}

/** @param {...any} args */
function _warn(...args) {
  if (DEBUG) console.warn('[printer]', ...args);
}

// ========== 公开 API ==========

/**
 * 初始化蓝牙适配器（打开）
 * @returns {Promise<boolean>}
 */
function initBluetooth() {
  if (bleAdapterReady) return Promise.resolve(true);

  return new Promise((resolve) => {
    wx.openBluetoothAdapter({
      success: () => {
        bleAdapterReady = true;
        _log('蓝牙适配器已打开');
        // 注册全局连接状态监听
        _registerConnectionListener();
        resolve(true);
      },
      fail: (err) => {
        _warn('蓝牙适配器打开失败', err);
        bleAdapterReady = false;
        if (err.errCode === 10001) {
          wx.showModal({
            title: '蓝牙未开启',
            content: '请先开启手机蓝牙，然后重试。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                if (wx.openSystemBluetoothSetting) {
                  wx.openSystemBluetoothSetting();
                } else {
                  wx.showToast({ title: '请手动开启蓝牙', icon: 'none' });
                }
              }
            }
          });
        } else {
          const msg = BLE_ERROR_MAP[err.errCode] || '蓝牙初始化失败';
          wx.showToast({ title: msg + '，请重试', icon: 'none' });
        }
        resolve(false);
      }
    });
  });
}

/**
 * 注册 BLE 连接状态变化监听
 */
function _registerConnectionListener() {
  if (_connectionStateListener) return;

  wx.onBLEConnectionStateChange((res) => {
    _log('BLE 连接状态变化', res.deviceId, res.connected);

    if (!res.connected && res.deviceId === connectedDeviceId) {
      _warn('打印机意外断开:', res.deviceId);
      connectedDeviceId = null;
      writeCharacteristic = null;
      negotiatedMTU = 23;

      if (typeof _onDisconnect === 'function') {
        _onDisconnect({ deviceId: res.deviceId, reason: 'unexpected' });
      }
    }
  });
  _connectionStateListener = true;
}

/**
 * 注册连接断开回调
 * @param {function|null} callback - callback({ deviceId, reason })
 */
function onDisconnect(callback) {
  _onDisconnect = callback;
}

/**
 * 搜索附近的蓝牙打印机
 *
 * @param {function} callback - 每发现一台设备回调一次，传入设备列表
 *   callback(devices: Array<{deviceId, name, RSSI, localName, advertisData}>)
 * @param {number} [timeout=10000] - 扫描超时时间
 * @returns {Promise<Array>} 扫描结束后返回全部设备列表
 */
function searchPrinters(callback, timeout) {
  const scanTime = timeout || SCAN_TIMEOUT;
  const allDevices = [];
  const seenIds = new Set();

  return initBluetooth().then((ready) => {
    if (!ready) return [];

    return new Promise((resolve) => {
      // 先停止之前的扫描
      stopScan();

      // 监听发现设备
      wx.onBluetoothDeviceFound((res) => {
        res.devices.forEach(device => {
          // 过滤非打印机设备
          if (!isPrinterDevice(device)) return;
          // 去重
          if (seenIds.has(device.deviceId)) return;
          seenIds.add(device.deviceId);

          // 解析广播数据中的服务 UUID
          const advertisData = device.advertisData || {};
          const serviceUUIDs = (device.advertisServiceUUIDs || []).join(',');

          const info = {
            deviceId: device.deviceId,
            name: device.name || device.localName || '未知打印机',
            RSSI: device.RSSI || -100,
            localName: device.localName || '',
            serviceUUIDs,
            advertisData
          };
          allDevices.push(info);

          _log('发现打印机:', info.name, 'RSSI:', info.RSSI);

          if (typeof callback === 'function') {
            callback(allDevices.slice());
          }
        });
      });

      // 开始扫描
      scanning = true;
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        // 指定要搜索的服务 UUID（常见打印机服务），提升命中率
        services: [],
        success: () => {
          _log('开始扫描蓝牙设备...');
          // 超时后停止扫描
          _scanTimer = setTimeout(() => {
            _log('扫描结束，共发现', allDevices.length, '台打印机');
            stopScan();
            resolve(allDevices);
          }, scanTime);
        },
        fail: (err) => {
          _warn('开始扫描失败', err);
          scanning = false;
          resolve([]);
        }
      });
    });
  });
}

/**
 * 连接指定打印机
 *
 * @param {string} deviceId - 设备 ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function connectPrinter(deviceId) {
  if (!deviceId) return Promise.resolve({ success: false, error: '未选择打印机' });
  if (connecting) return Promise.resolve({ success: false, error: '正在连接中' });

  // 如果已经连接到目标设备，直接返回
  if (connectedDeviceId === deviceId && writeCharacteristic) {
    _log('打印机已连接，跳过');
    return Promise.resolve({ success: true });
  }

  // 断开当前连接
  disconnectPrinter();

  return initBluetooth().then((ready) => {
    if (!ready) return { success: false, error: '蓝牙未就绪' };

    connecting = true;
    wx.showLoading({ title: '连接打印机...', mask: true });

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        connecting = false;
        wx.hideLoading();
        resolve({ success: false, error: '连接超时，请确认打印机已开机且在范围内' });
      }, CONNECT_TIMEOUT);

      wx.createBLEConnection({
        deviceId,
        success: () => {
          clearTimeout(timeoutId);
          _log('BLE 连接成功:', deviceId);

          // 连接成功后：尝试 MTU 协商 → 等待服务就绪 → 发现服务
          _negotiateMTU(deviceId).then(() => {
            // Android 端需要等待 GATT 服务就绪
            return new Promise(resolveDelay => {
              setTimeout(() => resolveDelay(), SERVICE_DISCOVERY_DELAY);
            });
          }).then(() => {
            return discoverServices(deviceId);
          }).then(result => {
            connecting = false;
            wx.hideLoading();
            if (result.success) {
              connectedDeviceId = deviceId;
              // 缓存上次使用的打印机 ID
              wx.setStorageSync('last_printer_id', deviceId);
              _log('打印机就绪，MTU:', negotiatedMTU);
            }
            resolve(result);
          });
        },
        fail: (err) => {
          clearTimeout(timeoutId);
          connecting = false;
          wx.hideLoading();
          _warn('BLE 连接失败', err);
          let msg = BLE_ERROR_MAP[err.errCode] || '连接失败';
          if (err.errCode === 10003) msg = '设备连接失败，请重试';
          else if (err.errCode === 10013) msg = '设备已断开，请重新搜索';
          resolve({ success: false, error: msg });
        }
      });
    });
  });
}

/**
 * 尝试重新连接上次使用的打印机
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function reconnectLast() {
  const lastId = getLastPrinterId();
  if (!lastId) return { success: false, error: '无历史连接记录' };
  _log('尝试重连:', lastId);
  return connectPrinter(lastId);
}

/**
 * 断开打印机连接并释放资源
 */
function disconnectPrinter() {
  stopScan();

  if (connectedDeviceId) {
    try {
      wx.closeBLEConnection({ deviceId: connectedDeviceId });
    } catch (_) {}
    connectedDeviceId = null;
    writeCharacteristic = null;
    negotiatedMTU = 23;
  }
}

/**
 * 关闭蓝牙适配器（页面卸载时调用）
 */
function closeBluetooth() {
  disconnectPrinter();
  if (bleAdapterReady) {
    try { wx.closeBluetoothAdapter(); } catch (_) {}
    bleAdapterReady = false;
    _connectionStateListener = null;
    _onDisconnect = null;
  }
}

/**
 * 打印小票（一站式：连接 → 生成指令 → 打印 → （可选）断开）
 *
 * 自动识别票据类型：
 * - 含 actualWeight/pricePerJin/specSummary → 称重小票（escpos.buildWeighReceipt）
 * - 否则 → 线下订单小票（escpos.buildReceipt）
 *
 * @param {object} order - 订单数据
 * @param {object} options
 * @param {string} options.deviceId - 打印机设备 ID
 * @param {string} [options.deviceName] - 打印机名称（仅日志用）
 * @param {boolean} [options.keepConnection=false] - 打印后是否保持连接
 * @param {function} [options.onProgress] - 进度回调 (percent: number)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function printReceipt(order, options) {
  const { deviceId, keepConnection } = options || {};
  if (!deviceId) return { success: false, error: '未选择打印机' };
  if (!order || !order.orderNo) return { success: false, error: '订单数据不完整' };

  wx.showLoading({ title: '正在打印...', mask: true });

  try {
    // Step 1: 连接（如果未连接或连接了不同设备）
    if (connectedDeviceId !== deviceId || !writeCharacteristic) {
      const connResult = await connectPrinter(deviceId);
      if (!connResult.success) {
        wx.hideLoading();
        return connResult;
      }
    }

    // Step 2: 生成打印数据（自动识别票据类型）
    const isWeighTicket = !!(order.actualWeight || order.pricePerJin || order.specSummary);
    const buffer = isWeighTicket ? escpos.buildWeighReceipt(order) : escpos.buildReceipt(order);
    _log('打印数据大小:', buffer.byteLength, 'bytes，分片数:', Math.ceil(buffer.byteLength / MAX_WRITE_SIZE));

    // Step 3: 分片写入
    const writeResult = await writeBuffer(buffer);
    wx.hideLoading();

    if (writeResult.success) {
      wx.showToast({ title: '打印成功', icon: 'success' });
      // 打印完成后可选断开
      if (!keepConnection) {
        // 延迟断开，确保打印机处理完缓冲区
        setTimeout(() => disconnectPrinter(), 1500);
      }
    } else {
      wx.showToast({ title: writeResult.error || '打印失败', icon: 'none' });
    }

    return writeResult;
  } catch (err) {
    wx.hideLoading();
    _warn('打印异常', err);
    return { success: false, error: '打印异常：' + (err.message || '') };
  }
}

/**
 * 获取上次连接的打印机 ID
 * @returns {string|null}
 */
function getLastPrinterId() {
  try {
    return wx.getStorageSync('last_printer_id') || null;
  } catch (_) {
    return null;
  }
}

/**
 * 清除历史打印机记录
 */
function clearLastPrinterId() {
  try { wx.removeStorageSync('last_printer_id'); } catch (_) {}
}

/**
 * 当前是否已连接到打印机
 * @returns {boolean}
 */
function isConnected() {
  return !!(connectedDeviceId && writeCharacteristic);
}

/**
 * 获取当前连接的打印机 ID
 * @returns {string|null}
 */
function getConnectedDeviceId() {
  return connectedDeviceId;
}

/**
 * 获取当前协商的 MTU 值
 * @returns {number}
 */
function getNegotiatedMTU() {
  return negotiatedMTU;
}

// ========== 内部实现 ==========

/**
 * 协商 BLE MTU（提升单次写入大小）
 * Android 5.0+ 支持，iOS 自动处理
 */
function _negotiateMTU(deviceId) {
  if (typeof wx.setBLEMTU !== 'function') {
    _log('当前版本不支持 MTU 协商');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    wx.setBLEMTU({
      deviceId,
      mtu: TARGET_MTU,
      success: (res) => {
        // Android: res.mtu 为协商后的值；iOS: 自动处理
        negotiatedMTU = res.mtu || TARGET_MTU;
        _log('MTU 协商完成:', negotiatedMTU);
        resolve();
      },
      fail: (err) => {
        // MTU 协商失败不阻塞流程，使用默认值
        _warn('MTU 协商失败，使用默认值 23', err);
        negotiatedMTU = 23;
        resolve();
      }
    });
  });
}

/**
 * 发现设备服务和特征值，找到可写入的特征值
 */
function discoverServices(deviceId) {
  return new Promise((resolve) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: (svcRes) => {
        const services = svcRes.services || [];
        _log('发现服务', services.length, '个');

        if (services.length === 0) {
          resolve({ success: false, error: '未发现打印机服务，请确认设备已开机' });
          return;
        }

        // 并行获取所有服务的特征值
        const promises = services.map(svc =>
          new Promise((resolveChar) => {
            wx.getBLEDeviceCharacteristics({
              deviceId,
              serviceId: svc.uuid,
              success: (charRes) => {
                resolveChar(charRes.characteristics || []);
              },
              fail: () => resolveChar([])
            });
          })
        );

        Promise.all(promises).then(charArrays => {
          const allChars = charArrays.flat();
          _log('发现特征值', allChars.length, '个');

          // 构建特征值 -> 服务映射
          const charServiceMap = {};
          services.forEach(svc => {
            charArrays.forEach((chars, idx) => {
              if (services[idx].uuid === svc.uuid) {
                chars.forEach(c => { charServiceMap[c.uuid] = svc.uuid; });
              }
            });
          });

          // 查找可写入的特征值
          // 优先级：writeNoResponse（多数打印机）> write（需等待确认）
          let writeChar = allChars.find(c =>
            c.properties && c.properties.writeNoResponse
          );

          let writeType = 'writeNoResponse';

          if (!writeChar) {
            writeChar = allChars.find(c =>
              c.properties && c.properties.write
            );
            writeType = 'write';
          }

          // 常见打印机特征值 UUID 模式匹配（兼容某些不标准声明 properties 的打印机）
          if (!writeChar) {
            const KNOWN_UUIDS = [
              '0000FF02', '0000FFF2', '00002AF1', '00002A02',
              '49535343', '0000AE01', '0000FE01'
            ];
            writeChar = allChars.find(c =>
              c.uuid && KNOWN_UUIDS.some(u =>
                c.uuid.toUpperCase().includes(u.toUpperCase())
              )
            );
            writeType = 'writeNoResponse'; // 常见的这些 UUID 通常支持无响应写入
          }

          if (!writeChar) {
            _warn('未找到写入特征值，所有特征值:', allChars.map(c => c.uuid));
            resolve({ success: false, error: '未找到打印机写入通道，请确认设备为热敏打印机' });
            return;
          }

          const serviceId = charServiceMap[writeChar.uuid] || services[0].uuid;

          writeCharacteristic = {
            deviceId,
            serviceId,
            characteristicId: writeChar.uuid,
            writeType
          };

          _log('写入通道:', writeChar.uuid, '类型:', writeType);

          // 启用 notify/indicate（如果支持，用于接收打印机状态）
          if (writeChar.properties && (writeChar.properties.notify || writeChar.properties.indicate)) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: writeChar.uuid,
              state: true,
              success: () => {
                _log('已启用 notify');
                // 监听打印机返回的状态数据
                wx.onBLECharacteristicValueChange((res) => {
                  _log('收到打印机数据:', res.value);
                });
              },
              fail: () => {}
            });
          }

          resolve({ success: true });
        });
      },
      fail: (err) => {
        _warn('获取服务失败', err);
        resolve({ success: false, error: '无法获取打印机服务，请重试' });
      }
    });
  });
}

/**
 * 将 ArrayBuffer 按 MTU 分片写入打印机
 *
 * 处理两种写入模式：
 * - writeNoResponse: 无需等待响应，按固定间隔连续发送（大多数打印机）
 * - write: 需要等待每次写入的回调确认后再发送下一片
 */
function writeBuffer(buffer) {
  if (!writeCharacteristic) {
    return Promise.resolve({ success: false, error: '打印机未连接' });
  }

  const bytes = new Uint8Array(buffer);
  const totalBytes = bytes.length;
  const { deviceId, serviceId, characteristicId, writeType } = writeCharacteristic;
  // 根据 MTU 动态计算分片大小（MTU - 3 字节头部）
  const chunkSize = Math.min(MAX_WRITE_SIZE, negotiatedMTU - 3);

  return new Promise((resolve) => {
    let offset = 0;
    let failed = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    function writeNext() {
      if (failed) return;

      if (offset >= totalBytes) {
        // 全部写入完成，给打印机一点时间处理缓冲区
        const delay = writeType === 'writeNoResponse' ? 300 : 500;
        setTimeout(() => resolve({ success: true }), delay);
        return;
      }

      // 计算本次写入大小
      const size = Math.min(chunkSize, totalBytes - offset);
      const chunk = bytes.slice(offset, offset + size).buffer;

      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value: chunk,
        success: () => {
          retryCount = 0; // 重置重试计数
          offset += size;
          // writeNoResponse 可以较快发送；write 模式需等待设备确认
          const interval = writeType === 'writeNoResponse'
            ? WRITE_INTERVAL
            : WRITE_WITH_RESPONSE_INTERVAL;
          setTimeout(writeNext, interval);
        },
        fail: (err) => {
          _warn('写入失败 (offset=' + offset + ')', err);
          // 重试机制
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            _warn('重试', retryCount, '/', MAX_RETRIES);
            setTimeout(writeNext, 100 * retryCount);
          } else {
            failed = true;
            resolve({ success: false, error: '数据发送失败，请重试' });
          }
        }
      });
    }

    writeNext();
  });
}

/**
 * 停止设备扫描
 */
function stopScan() {
  if (_scanTimer) {
    clearTimeout(_scanTimer);
    _scanTimer = null;
  }
  if (scanning) {
    try {
      wx.stopBluetoothDevicesDiscovery();
    } catch (_) {}
    scanning = false;
  }
}

/**
 * 判断设备是否为打印机（按名称 + 服务UUID 过滤）
 */
function isPrinterDevice(device) {
  const name = (device.name || device.localName || '').trim();
  if (!name) {
    // 无名设备检查广播服务 UUID 是否匹配打印机
    const uuids = (device.advertisServiceUUIDs || []).join(',').toUpperCase();
    return ['18F0', '181C', 'FFE0', 'FFF0', 'AE00', 'FE01', '1101'].some(u => uuids.includes(u));
  }

  const lower = name.toLowerCase();
  return PRINTER_NAME_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// ========== 导出 ==========

module.exports = {
  MOCK_PRINT,
  DEBUG,
  initBluetooth,
  searchPrinters,
  connectPrinter,
  reconnectLast,
  disconnectPrinter,
  closeBluetooth,
  printReceipt,
  getLastPrinterId,
  clearLastPrinterId,
  isConnected,
  getConnectedDeviceId,
  getNegotiatedMTU,
  onDisconnect,
  BLE_ERROR_MAP
};
