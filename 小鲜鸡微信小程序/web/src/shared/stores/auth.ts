import { defineStore } from 'pinia';
import { authApi } from '../api';
import { ref, computed } from 'vue';

export interface UserInfo {
  id: number;
  nickName: string;
  avatarUrl: string;
  phone: string;
  role: 'customer' | 'staff' | 'merchant' | 'admin';
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<UserInfo | null>(null);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'merchant');
  const isCashier = computed(() => ['admin', 'merchant', 'staff'].includes(user.value?.role || ''));

  async function login(phone: string, password: string) {
    const res: any = await authApi.passwordLogin(phone, password);
    token.value = res.data.token;
    user.value = res.data.user;
    localStorage.setItem('token', res.data.token);
    return res.data;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isLoggedIn, isAdmin, isCashier, login, logout };
});
