<template>
  <el-container>
    <el-aside width="220px" class="sidebar">
      <div class="logo">🐔 小鲜鸡商家</div>
      <el-menu :default-active="currentPath" router background-color="#304156" text-color="#bfcbd9" active-text-color="#1DB96A">
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis /></el-icon> 数据看板</el-menu-item>
        <el-sub-menu index="orders">
          <template #title><el-icon><Tickets /></el-icon> 订单管理</template>
          <el-menu-item index="/orders">全部订单</el-menu-item>
          <el-menu-item index="/shipping">发货管理</el-menu-item>
          <el-menu-item index="/after-sale">售后管理</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="products">
          <template #title><el-icon><Goods /></el-icon> 商品管理</template>
          <el-menu-item index="/products">商品列表</el-menu-item>
          <el-menu-item index="/categories">分类管理</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="marketing">
          <template #title><el-icon><Present /></el-icon> 营销管理</template>
          <el-menu-item index="/coupons">优惠券</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/config"><el-icon><Setting /></el-icon> 店铺设置</el-menu-item>
        <el-menu-item index="/banners"><el-icon><Picture /></el-icon> 轮播图</el-menu-item>
        <el-menu-item index="/staff"><el-icon><UserFilled /></el-icon> 店员管理</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <span class="title">{{ $route.meta.title }}</span>
        <el-dropdown @command="onCommand">
          <span class="user-dropdown">{{ auth.user?.nickName || auth.user?.phone }} <el-icon><ArrowDown /></el-icon></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../shared/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const currentPath = computed(() => route.path);

function onCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.sidebar { background: #304156; min-height: 100vh; overflow-y: auto; }
.sidebar .logo { color: #fff; font-size: 20px; text-align: center; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
.topbar { background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.topbar .title { font-size: 18px; font-weight: 600; color: #333; }
.user-dropdown { cursor: pointer; color: #666; }
.el-main { background: #f0f2f5; min-height: calc(100vh - 60px); padding: 24px; }
</style>
