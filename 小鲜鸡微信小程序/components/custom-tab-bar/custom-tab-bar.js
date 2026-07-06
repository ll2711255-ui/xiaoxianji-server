Component({
  properties: {
    current: {
      type: String,
      value: 'index'
    },
    theme: {
      type: String,
      value: 'customer'
    }
  },

  data: {
    visible: true
  },

  attached() {
    // 子页面（如商品详情、订单详情等）不显示 tabBar
    const pages = getCurrentPages();
    const route = pages[pages.length - 1].route;
    const mainPages = [
      'pages/index/index', 'pages/cart/cart',
      'pages/orders/orders', 'pages/mine/mine',
      'pages/merchant/orders/orders', 'pages/merchant/products/products',
      'pages/merchant/operations/operations', 'pages/merchant/profile/profile'
    ];
    this.setData({ visible: mainPages.includes(route) });
  },

  methods: {
    onTabTap(e) {
      const key = e.currentTarget.dataset.key;
      if (key === this.properties.current) return;
      this.triggerEvent('change', { key });
    }
  }
});
