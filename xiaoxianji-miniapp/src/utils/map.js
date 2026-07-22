/**
 * 腾讯地图 WebService API 封装
 *
 * 微信小程序调用腾讯地图 WebService API 必须通过 wx.request 发起 HTTPS 请求，
 * 不能走服务端代理（否则 IP 白名单校验失败）。所有接口返回统一 { success, data, error } 结构。
 *
 * 使用方式：
 *   import { suggestAddress, reverseGeocode, calcDrivingDistance, searchPlace } from '@/utils/map'
 *
 * 前置条件：
 *   1. 在 https://lbs.qq.com 注册应用 → 添加 Key → 绑定小程序 AppID
 *   2. 在 .env 文件中配置 VITE_TENCENT_MAP_KEY
 */

// ========== 配置 ==========

/** 腾讯地图 WebService API 基础地址 */
const MAP_BASE = 'https://apis.map.qq.com'

/** API Key（从环境变量读取） */
const MAP_KEY = import.meta.env.VITE_TENCENT_MAP_KEY || ''

/** 请求超时（毫秒） */
const TIMEOUT = 10000

// ========== 内部请求方法 ==========

/**
 * 通过 wx.request 调用腾讯地图 API
 * @param {string} path - API 路径（如 /ws/place/v1/suggestion）
 * @param {object} params - URL 查询参数（会自动拼接 key）
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
function mapRequest(path, params = {}) {
  if (!MAP_KEY) {
    return Promise.resolve({ success: false, error: '腾讯地图 API Key 未配置，请在 .env 中设置 VITE_TENCENT_MAP_KEY' })
  }

  return new Promise((resolve) => {
    const query = Object.keys(params)
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&')

    const url = MAP_BASE + path + '?key=' + MAP_KEY + (query ? '&' + query : '')

    wx.request({
      url,
      method: 'GET',
      timeout: TIMEOUT,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.status === 0) {
          resolve({ success: true, data: res.data })
        } else {
          const msg = (res.data && res.data.message) || `地图服务返回异常 (${res.statusCode})`
          resolve({ success: false, error: msg, raw: res.data })
        }
      },
      fail: (err) => {
        console.error('[map] 请求失败:', err)
        resolve({ success: false, error: '地图服务请求失败，请检查网络' })
      }
    })
  })
}

// ========== 公开 API ==========

/**
 * ① 地址关键词补全（输入提示）
 *
 * 用户输入部分地址时实时返回候选列表，支持省/市/区/街道/POI 混合搜索。
 * 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceSuggestion
 *
 * @param {string} keyword - 搜索关键词（如 "天河城"、"广州塔"）
 * @param {string} [region]  - 限制城市范围（如 "广州"，不传则全国搜索）
 * @returns {Promise<{success: boolean, data?: Array<{
 *   title: string,      // 完整地址文本
 *   province: string,   // 省
 *   city: string,       // 市
 *   district: string,   // 区
 *   address: string,    // 详细地址（街道+门牌号）
 *   latitude: number,   // 纬度
 *   longitude: number,  // 经度
 *   adcode: string,     // 行政区划代码
 * }>, error?: string}>}
 */
export async function suggestAddress(keyword, region = '') {
  const params = {
    keyword: keyword,
    region: region,
    region_fix: region ? 1 : 0, // 限定城市时固定在当前城市
    get_adcode: 1,
  }
  const result = await mapRequest('/ws/place/v1/suggestion', params)
  if (!result.success) return result

  const list = (result.data && result.data.data) || []
  return {
    success: true,
    data: list.map(item => ({
      title: item.title || '',
      province: item.province || '',
      city: item.city || '',
      district: item.district || '',
      address: item.address || '',
      latitude: item.location ? item.location.lat : 0,
      longitude: item.location ? item.location.lng : 0,
      adcode: item.adcode || '',
    }))
  }
}

