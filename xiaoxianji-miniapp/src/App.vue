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
/* ========== 全局设计系统 ========== */
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

/* ========== 通用容器 ========== */
.container {
  padding: 20rpx 24rpx;
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
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: var(--shadow-card);
}

/* ========== 按钮 ========== */
.btn-primary {
  background: var(--color-primary);
  color: #FFFFFF;
  border-radius: 40rpx;
  font-size: var(--font-base);
  font-weight: 600;
  padding: 16rpx 32rpx;
  text-align: center;
  display: inline-block;
  border: none;

  &:active {
    background: var(--color-primary-dark);
  }

  &[disabled] {
    background: var(--color-bg-input);
    color: var(--color-text-3);
  }
}

.btn-outline {
  background: #fff;
  color: var(--color-primary);
  border: 2rpx solid var(--color-primary);
  border-radius: 40rpx;
  font-size: var(--font-base);
  padding: 16rpx 32rpx;
  text-align: center;

  &:active {
    background: var(--color-primary-pale);
  }
}

/* ========== 价格 ========== */
.price {
  color: var(--color-primary);
  font-weight: 700;
}

.price-symbol {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-primary);
}

.price-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--color-primary);
}

/* ========== 标签 ========== */
.tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-md);
  font-size: var(--font-xs);
  line-height: 1.5;
}

.tag-green {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.tag-orange {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
}

.tag-red {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.tag-gray {
  background-color: var(--color-bg-input);
  color: var(--color-text-2);
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 48rpx;

  .empty-icon {
    font-size: 104rpx;
    margin-bottom: 24rpx;
    opacity: 0.6;
  }

  text {
    font-size: 32rpx;
  }

  .empty-hint {
    font-size: 28rpx;
    margin-top: 12rpx;
  }
}

/* ========== 加载更多 ========== */
.load-more {
  text-align: center;
  padding: 24rpx;
  color: var(--color-text-3);
  font-size: 28rpx;
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
