<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onLaunch(() => {
  console.log('[小鲜鸡] App 启动')
  // 恢复缓存的鉴权信息
  authStore.restoreAuth()
  // 静默登录（获取 JWT token）
  authStore.silentLogin()
  // 延迟执行健康检查（不阻塞启动）
  setTimeout(() => healthCheck(), 3000)
})

onShow(() => {
  console.log('[小鲜鸡] App 进入前台')
})

onHide(() => {
  console.log('[小鲜鸡] App 进入后台')
})

/** 启动时健康检查：验证服务器状态 */
async function healthCheck() {
  try {
    const { request } = await import('@/utils/request')
    const res = await request('GET', '/health')
    if (res && res.statusCode === 200 && res.data) {
      const h = res.data
      console.log('[健康检查] 服务状态:', h.status)
      if (h.status === 'degraded') {
        const failed = Object.entries(h.services || {})
          .filter(([, v]) => v === 'error')
          .map(([k]) => k)
          .join('、')
        console.warn('[健康检查] ⚠️ 服务降级，不可用组件:', failed)
      }
    }
  } catch (_) {
    console.warn('[健康检查] 服务器不可达，请检查网络')
  }
}
</script>

<style lang="scss">
/* ========== 全局设计系统 v2 ========== */
/* 引入视觉 Token 系统 */
@import '@/styles/tokens.scss';

/* ---------- 页面基础样式 ---------- */
page {
  background-color: var(--color-bg-page);
  color: var(--color-text-1);
  font-size: var(--font-base);
  font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ========== 卡片 ========== */
.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-full {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
  box-shadow: var(--shadow-card);
}

/* ========== 主按钮 ========== */
.btn-primary {
  background: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: var(--font-base);
  font-weight: var(--weight-medium);
  padding: 0 var(--space-xl);
  height: 88rpx;
  line-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  text-align: center;

  &:active {
    background: var(--color-primary-dark);
  }

  &[disabled] {
    background: var(--color-bg-input);
    color: var(--color-text-3);
  }
}

/* ========== 次按钮 ========== */
.btn-outline {
  background: var(--color-bg-card);
  color: var(--color-primary);
  border: 2rpx solid var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-base);
  font-weight: var(--weight-medium);
  padding: 0 var(--space-xl);
  height: 88rpx;
  line-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  &:active {
    background: var(--color-primary-pale);
  }
}

/* ========== 价格 ========== */
.price {
  color: var(--color-primary);
  font-weight: var(--weight-bold);
}

.price-symbol {
  font-size: var(--font-sm);
  font-weight: var(--weight-bold);
  color: var(--color-primary);
}

.price-value {
  font-size: var(--font-xl);
  font-weight: var(--weight-bold);
  color: var(--color-primary);
}

/* ========== 标签基类 ========== */
.tag {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  padding: 4rpx 16rpx;
  font-size: var(--font-xs);
  font-weight: var(--weight-medium);
  line-height: 1.5;
}

.tag-green  { background-color: var(--color-success-bg); color: var(--color-success); }
.tag-orange { background-color: var(--color-warning-bg); color: var(--color-warning); }
.tag-red    { background-color: var(--color-danger-bg);  color: var(--color-danger);  }
.tag-gray   { background-color: var(--color-bg-input);   color: var(--color-text-2);  }

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-xl) 0;
  gap: var(--space-md);

  .empty-icon {
    font-size: 104rpx;
    margin-bottom: var(--space-md);
    opacity: 0.6;
  }

  text {
    font-size: var(--font-base);
  }

  .empty-hint {
    font-size: var(--font-md);
    margin-top: var(--space-xs);
    color: var(--color-text-3);
  }
}

/* ========== 加载更多 ========== */
.load-more {
  text-align: center;
  padding: var(--space-md);
  color: var(--color-text-3);
  font-size: var(--font-sm);
}

/* ========== 分割线 ========== */
.divider {
  height: 1rpx;
  background: var(--color-border);
  margin: 0 var(--space-md);
}

/* ========== 底部安全区 ========== */
.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