/**
 * ② 逆地址解析 — GPS 坐标 → 结构化地址
 *
 * 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceGeocoder
 *
 * @param {number} lat - 纬度（GCJ-02）
 * @param {number} lng - 经度（GCJ-02）
 * @returns {Promise<{success: boolean, data?: {
 *   province: string, city: string, district: string,
 *   address: string,       // 完整地址
 *   street: string,        // 街道
 *   recommend: string,     // 推荐地址（门牌号等）
 *   sematicDesc: string,   // 语义化描述（如"天河城附近"）
 *   adcode: string,        // 行政区划代码
 *   latitude: number, longitude: number
 * }, error?: string}>}
 */
export async function reverseGeocode(lat, lng) {
  const result = await mapRequest('/ws/geocoder/v1', {
    location: lat + ',' + lng,
    get_poi: 1,         // 同时返回周边 POI
    poi_options: 'radius=500;policy=1', // 500米内取最近 POI 用于语义化描述
  })
  if (!result.success) return result

  const d = (result.data && result.data.result) || {}
  const addrComp = d.address_component || {}
  const adInfo = d.ad_info || {}
  const formatted = d.formatted_addresses && d.formatted_addresses.recommend
    ? d.formatted_addresses.recommend
    : ''

  return {
    success: true,
    data: {
      province: addrComp.province || '',
      city: addrComp.city || '',
      district: addrComp.district || '',
      address: d.address || '',
      street: addrComp.street || '',
      streetNumber: addrComp.street_number || '',
      recommend: formatted || (addrComp.street || '') + (addrComp.street_number || ''),
      sematicDesc: (d.sematic_description || ''),
      adcode: adInfo.adcode || '',
      latitude: lat,
      longitude: lng,
    }
  }
}

/**
 * ③ 驾车距离计算 — 两点之间真实驾车路线距离
 *
 * 替代 Haversine 直线距离，考虑道路、河流、单行道等因素。
 * 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute
 *
 * @param {{ latitude: number, longitude: number }} from - 起点
 * @param {{ latitude: number, longitude: number }} to   - 终点
 * @returns {Promise<{success: boolean, data?: {
 *   distance: number,    // 驾车距离（公里），保留两位小数
 *   duration: number,    // 预计时长（分钟）
 * }, error?: string}>}
 */
export async function calcDrivingDistance(from, to) {
  const result = await mapRequest('/ws/direction/v1/driving', {
    from: from.latitude + ',' + from.longitude,
    to: to.latitude + ',' + to.longitude,
    output: 'json',
    heading: 0,
    speed: 30,
  })
  if (!result.success) return result

  const route = result.data && result.data.result && result.data.result.routes
    ? result.data.result.routes[0]
    : null
  if (!route) {
    return { success: false, error: '未找到驾车路线' }
  }

  return {
    success: true,
    data: {
      distance: Math.round(route.distance / 10) / 100,   // 米 → 公里，保留两位
      duration: Math.ceil(route.duration / 60),           // 秒 → 分钟，向上取整
    }
  }
}

/**
 * ④ 地点搜索 — 搜附近 POI
 *
 * 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceSearch
 *
 * @param {string} keyword - 搜索关键词（如 "超市"、"医院"）
 * @param {number} lat      - 中心点纬度
 * @param {number} lng      - 中心点经度
 * @param {number} [radius] - 搜索半径（米），默认 3000
 * @returns {Promise<{success: boolean, data?: Array<{
 *   title: string, address: string, category: string,
 *   latitude: number, longitude: number, distance: number
 * }>, error?: string}>}
 */
export async function searchPlace(keyword, lat, lng, radius = 3000) {
  const result = await mapRequest('/ws/place/v1/search', {
    keyword: keyword,
    boundary: 'nearby(' + lat + ',' + lng + ',' + radius + ')',
    page_size: 20,
    orderby: '_distance', // 按距离排序
  })
  if (!result.success) return result

  const list = (result.data && result.data.data) || []
  return {
    success: true,
    data: list.map(item => ({
      title: item.title || '',
      address: item.address || '',
      category: item.category || '',
      latitude: item.location ? item.location.lat : 0,
      longitude: item.location ? item.location.lng : 0,
      distance: Math.round((item._distance || 0) / 10) / 100, // 米 → 公里
    }))
  }
}
