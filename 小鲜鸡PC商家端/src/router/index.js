import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { detectMobile } from '@/utils/platform'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { noAuth: true }
  },
  // ===== 移动端布局（底部 TabBar） =====
  {
    path: '/mobile',
    component: () => import('@/layouts/MobileLayout.vue'),
    redirect: '/mobile/orders',
    children: [
      {
        path: 'orders',
        name: 'MobileOrders',
        component: () => import('@/views/mobile/MobileOrderList.vue'),
        meta: { title: '订单' }
      },
      {
        path: 'orders/:orderNo',
        name: 'MobileOrderDetail',
        component: () => import('@/views/orders/OrderDetail.vue'),
        meta: { title: '订单详情' }
      },
      {
        path: 'weigh',
        name: 'MobileWeigh',
        component: () => import('@/views/mobile/MobileWeigh.vue'),
        meta: { title: '称重' }
      },
      {
        path: 'weigh/:orderNo',
        name: 'MobileWeighOrder',
        component: () => import('@/views/Weigh.vue'),
        meta: { title: '称重' }
      },
      {
        path: 'stock',
        name: 'MobileStock',
        component: () => import('@/views/mobile/MobileStock.vue'),
        meta: { title: '库存' }
      },
      {
        path: 'mine',
        name: 'MobileMine',
        component: () => import('@/views/mobile/MobileMine.vue'),
        meta: { title: '我的' }
      },
      {
        path: 'scan',
        name: 'MobileScan',
        component: () => import('@/views/mobile/MobileScan.vue'),
        meta: { title: '扫码接单' }
      }
    ]
  },
  // ===== 桌面端布局（侧边栏） =====
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      // ===== 商家管理后台页面 =====
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('@/views/orders/OrderList.vue'),
        meta: { title: '订单管理', icon: 'List' }
      },
      {
        path: 'orders/:orderNo',
        name: 'OrderDetail',
        component: () => import('@/views/orders/OrderDetail.vue'),
        meta: { title: '订单详情', icon: 'Document' }
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/ProductList.vue'),
        meta: { title: '商品管理', icon: 'Goods' }
      },
      {
        path: 'products/new',
        name: 'ProductNew',
        component: () => import('@/views/products/ProductEdit.vue'),
        meta: { title: '新增商品', icon: 'Plus' }
      },
      {
        path: 'products/:id/edit',
        name: 'ProductEdit',
        component: () => import('@/views/products/ProductEdit.vue'),
        meta: { title: '编辑商品', icon: 'Edit' }
      },
      {
        path: 'operations',
        name: 'Operations',
        component: () => import('@/views/operations/Operations.vue'),
        meta: { title: '运营数据', icon: 'DataAnalysis' }
      },
      {
        path: 'numbers',
        name: 'Numbers',
        component: () => import('@/views/numbers/PaiNumbers.vue'),
        meta: { title: '号码牌管理', icon: 'CollectionTag' }
      },
      {
        path: 'banners',
        name: 'Banners',
        component: () => import('@/views/banners/BannerManage.vue'),
        meta: { title: '广告管理', icon: 'PictureFilled' }
      },
      {
        path: 'accounts',
        name: 'Accounts',
        component: () => import('@/views/AccountManagement.vue'),
        meta: { title: '账号管理', icon: 'UserFilled', requireRole: ['admin', 'manager'] }
      },
      {
        path: 'accounts/logs',
        name: 'AccountLogs',
        component: () => import('@/views/AccountManagement.vue'),
        meta: { title: '操作日志', requireRole: ['admin'] }
      },
      {
        path: 'settings/store',
        name: 'StoreSettings',
        component: () => import('@/views/store/StoreConfig.vue'),
        meta: { title: '店铺设置', icon: 'Shop' }
      },
      {
        path: 'settings/payment',
        name: 'PaymentSettings',
        component: () => import('@/views/settings/PaymentSettings.vue'),
        meta: { title: '支付设置', icon: 'Wallet' }
      },
      // ===== 收银端（侧边栏共享，内容切换） =====
      {
        path: 'cashier',
        name: 'Cashier',
        component: () => import('@/views/cashier/CashierPOS.vue'),
        meta: { title: '收银端' }
      },
      {
        path: 'cashier/orders',
        name: 'CashierOrders',
        component: () => import('@/views/cashier/CashierOrders.vue'),
        meta: { title: '订单管理' }
      },
      {
        path: 'cashier/orders/:orderNo',
        name: 'CashierOrderDetail',
        component: () => import('@/views/orders/OrderDetail.vue'),
        meta: { title: '订单详情', backPath: '/cashier/orders' }
      },
      {
        path: 'weigh/:orderNo',
        name: 'Weigh',
        component: () => import('@/views/Weigh.vue'),
        meta: { title: '称重' }
      }
    ]
  }
]

const router = createRouter({
  history: import.meta.env.MODE === 'tauri'
    ? createWebHashHistory()
    : createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 管理后台专属路由路径（员工不能访问）
const adminPaths = [
  '/dashboard', '/orders', '/products', '/operations',
  '/numbers', '/banners', '/accounts', '/settings'
]

// 登录守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isMobile = detectMobile()

  if (to.meta.noAuth) {
    if (authStore.isLoggedIn && to.path === '/login') {
      // 移动端登录后进订单页，桌面端进仪表盘/收银
      if (isMobile) {
        next('/mobile/orders')
      } else {
        next(authStore.isStaff ? '/cashier' : '/dashboard')
      }
    } else {
      next()
    }
    return
  }

  // Mock 模式仅在开发环境生效
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    if (!authStore.isLoggedIn) {
      authStore.setAuth('mock_token', 'mock_rt', {
        id: '1', username: 'admin', role: 'admin', displayName: '管理员'
      })
    }
    next()
    return
  }

  if (!authStore.isLoggedIn) {
    next('/login')
    return
  }

  // 角色路由守卫：meta.requireRole 限定可访问角色
  if (to.meta.requireRole) {
    if (!to.meta.requireRole.includes(authStore.userInfo?.role)) {
      next('/dashboard')
      return
    }
  }

  // 移动端：所有路径重定向到移动端路由
  if (isMobile && !to.path.startsWith('/mobile') && !to.path.startsWith('/login')) {
    next('/mobile/orders')
    return
  }

  // 员工在桌面端不能访问管理后台页面
  if (authStore.isStaff && !isMobile) {
    const isAdminPath = adminPaths.some(p => to.path === p || to.path.startsWith(p + '/'))
    if (isAdminPath) {
      next('/cashier')
      return
    }
  }

  next()
})

export default router
