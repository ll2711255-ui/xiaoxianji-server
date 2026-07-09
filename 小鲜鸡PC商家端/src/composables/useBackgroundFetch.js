/**
 * 后台保活 Composable — 移动端接单必须
 *
 * 增强版（v2）：
 *   - Page Visibility API：页面隐藏时暂停轮询，显示时立即执行 + 恢复
 *   - Network Recovery：断网恢复后立即轮询
 *   - Tauri Resume Bridge：App 从后台恢复时（Rust RunEvent::Resumed → JS）
 *     通过 window 全局事件 "tauri:resume" 立即唤醒
 *   - wakeup()：暴露给外部调用（原生端 resume 事件 / 手动刷新）
 *
 * 各平台行为：
 *   - iOS / Android（Tauri）：前台轮询 + Rust resume 唤醒 + 页面可见性 → 最大程度保活
 *                             等 Tauri 官方 background-fetch plugin 发布后接入真后台
 *   - Web / Desktop：visibility + online 事件，综合覆盖
 *
 * 使用方式：
 *   import { useBackgroundFetch } from '@/composables/useBackgroundFetch'
 *   const { startPoll, stopPoll, wakeup } = useBackgroundFetch()
 *   startPoll(async () => { await checkNewOrders() }, 30000)
 */

// 模块级状态（单例，跨越组件实例共享）
let _timer = null
let _callback = null
let _interval = 30000
let _running = false

/** 内部：执行一次轮询并重置定时器 */
async function _executeAndReset() {
  if (typeof _callback !== 'function') return
  try {
    await _callback()
  } catch (err) {
    console.error('[mobile] 轮询回调异常:', err)
  }
  // 重置定时器（从此刻重新计时）
  if (_running) {
    _clearTimer()
    _timer = setInterval(_executeAndReset, _interval)
  }
}

/** 内部：清除定时器 */
function _clearTimer() {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

/** 内部：页面可见性变化处理 */
function _onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // 页面恢复可见：立即执行一次 + 恢复定时器
    if (_running && !_timer) {
      console.log('[mobile] 页面可见 → 立即轮询 + 恢复定时器')
      _executeAndReset()
    }
  } else {
    // 页面隐藏：暂停定时器（系统会节流 setInterval，主动停掉更省电）
    if (_timer) {
      console.log('[mobile] 页面隐藏 → 暂停轮询')
      _clearTimer()
    }
  }
}

/** 内部：网络恢复处理 */
function _onOnline() {
  if (_running) {
    console.log('[mobile] 网络恢复 → 立即轮询')
    _executeAndReset()
  }
}

/** 内部：Tauri 原生 resume 事件处理 */
function _onTauriResume() {
  if (_running) {
    console.log('[mobile] Tauri Resume → 立即轮询')
    _executeAndReset()
  }
}

export function useBackgroundFetch() {
  /**
   * 启动轮询
   * @param {Function} callback - 每次轮询执行的回调（支持 async）
   * @param {number} interval - 轮询间隔（毫秒），默认 30s
   */
  function startPoll(callback, interval = 30000) {
    // 先停止旧轮询
    stopPoll()

    _callback = callback
    _interval = interval
    _running = true

    // 绑定可见性事件
    document.addEventListener('visibilitychange', _onVisibilityChange)
    // 绑定网络恢复事件
    window.addEventListener('online', _onOnline)
    // 绑定 Tauri resume 事件（Rust 端通过 window.emit("resume") 触发）
    window.addEventListener('tauri:resume', _onTauriResume)

    // 立即执行一次
    _executeAndReset()

    console.log(`[mobile] 增强轮询已启动（每 ${interval / 1000}s，含可见性/网络恢复/原生唤醒）`)
  }

  /**
   * 停止轮询
   */
  function stopPoll() {
    _running = false
    _clearTimer()
    _callback = null

    document.removeEventListener('visibilitychange', _onVisibilityChange)
    window.removeEventListener('online', _onOnline)
    window.removeEventListener('tauri:resume', _onTauriResume)
  }

  /**
   * 手动唤醒：立即执行一次轮询并重置定时器
   * 供外部调用（如下拉刷新、收到推送通知等场景）
   */
  function wakeup() {
    if (!_running || typeof _callback !== 'function') {
      console.warn('[mobile] wakeup 跳过：轮询未启动')
      return
    }
    console.log('[mobile] 手动唤醒 → 立即轮询')
    _executeAndReset()
  }

  return { startPoll, stopPoll, wakeup }
}
