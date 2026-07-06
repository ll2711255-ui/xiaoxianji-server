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
            :placeholder="loginType === 'manager' ? '请输入店长/管理员账号' : '请输入员工账号'"
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
import api from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)
const loginType = ref('manager') // 'manager' | 'employee'

const form = reactive({ username: 'admin', password: '123456' })
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
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
      authStore.saveTokens(d.accessToken, d.refreshToken)
      authStore.setUser(d.merchantId, d.role, d.name)

      // 根据角色路由到不同界面
      if (d.role === 'employee') {
        router.push('/cashier')
      } else {
        router.push('/dashboard')
      }
    } else {
      ElMessage.error((res && res.message) || '登录失败')
    }
  } catch (err) {
    ElMessage.error('登录失败，请检查网络')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #D4420A 0%, #F5A623 100%);
}
.login-card {
  width: 440px; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.2);
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
</style>
