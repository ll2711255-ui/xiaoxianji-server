/**
 * Axios 请求封装 — 统一拦截器
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：附加 JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一错误处理
api.interceptors.response.use(
  (res) => {
    const { data } = res;
    if (data.code !== 0 && data.code !== undefined) {
      // 业务错误
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      const authStore = useAuthStore();
      authStore.logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// ========== 各模块 API ==========

// ---- Auth ----
export const authApi = {
  wechatLogin: (code: string) => api.post('/auth/wechat-login', { code }),
  passwordLogin: (phone: string, password: string) =>
    api.post('/auth/password-login', { phone, password }),
  refresh: () => api.post('/auth/refresh'),
};

// ---- Products ----
export const productApi = {
  list: (params?: any) => api.get('/products', { params }),
  detail: (id: number) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/products/${id}/status`, { status }),
  updateStock: (id: number, data: any) =>
    api.patch(`/products/${id}/stock`, data),
};

// ---- Categories ----
export const categoryApi = {
  list: () => api.get('/products/categories/list'),
  create: (data: any) => api.post('/products/categories', data),
  delete: (id: number) => api.delete(`/products/categories/${id}`),
  sort: (items: { id: number; sortOrder: number }[]) =>
    api.put('/products/categories/sort', { items }),
};

// ---- Orders ----
export const orderApi = {
  list: (params?: any) => api.get('/orders', { params }),
  detail: (orderNo: string) => api.get(`/orders/${orderNo}`),
  create: (data: any) => api.post('/orders', data),
  createOffline: (data: any) => api.post('/orders/offline', data),
  updateStatus: (orderNo: string, action: string) =>
    api.patch(`/orders/${orderNo}/status`, { action }),
  weigh: (orderNo: string, data: any) =>
    api.patch(`/orders/${orderNo}/weigh`, data),
  ship: (orderNo: string, trackingNo: string) =>
    api.patch(`/orders/${orderNo}/ship`, { trackingNo }),
  pickup: (orderNo: string) => api.patch(`/orders/${orderNo}/pickup`),
  refund: (orderNo: string, data: any) =>
    api.post(`/orders/${orderNo}/refund`, data),
  rebuy: (orderNo: string) => api.post(`/orders/${orderNo}/rebuy`),
};

// ---- Dashboard ----
export const dashboardApi = {
  overview: () => api.get('/dashboard/overview'),
  trends: (days?: number) => api.get('/dashboard/trends', { params: { days } }),
  hotProducts: (limit?: number) =>
    api.get('/dashboard/hot-products', { params: { limit } }),
  export: (params?: any) =>
    api.get('/dashboard/export', { params, responseType: 'blob' }),
};

// ---- Config ----
export const configApi = {
  getStore: () => api.get('/config/store'),
  updateStore: (data: any) => api.put('/config/store', data),
  getBanners: () => api.get('/config/banners'),
  updateBanners: (banners: any[]) => api.put('/config/banners', { banners }),
};

// ---- Marketing ----
export const marketingApi = {
  couponList: (params?: any) => api.get('/marketing/coupons', { params }),
  createCoupon: (data: any) => api.post('/marketing/coupons', data),
  updateCouponStatus: (id: number, status: string) =>
    api.patch(`/marketing/coupons/${id}/status`, { status }),
};

// ---- Users ----
export const userApi = {
  profile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  staffList: () => api.get('/users/staff'),
  createStaff: (data: any) => api.post('/users/staff', data),
};

// ---- Upload ----
export const uploadApi = {
  image: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
