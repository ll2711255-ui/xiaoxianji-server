/**
 * 通知封装 Composable — 跨平台 + 移动端增强
 *
 * 跨平台通知方案：
 *   - Tauri 桌面 → @tauri-apps/plugin-notification（系统原生通知）
 *   - Tauri 移动端 → 系统通知 + 震动 + 提示音
 *   - Web 环境 → 浏览器 Notification API（需 HTTPS/localhost）
 *
 * 使用方式：
 *   import { useNotification } from '@/composables/useNotification'
 *   const { notify, requestPermission } = useNotification()
 *   await requestPermission()
 *   notify('新订单', '点击查看详情', { onClick: () => router.push('/orders/xxx') })
 */

import { isTauri } from '@/utils/platform'

// 模块级权限状态（跨组件共享）
let _permission = 'default'

export function useNotification() {
  /**
   * 请求通知权限
   * Web 端：必须在用户手势（click 等）中调用
   * Tauri 端：调用系统权限 API
   * @returns {Promise<boolean>}
   */
  async function requestPermission() {
    if (isTauri) {
      try {
        const mod = await import('@tauri-apps/plugin-notification')
        let granted = await mod.isPermissionGranted()
        if (!granted) {
          const result = await mod.requestPermission()
          granted = result === 'granted'
        }
        _permission = granted ? 'granted' : 'denied'
        return _permission === 'granted'
      } catch {
        _permission = 'denied'
        return false
      }
    }

    // Web 环境
    if (!('Notification' in window)) {
      _permission = 'denied'
      return false
    }
    if (Notification.permission === 'granted') {
      _permission = 'granted'
      return true
    }
    if (Notification.permission === 'denied') {
      _permission = 'denied'
      return false
    }
    const result = await Notification.requestPermission()
    _permission = result
    return result === 'granted'
  }

  /**
   * 发送系统通知（移动端增强：震动 + 提示音）
   * @param {string} title - 通知标题
   * @param {string} body - 通知正文
   * @param {object} options
   * @param {Function} options.onClick - 点击通知时回调
   * @param {boolean} options.vibrate - 是否震动（移动端默认 true）
   * @param {boolean} options.sound - 是否播放提示音（移动端默认 true）
   * @param {string} options.tag - 通知分组标签
   */
  async function notify(title, body, options = {}) {
    const { onClick, vibrate = true, sound = true, tag } = options

    // 确保权限
    if (_permission !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return
    }

    // ===== Tauri 环境 =====
    if (isTauri) {
      try {
        const { sendNotification } = await import('@tauri-apps/plugin-notification')
        sendNotification({ title, body })
      } catch (err) {
        console.error('[通知] Tauri 通知失败:', err)
      }

      // 移动端增强：震动
      if (vibrate && navigator.vibrate) {
        try {
          navigator.vibrate([200, 100, 200]) // 短震-停-短震
        } catch (_) { /* 不支持震动 */ }
      }

      // 移动端增强：提示音
      if (sound) {
        playBeep()
      }

      // 点击处理
      if (onClick) {
        // Tauri 的 notification 插件不直接支持点击回调
        // 这里通过全局事件机制：在 App.vue 中监听通知点击
        window.__lastNotificationAction = onClick
      }
      return
    }

    // ===== Web 环境 =====
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, { body, tag })
        if (onClick) {
          notif.onclick = () => {
            window.focus()
            onClick()
          }
        }
      } catch (err) {
        console.error('[通知] 浏览器通知失败:', err)
      }
    }
  }

  /**
   * 播放简短提示音（使用 Web Audio API 生成 beep）
   */
  function playBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch (_) { /* 音频不可用 */ }
  }

  /**
   * 获取通知权限状态
   */
  function getPermissionStatus() {
    return _permission
  }

  return { requestPermission, notify, getPermissionStatus }
}
