<template>
  <div class="layout">
    <header class="topbar">
      <span class="store-name">🐔 小鲜鸡</span>
      <nav>
        <router-link to="/cashier" class="nav-link">收银</router-link>
        <router-link to="/weigh" class="nav-link">称重</router-link>
        <router-link to="/queue" class="nav-link">队列</router-link>
        <router-link to="/pickup" class="nav-link">核销</router-link>
      </nav>
      <el-dropdown @command="onCmd">
        <span class="user">{{ auth.user?.nickName || auth.user?.phone }} ▾</span>
        <template #dropdown><el-dropdown-menu><el-dropdown-item command="logout">退出</el-dropdown-item></el-dropdown-menu></template>
      </el-dropdown>
    </header>
    <main><router-view /></main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../shared/stores/auth';
const router = useRouter();
const auth = useAuthStore();
function onCmd(cmd: string) { if (cmd==='logout') { auth.logout(); router.push('/login'); } }
</script>

<style scoped>
.layout{min-height:100vh;background:#f5f5f5}
.topbar{background:#1DB96A;color:#fff;display:flex;align-items:center;padding:0 24px;height:56px;gap:24px}
.store-name{font-size:20px;font-weight:bold}
.nav-link{color:rgba(255,255,255,.85);text-decoration:none;font-size:16px;padding:4px 12px;border-radius:6px}
.nav-link:hover,.router-link-active{background:rgba(255,255,255,.2);color:#fff}
.user{margin-left:auto;cursor:pointer;font-size:15px}
main{padding:24px;max-width:1200px;margin:0 auto}
</style>
