<template>
  <div class="mobile-mine">
    <!-- 用户信息卡 -->
    <div class="mine-header">
      <el-avatar :size="56" icon="UserFilled" />
      <div class="mine-user-info">
        <span class="mine-name">{{ authStore.userName || '商家用户' }}</span>
        <el-tag :type="roleTag" size="small">{{ roleLabel }}</el-tag>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="mine-menu">
      <div class="menu-item" @click="$router.push('/dashboard')">
        <el-icon :size="20"><Odometer /></el-icon>
        <span>经营仪表盘</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
      <div class="menu-item" @click="$router.push('/products')">
        <el-icon :size="20"><Goods /></el-icon>
        <span>商品管理</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
      <div class="menu-item" @click="$router.push('/numbers')">
        <el-icon :size="20"><CollectionTag /></el-icon>
        <span>号码牌管理</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
      <div class="menu-item" @click="$router.push('/settings/store')">
        <el-icon :size="20"><Setting /></el-icon>
        <span>店铺设置</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
    </div>

    <div class="mine-menu" style="margin-top:12px">
      <div class="menu-item" @click="onToggleNotification">
        <el-icon :size="20"><Bell /></el-icon>
        <span>通知权限：{{ notifStatus }}</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
      <div class="menu-item" @click="$router.push('/settings/payment')">
        <el-icon :size="20"><Wallet /></el-icon>
        <span>支付设置</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
      <div class="menu-item" @click="onAbout">
        <el-icon :size="20"><InfoFilled /></el-icon>
        <span>关于小鲜鸡 v1.0.0</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- 退出按钮 -->
    <el-button type="danger" size="large" plain @click="onLogout" style="width:100%;margin-top:24px;height:50px">
      退出登录
    </el-button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const { requestPermission, getPermissionStatus } = useNotification()

const notifGranted = ref(getPermissionStatus() === 'granted')

const roleLabel = computed(() => {
  const m = { admin: '管理员', manager: '店长', employee: '员工' }
  return m[authStore.role] || '员工'
})

const roleTag = computed(() => {
  const m = { admin: 'danger', manager: 'warning', employee: 'info' }
  return m[authStore.role] || 'info'
})

const notifStatus = computed(() => notifGranted.value ? '已开启' : '未授权')

async function onToggleNotification() {
  if (notifGranted.value) {
    ElMessage.info('通知权限已开启')
    return
  }
  const granted = await requestPermission()
  notifGranted.value = granted
  ElMessage[granted ? 'success' : 'error'](granted ? '通知权限已开启' : '通知权限被拒绝')
}

function onAbout() {
  ElMessage.info('小鲜鸡商家端 v1.0.0\nTauri 2 跨平台 App')
}

async function onLogout() {
  authStore.clearAuth()
  router.push('/login')
}
</script>

<style scoped>
.mobile-mine { padding-bottom: 12px; }

.mine-header {
  display: flex; align-items: center; gap: 14px;
  background: linear-gradient(135deg, #D4420A, #E0552A);
  border-radius: 12px; padding: 20px; margin-bottom: 16px; color: #fff;
}
.mine-user-info { display: flex; flex-direction: column; gap: 6px; }
.mine-name { font-size: 18px; font-weight: 700; }

.mine-menu {
  background: #fff; border-radius: 12px;
  overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.menu-item {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; cursor: pointer; border-bottom: 1px solid #f5f5f5;
  -webkit-tap-highlight-color: transparent; font-size: 15px; color: #333;
}
.menu-item:active { background: #fafafa; }
.menu-item:last-child { border-bottom: none; }
.menu-item > :last-child { margin-left: auto; color: #ccc; }
</style>
