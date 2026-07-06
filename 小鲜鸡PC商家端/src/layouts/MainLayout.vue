<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <!-- Logo -->
      <div class="logo" @click="$router.push('/dashboard')">
        <span v-if="!collapsed" class="logo-text">🐔 小鲜鸡商家端</span>
        <span v-else class="logo-text-short">🐔</span>
      </div>

      <!-- 两大区切换按钮 -->
      <div class="zone-switch">
        <!-- 商家管理后台：员工不可点击 -->
        <div
          class="zone-btn"
          :class="{ active: currentZone === 'admin', disabled: authStore.isEmployee }"
          @click="authStore.isEmployee ? null : switchZone('admin')"
        >
          <el-icon :size="collapsed ? 20 : 18"><HomeFilled /></el-icon>
          <span v-if="!collapsed" class="zone-label">商家管理后台</span>
        </div>
        <!-- 收银端：所有人可用 -->
        <div
          class="zone-btn"
          :class="{ active: currentZone === 'cashier' }"
          @click="switchZone('cashier')"
        >
          <el-icon :size="collapsed ? 20 : 18"><Sell /></el-icon>
          <span v-if="!collapsed" class="zone-label">收银端</span>
        </div>
      </div>

      <!-- 管理后台菜单（仅商家管理后台区显示） -->
      <el-menu
        v-if="currentZone === 'admin'"
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        background-color="#1f1f1f"
        text-color="#ccc"
        active-text-color="#D4420A"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><List /></el-icon>
          <template #title>订单管理</template>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <template #title>商品管理</template>
        </el-menu-item>
        <el-menu-item index="/operations">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>运营数据</template>
        </el-menu-item>
        <el-menu-item index="/numbers">
          <el-icon><CollectionTag /></el-icon>
          <template #title>号码牌管理</template>
        </el-menu-item>
        <el-menu-item index="/banners">
          <el-icon><PictureFilled /></el-icon>
          <template #title>广告管理</template>
        </el-menu-item>

        <el-menu-item v-if="authStore.isAdmin" index="/accounts">
          <el-icon><UserFilled /></el-icon>
          <template #title>账号管理</template>
        </el-menu-item>

        <el-sub-menu index="settings">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </template>
          <el-menu-item index="/settings/store">
            <el-icon><Shop /></el-icon>
            <template #title>店铺设置</template>
          </el-menu-item>
          <el-menu-item index="/settings/payment">
            <el-icon><Wallet /></el-icon>
            <template #title>支付设置</template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>

      <!-- 收银端菜单（仅收银端区显示） -->
      <el-menu
        v-if="currentZone === 'cashier'"
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        background-color="#1f1f1f"
        text-color="#ccc"
        active-text-color="#D4420A"
      >
        <el-menu-item index="/cashier">
          <el-icon><Sell /></el-icon>
          <template #title>收银界面</template>
        </el-menu-item>
        <el-menu-item index="/cashier/orders">
          <el-icon><List /></el-icon>
          <template #title>订单管理</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="collapsed = !collapsed">
            <el-icon :size="20"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <span class="merchant-name">{{ authStore.userName || '商家用户' }}</span>
          <el-tag v-if="authStore.role === 'admin'" size="small" type="danger">管理员</el-tag>
          <el-tag v-else-if="authStore.role === 'manager'" size="small" type="warning">店长</el-tag>
          <el-tag v-else size="small" type="info">员工</el-tag>
          <el-button text type="danger" @click="onLogout">退出</el-button>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const collapsed = ref(false)

const currentZone = computed(() => {
  return route.path.startsWith('/cashier') ? 'cashier' : 'admin'
})

const activeMenu = computed(() => {
  const path = route.path
  // 收银端路由
  if (path.startsWith('/cashier/orders')) return '/cashier/orders'
  if (path.startsWith('/cashier')) return '/cashier'
  // 管理后台路由
  if (path.startsWith('/orders')) return '/orders'
  if (path.startsWith('/products')) return '/products'
  return path
})

const currentTitle = computed(() => route.meta?.title || '')

function switchZone(zone) {
  if (zone === 'cashier') {
    router.push('/cashier')
  } else {
    router.push('/dashboard')
  }
}

function onLogout() {
  authStore.clearAuth()
  router.push('/login')
}
</script>

<style scoped>
.layout { height: 100vh; }
.sidebar {
  background-color: #1f1f1f;
  overflow-x: hidden;
  transition: width 0.3s;
  display: flex; flex-direction: column;
}
.logo {
  height: 60px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; border-bottom: 1px solid #333; flex-shrink: 0;
}
.logo-text { color: #fff; font-size: 16px; font-weight: 700; white-space: nowrap; }
.logo-text-short { color: #fff; font-size: 22px; }

/* ====== 两大区切换按钮 ====== */
.zone-switch {
  padding: 12px 8px; display: flex; flex-direction: column; gap: 6px;
  border-bottom: 1px solid #333;
}
.zone-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  color: #999; transition: all 0.25s; border: 1.5px solid transparent;
}
.zone-btn:hover {
  color: #ddd; background: rgba(255,255,255,0.05);
}
.zone-btn.active {
  color: #fff; background: #D4420A; border-color: #D4420A;
}
.zone-btn.disabled {
  opacity: 0.35; cursor: not-allowed;
}
.zone-btn.disabled:hover {
  color: #999; background: transparent; border-color: transparent;
}
.zone-label {
  font-size: 14px; font-weight: 600; white-space: nowrap;
}

.el-menu { border-right: none; flex: 1; overflow-y: auto; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-bottom: 1px solid #eee; padding: 0 20px; height: 60px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; align-items: center; gap: 12px; }
.merchant-name { color: #666; font-size: 14px; font-weight: 500; }
.main { background: #f5f6fa; padding: 20px; overflow-y: auto; }
</style>
