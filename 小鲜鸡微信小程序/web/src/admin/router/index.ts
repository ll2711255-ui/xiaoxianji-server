import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '数据看板' } },
      { path: 'orders', component: () => import('../views/orders/OrderList.vue'), meta: { title: '订单管理' } },
      { path: 'orders/:orderNo', component: () => import('../views/orders/OrderDetail.vue'), meta: { title: '订单详情' } },
      { path: 'products', component: () => import('../views/products/ProductList.vue'), meta: { title: '商品管理' } },
      { path: 'products/edit/:id?', component: () => import('../views/products/ProductEdit.vue'), meta: { title: '商品编辑' } },
      { path: 'categories', component: () => import('../views/products/CategoryManage.vue'), meta: { title: '分类管理' } },
      { path: 'shipping', component: () => import('../views/shipping/ShippingManage.vue'), meta: { title: '发货管理' } },
      { path: 'after-sale', component: () => import('../views/after-sale/AfterSaleList.vue'), meta: { title: '售后管理' } },
      { path: 'coupons', component: () => import('../views/marketing/CouponList.vue'), meta: { title: '优惠券' } },
      { path: 'coupons/create', component: () => import('../views/marketing/CouponCreate.vue'), meta: { title: '创建优惠券' } },
      { path: 'config', component: () => import('../views/config/StoreConfig.vue'), meta: { title: '店铺设置' } },
      { path: 'banners', component: () => import('../views/config/BannerManage.vue'), meta: { title: '轮播图' } },
      { path: 'staff', component: () => import('../views/staff/StaffManage.vue'), meta: { title: '店员管理' } },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.path !== '/login' && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
