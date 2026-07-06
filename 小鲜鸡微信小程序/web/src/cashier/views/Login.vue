<template>
  <div class="login-page">
    <div class="login-card">
      <h1>🐔 小鲜鸡收银端</h1>
      <el-form :model="form" size="large">
        <el-form-item><el-input v-model="form.phone" placeholder="店员手机号" /></el-form-item>
        <el-form-item><el-input v-model="form.password" type="password" placeholder="密码" show-password @keyup.enter="onLogin" /></el-form-item>
        <el-form-item><el-button type="success" :loading="loading" style="width:100%;height:48px;font-size:18px" @click="onLogin">登 录</el-button></el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../shared/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ phone: '', password: '' });

async function onLogin() {
  if (!form.phone || !form.password) return;
  loading.value = true;
  try {
    await auth.login(form.phone, form.password);
    if (!auth.isCashier) { ElMessage.error('无收银权限'); auth.logout(); return; }
    router.push('/cashier');
  } catch (err: any) { ElMessage.error(err.message || '登录失败'); }
  finally { loading.value = false; }
}
</script>

<style scoped>
.login-page{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#1DB96A,#17A85C)}
.login-card{width:420px;padding:40px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12)}
.login-card h1{text-align:center;margin-bottom:30px;font-size:28px}
</style>
