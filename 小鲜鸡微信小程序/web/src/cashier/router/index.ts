import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/cashier',
    children: [
      { path: 'cashier', component: () => import('../views/Cashier.vue'), meta: { title: '收银' } },
      { path: 'weigh', component: () => import('../views/Weigh.vue'), meta: { title: '称重' } },
      { path: 'queue', component: () => import('../views/OrderQueue.vue'), meta: { title: '订单队列' } },
      { path: 'pickup', component: () => import('../views/PickupConfirm.vue'), meta: { title: '自提核销' } },
    ],
  },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.path !== '/login' && !token) next('/login');
  else next();
});

export default router;
