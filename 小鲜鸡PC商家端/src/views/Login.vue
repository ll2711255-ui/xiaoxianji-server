<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">🐔 小鲜鸡商家端</h1>

      <!-- 角色选项卡 -->
      <div class="login-tabs">
        <div
          class="login-tab"
          :class="{ active: loginType === 'manager' }"
          @click="loginType = 'manager'"
        >
          <el-icon><UserFilled /></el-icon>
          <span>店长 / 管理员登录</span>
        </div>
        <div
          class="login-tab"
          :class="{ active: loginType === 'employee' }"
          @click="loginType = 'employee'"
        >
          <el-icon><Avatar /></el-icon>
          <span>员工登录</span>
        </div>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="onLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" native-type="submit" class="login-btn">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <p class="login-hint" v-if="false">初始账号 admin，密码 123456</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { detectMobile } from '@/utils/platform'
import api from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()
const isMobile = detectMobile()
const formRef = ref(null)
const loading = ref(false)
const loginType = ref('manager') // 'manager' | 'employee'

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await api.post('/auth/merchant-login', {
      username: form.username,
      password: form.password
    }, true)

    if (res && res.success) {
      const d = res.data
      authStore.setAuth(d.token, d.refreshToken, d.userInfo)

      // 根据角色和平台路由到不同界面
      if (isMobile) {
        router.push('/mobile/orders')
      } else if (d.userInfo.role === 'staff') {
        router.push('/cashier')
      } else {
        router.push('/dashboard')
      }
    } else {
      ElMessage.error((res && res.message) || '登录失败')
    }
  } catch (err) {
    // 处理限流（429）和服务器错误
    if (err.response) {
      const { status, data } = err.response
      if (status === 429) {
        ElMessage.error(data?.message || '登录失败次数过多，请15分钟后再试')
      } else if (status === 401) {
        ElMessage.error(data?.message || '用户名或密码错误')
      } else if (status === 403) {
        ElMessage.error(data?.message || '账号已被禁用')
      } else {
        ElMessage.error(data?.message || '登录失败，请检查网络')
      }
    } else {
      ElMessage.error('登录失败，请检查网络')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #D4420A 0%, #F5A623 100%);
  padding: 0 16px;
}
.login-card {
  width: 100%; max-width: 440px; padding: 40px 32px; background: #fff;
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.2);
}
.login-title {
  text-align: center; font-size: 26px; color: #333; margin-bottom: 24px; font-weight: 700;
}
.login-tabs {
  display: flex; gap: 12px; margin-bottom: 28px;
}
.login-tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 8px; border-radius: 8px; cursor: pointer;
  background: #f5f6fa; color: #909399; font-size: 14px; font-weight: 500;
  border: 2px solid transparent; transition: all 0.25s;
}
.login-tab:hover {
  color: #D4420A; border-color: #f0c8b3;
}
.login-tab.active {
  background: #fff7f3; color: #D4420A; border-color: #D4420A;
}
.login-btn {
  width: 100%;
}
.login-hint {
  text-align: center; color: #bbb; font-size: 12px; margin-top: 4px;
}

/* 小屏适配 */
@media (max-width: 480px) {
  .login-card {
    padding: 28px 20px;
  }
  .login-title {
    font-size: 22px;
  }
  .login-tab {
    font-size: 13px;
    padding: 10px 4px;
  }
}
</style>
