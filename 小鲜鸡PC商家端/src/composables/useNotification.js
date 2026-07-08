/**
 * 通知封装 Composable
 *
 * 跨平台通知方案：
 *   - Web 环境：浏览器 Notification API（需 HTTPS/localhost）
 *   - Tauri 桌面/移动：@tauri-apps/plugin-notification（系统原生通知）
 *
 * 使用方式：
 *   import { useNotification } from '@/composables/useNotification'
 *   const { notify, requestPermission } = useNotification()
 *   await requestPermission()          // 请求通知权限（首次需用户手势触发）
 *   notify('标题', '正文内容')
 */

import { isTauri } from '@/utils/platform'

// 模块级权限状态（跨组件共享，只需请求一次）
let _permission = 'default'

export function useNotification() {
  /**
   * 请求通知权限
   * Web 端：必须在用户手势（click 等）中调用，否则浏览器会静默拒绝
   * Tauri 端：调用系统权限 API
   * @returns {Promise<boolean>} 是否获得授权
   */
  async function requestPermission() {
    // ===== Tauri 环境 =====
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

    // ===== Web 环境 =====
    if (!('Notification' in window)) {
      _permission = 'denied'
      return false
    }

    // 已授权则直接返回
    if (Notification.permission === 'granted') {
      _permission = 'granted'
      return true
    }

    // 已拒绝则不再请求（避免频繁弹权限框）
    if (Notification.permission === 'denied') {
      _permission = 'denied'
      return false
    }

    const result = await Notification.requestPermission()
    _permission = result
    return result === 'granted'
  }

  /**
   * 发送系统通知
   * 若权限未请求，会自动先请求权限
   * @param {string} title - 通知标题
   * @param {string} body - 通知正文
   */
  async function notify(title, body) {
    // 确保已有权限
    if (_permission !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return
    }

    // ===== Tauri 环境：系统原生通知 =====
    if (isTauri) {
      try {
        const { sendNotification } = await import('@tauri-apps/plugin-notification')
        sendNotification({ title, body })
      } catch (err) {
        console.error('[通知] Tauri 通知发送失败:', err)
      }
      return
    }

    // ===== Web 环境：浏览器 Notification =====
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body })
      } catch (err) {
        console.error('[通知] 浏览器通知发送失败:', err)
      }
    }
  }

  return { requestPermission, notify }
}
