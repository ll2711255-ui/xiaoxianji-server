/**
 * 腾讯地图微信小程序 JavaScript SDK
 * 微信小程序 JavaScript SDK 基于腾讯地图 API，提供地址解析、逆地址解析、
 * 地点搜索、关键词输入提示、距离计算、行政区划列表等功能。
 *
 * 使用前需要在腾讯位置服务控制台申请 key：
 *   https://lbs.qq.com/
 *
 * 使用示例：
 *   const QQMapWX = require('./qqmap-wx-jssdk.js');
 *   const qqmap = new QQMapWX({ key: 'YOUR_KEY' });
 */
const WX_API_BASE = 'https://apis.map.qq.com';

/**
 * 发起网络请求（封装 wx.request）
 * @param {string} url
 * @param {object} data
 * @param {function} success
 * @param {function} fail
 * @param {function} complete
 */
function requestAPI(url, data, success, fail, complete) {
  wx.request({
    url: url,
    data: data || {},
    method: 'GET',
    dataType: 'json',
    success: function (res) {
      if (res.statusCode === 200 && res.data) {
        success && success(res.data);
      } else {
        fail && fail({ msg: '请求失败，状态码：' + res.statusCode });
      }
    },
    fail: function (err) {
      fail && fail(err);
    },
    complete: complete
  });
}

/**
 * QQMapWX 构造函数
 * @param {object} options - 配置项
 * @param {string} options.key - 必填，腾讯地图 API key
 */
function QQMapWX(options) {
  if (!options || !options.key) {
    console.error('[qqmap-wx-jssdk] 请配置腾讯地图 key，即 new QQMapWX({ key: "your key" })');
    return;
  }
  this.key = options.key;
}

/**
 * 地址解析（地理编码）：将地址文本转换为经纬度坐标
 *
 * 参考文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceGeocoder
 *
 * @param {object} options
 * @param {string} options.address       - 地址文本
 * @param {string} [options.region]      - 城市名，限制搜索范围
 * @param {function} options.success      - 成功回调 (res) => {}
 *   res.result.location.lat  纬度
 *   res.result.location.lng  经度
 *   res.result.title         地点名称
 *   res.result.address_components  地址组件
 * @param {function} options.fail        - 失败回调 (err) => {}
 * @param {function} [options.complete]  - 完成回调
 */
QQMapWX.prototype.geocoder = function (options) {
  if (!options || !options.address) {
    options && options.fail && options.fail({ msg: '缺少 address 参数' });
    return;
  }

  var params = {
    key: this.key,
    address: options.address
  };
  if (options.region) {
    params.region = options.region;
  }

  var url = WX_API_BASE + '/ws/geocoder/v1/';

  requestAPI(
    url,
    params,
    function (res) {
      if (res.status === 0 && res.result) {
        options.success && options.success(res);
      } else {
        options.fail && options.fail({ msg: res.message || '地址解析失败' });
      }
    },
    options.fail,
    options.complete
  );
};

/**
 * 逆地址解析：将经纬度转换为地址描述
 *
 * @param {object} options
 * @param {number} options.location.lat  - 纬度
 * @param {number} options.location.lng  - 经度
 * @param {function} options.success      - 成功回调
 * @param {function} options.fail        - 失败回调
 * @param {function} [options.complete]  - 完成回调
 */
QQMapWX.prototype.reverseGeocoder = function (options) {
  if (!options || !options.location) {
    options && options.fail && options.fail({ msg: '缺少 location 参数' });
    return;
  }

  var params = {
    key: this.key,
    location: options.location.lat + ',' + options.location.lng
  };

  var url = WX_API_BASE + '/ws/geocoder/v1/';

  requestAPI(
    url,
    params,
    function (res) {
      if (res.status === 0 && res.result) {
        options.success && options.success(res);
      } else {
        options.fail && options.fail({ msg: res.message || '逆地址解析失败' });
      }
    },
    options.fail,
    options.complete
  );
};

/**
 * 地点搜索
 *
 * @param {object} options
 * @param {string} options.keyword    - 搜索关键词
 * @param {string} [options.region]   - 城市范围
 * @param {number} [options.page_size] - 每页条数，默认20
 * @param {number} [options.page_index] - 页码，默认1
 * @param {function} options.success   - 成功回调
 * @param {function} options.fail      - 失败回调
 * @param {function} [options.complete] - 完成回调
 */
QQMapWX.prototype.search = function (options) {
  if (!options || !options.keyword) {
    options && options.fail && options.fail({ msg: '缺少 keyword 参数' });
    return;
  }

  var params = {
    key: this.key,
    keyword: options.keyword,
    page_size: options.page_size || 20,
    page_index: options.page_index || 1
  };
  if (options.region) {
    params.boundary = 'region(' + options.region + ',0)';
  }

  var url = WX_API_BASE + '/ws/place/v1/search';

  requestAPI(url, params, options.success, options.fail, options.complete);
};

/**
 * 计算两点间距离
 *
 * @param {object} options
 * @param {string} options.mode     - 计算方式：'driving'/'walking'
 * @param {string} options.from     - 起点坐标 "lat,lng"
 * @param {string} options.to       - 终点坐标 "lat,lng"
 * @param {function} options.success - 成功回调
 * @param {function} options.fail   - 失败回调
 * @param {function} [options.complete] - 完成回调
 */
QQMapWX.prototype.calculateDistance = function (options) {
  if (!options || !options.from || !options.to) {
    options && options.fail && options.fail({ msg: '缺少 from/to 参数' });
    return;
  }

  var params = {
    key: this.key,
    from: options.from,
    to: options.to,
    mode: options.mode || 'driving'
  };

  var url = WX_API_BASE + '/ws/distance/v1/';

  requestAPI(url, params, options.success, options.fail, options.complete);
};

module.exports = QQMapWX;
