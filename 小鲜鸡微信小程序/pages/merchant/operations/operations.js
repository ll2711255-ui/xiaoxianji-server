const api = require('../../../utils/api');
const { formatMoney, getStatusText } = require('../../../utils/util');
const auth = require('../../../utils/auth');

const CATEGORY_COLORS = ['#D4420A', '#F5A623', '#FF6B35', '#E64A19', '#A83108', '#FFD166'];

Page({
  data: {
    dateLabel: '今天',
    dateOffset: 0,
    loading: true,

    todayRevenue: '0.00',
    todayOrders: 0,
    todayOnlineOrders: 0,
    todayOfflineOrders: 0,
    avgOrderValue: '0.00',

    salesRank: [],
    categoryStats: [],
    recentOrders: []
  },

  onShow() {
    if (!auth.checkMerchant()) return;
    this.buildDateLabel();
    this.loadData();
  },

  onTabChange(e) {
    const key = e.detail.key;
    wx.redirectTo({ url: '/pages/merchant/' + key + '/' + key });
  },

  /**
   * 根据 dateOffset 计算日期范围（当天 00:00:00 ~ 次日 00:00:00）
   */
  _getDateRange() {
    const d = new Date();
    d.setDate(d.getDate() + this.data.dateOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const startDate = `${dateStr}T00:00:00.000Z`;
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    const ny = nextDay.getFullYear();
    const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDay.getDate()).padStart(2, '0');
    const endDate = `${ny}-${nm}-${nd}T00:00:00.000Z`;

    return { startDate, endDate };
  },

  buildDateLabel() {
    const d = new Date();
    d.setDate(d.getDate() + this.data.dateOffset);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const targetStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    if (targetStr === todayStr) {
      this.setData({ dateLabel: '今天' });
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
      if (targetStr === yestStr) {
        this.setData({ dateLabel: '昨天' });
      } else {
        const m = d.getMonth() + 1;
        const day = d.getDate();
        this.setData({ dateLabel: m + '月' + day + '日' });
      }
    }
  },

  onPrevDay() {
    this.setData({ dateOffset: this.data.dateOffset - 1 });
    this.buildDateLabel();
    this.loadData();
  },

  onNextDay() {
    if (this.data.dateOffset >= 0) return;
    this.setData({ dateOffset: this.data.dateOffset + 1 });
    this.buildDateLabel();
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    try {
      const { startDate, endDate } = this._getDateRange();

      // 并行查询线上/线下已完成的订单
      const [onlineRes, offlineRes] = await Promise.all([
        api.get('/merchant/orders', { status: 'completed', type: 'online', pageSize: 200, startDate, endDate }),
        api.get('/merchant/orders', { status: 'completed', type: 'offline', pageSize: 200, startDate, endDate })
      ]);

      const onlineOrders = (onlineRes && onlineRes.data && onlineRes.data.orders) || [];
      const offlineOrders = (offlineRes && offlineRes.data && offlineRes.data.orders) || [];
      const allOrders = [...onlineOrders, ...offlineOrders];

      // 营收 & 订单数
      const totalFen = allOrders.reduce((s, o) => s + (o.actualAmount || o.prepayAmount || 0), 0);
      const revenue = formatMoney(totalFen);
      const orderCount = allOrders.length;
      const avgValue = orderCount > 0 ? formatMoney(Math.round(totalFen / orderCount)) : '0.00';

      // 商品销量排行（仅线上订单有 items）
      const rankMap = {};
      onlineOrders.forEach(o => {
        (o.items || []).forEach(item => {
          const key = item.productId || item.productName;
          if (!rankMap[key]) {
            rankMap[key] = { productId: key, productName: item.productName, count: 0, amount: 0 };
          }
          rankMap[key].count += item.quantity || 1;
          rankMap[key].amount += (item.unitPrice || 0) * (item.quantity || 1);
        });
      });
      const rankList = Object.values(rankMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const maxCount = rankList.length > 0 ? rankList[0].count : 1;
      const salesRank = rankList.map(r => ({
        ...r,
        percent: Math.round((r.count / maxCount) * 100),
        amountDisplay: formatMoney(r.amount)
      }));

      // 品类销量占比
      const catMap = {};
      onlineOrders.forEach(o => {
        (o.items || []).forEach(item => {
          const catName = item.categoryName || item.productName || '其他';
          if (!catMap[catName]) catMap[catName] = 0;
          catMap[catName] += item.quantity || 1;
        });
      });
      offlineOrders.forEach(() => {
        if (!catMap['线下订单']) catMap['线下订单'] = 0;
        catMap['线下订单'] += 1;
      });

      const totalItems = Object.values(catMap).reduce((s, v) => s + v, 0) || 1;
      const catEntries = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const categoryStats = catEntries.map(([name, count], i) => ({
        name,
        count,
        percent: Math.round((count / totalItems) * 100),
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
      }));

      // 最近订单（按时间倒序取前 10）
      const sortedOrders = [...allOrders].sort((a, b) => {
        return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
      });
      const recentOrders = sortedOrders.slice(0, 10).map(o => ({
        ...o,
        amountDisplay: formatMoney(o.actualAmount || o.prepayAmount || 0),
        statusText: getStatusText(o.status, o.type),
        typeLabel: o.type === 'delivery' ? '配送' : o.type === 'pickup' ? '自取' : '线下'
      }));

      this.setData({
        loading: false,
        todayRevenue: revenue,
        todayOrders: orderCount,
        todayOnlineOrders: onlineOrders.length,
        todayOfflineOrders: offlineOrders.length,
        avgOrderValue: avgValue,
        salesRank,
        categoryStats,
        recentOrders
      });
    } catch (err) {
      console.error('加载运营数据失败:', err);
      this.setData({ loading: false });
    }
  }
});
