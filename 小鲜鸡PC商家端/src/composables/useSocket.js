/**
 * Socket.IO 实时推送 Composable
 *
 * 用途：接收服务端推送的新订单事件，商家端无需刷新即可看到新订单。
 *
 * 使用方式：
 *   import { useSocket } from '@/composables/useSocket'
 *   const { connect, disconnect, isConnected, onNewPaidOrder } = useSocket()
 *   onNewPaidOrder((order) => { ... })   // 注册新订单回调
 *   connect() / disconnect()              // 登录时连，登出时断
 *
 * 架构：
 *   - 登录后 connect() 建立 WebSocket 连接，带 JWT token 握手鉴权
 *   - 服务端推送 order:new-paid 事件 → 通过 window CustomEvent 分发给各组件
 *   - 登出时 disconnect() 断开连接
 *   - Socket.IO 内置自动重连（指数退避 1s → 30s）
 *   - Token 过期时自动刷新并重连
 */

import { ref, onUnmounted } from "vue"
import { io } from "socket.io-client"
import { useAuthStore } from "@/stores/auth"
import api from "@/utils/api"

const socket = ref(null)
const isConnected = ref(false)
const connectionError = ref(null)

export function useSocket() {
  const authStore = useAuthStore()

  /**
   * 获取 WebSocket 连接地址
   * 小程序/PC 端统一走同一个 API 域名
   */
  function getWsUrl() {
    // Vite 环境变量优先，否则用当前页面域名（生产环境同一个 Nginx 下）
    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
    return base
  }

  /**
   * 建立 Socket.IO 连接
   * 重复调用安全：已连接时跳过
   */
  function connect() {
    if (socket.value?.connected) {
      console.log("[socket] 已连接，跳过重复 connect")
      return
    }

    if (!authStore.token) {
      console.warn("[socket] 未登录，跳过连接")
      return
    }

    // 断开旧连接（如果存在）
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }

    const wsUrl = getWsUrl()

    socket.value = io(wsUrl, {
      path: "/ws",                   // 对应服务端 socket.js 的 path
      auth: { token: authStore.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
      transports: ["websocket", "polling"],  // 优先 WebSocket，降级 polling
    })

    socket.value.on("connect", () => {
      isConnected.value = true
      connectionError.value = null
      console.log("[socket] ✅ 已连接")
    })

    // 接收服务端推送的新订单事件
    socket.value.on("order:new-paid", (order) => {
      console.log("[socket] 收到新订单:", order.orderNo)
      // 通过 window 事件桥分发给各组件（解耦，组件无需依赖 useSocket）
      window.dispatchEvent(new CustomEvent("socket:new-paid-order", { detail: order }))
    })

    socket.value.on("disconnect", (reason) => {
      isConnected.value = false
      console.log("[socket] 断开:", reason)
    })

    socket.value.on("connect_error", async (err) => {
      isConnected.value = false
      connectionError.value = err.message
      console.error("[socket] 连接错误:", err.message)

      // Token 过期 → 尝试自动刷新
      if (err.message.includes("令牌已过期") || err.message.includes("无效")) {
        try {
          const res = await api.post("/auth/refresh-token", {
            refreshToken: authStore.refreshToken,
          }, true)
          if (res && res.success) {
            const d = res.data
            authStore.setAuth(d.accessToken || d.token, d.refreshToken, d.userInfo)
            // 用新 token 重连
            if (socket.value) {
              socket.value.auth.token = authStore.token
              socket.value.connect()
            }
          }
        } catch {
          // 刷新失败 → 登出
          authStore.clearAuth()
          window.location.href = "/login"
        }
      }
    })
  }

  /**
   * 断开 Socket.IO 连接
   */
  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    isConnected.value = false
    connectionError.value = null
  }

  /**
   * 注册新订单回调（自动清理，组件卸载时移除）
   * @param {Function} callback - 收到新订单时调用，参数为 order 对象
   * @returns {Function} 手动取消注册的函数
   */
  function onNewPaidOrder(callback) {
    const handler = (event) => callback(event.detail)
    window.addEventListener("socket:new-paid-order", handler)
    return () => window.removeEventListener("socket:new-paid-order", handler)
  }

  return { socket, isConnected, connectionError, connect, disconnect, onNewPaidOrder }
}
