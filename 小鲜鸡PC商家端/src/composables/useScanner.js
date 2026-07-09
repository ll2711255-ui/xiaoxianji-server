/**
 * 扫码 Composable — 跨平台扫码封装
 *
 * 调用链：
 *   Tauri 移动端 → @tauri-apps/plugin-barcode-scanner（原生相机扫码）
 *   Web 端 → 手动输入框降级（浏览器无原生扫码 API）
 *
 * 使用方式：
 *   import { useScanner } from '@/composables/useScanner'
 *   const { scan } = useScanner()
 *   const result = await scan()  // → { text: 'ORD202607090001' } 或 null（用户取消）
 */

import { isTauri } from '@/utils/platform'
import { ElMessageBox } from 'element-plus'

export function useScanner() {
  /**
   * 调起扫码
   * @param {object} options
   * @param {string} options.hint - 扫码提示文字
   * @param {boolean} options.windowed - 是否窗口模式（桌面端在窗口内扫描）
   * @returns {Promise<{text: string}|null>}
   */
  async function scan(options = {}) {
    const { hint = '扫描订单号条形码', windowed = false } = options

    // ===== Tauri 环境：原生扫码 =====
    if (isTauri) {
      try {
        const mod = await import('@tauri-apps/plugin-barcode-scanner')

        // 先检查权限
        let hasPermission = false
        try {
          const status = await mod.checkPermissions()
          hasPermission = status === 'granted'
        } catch (_) { /* 权限检查失败，直接尝试扫码 */ }

        if (!hasPermission) {
          try {
            const result = await mod.requestPermissions()
            hasPermission = result === 'granted'
          } catch (_) { /* 权限请求被拒绝 */ }
        }

        if (!hasPermission) {
          // 权限被拒 → 降级到手输
          return manualInput(hint)
        }

        // 执行扫码
        const scanResult = await mod.scan({
          camera_direction: 'back',
          formats: ['QR_CODE', 'EAN_13', 'CODE_128', 'CODE_39'],
          windowed,
        })

        if (scanResult && scanResult.content) {
          return { text: scanResult.content.trim() }
        }
        return null
      } catch (err) {
        console.error('[scanner] 扫码失败:', err)
        // 扫码失败降级手输
        return manualInput(hint)
      }
    }

    // ===== Web 环境：手动输入降级 =====
    return manualInput(hint)
  }

  /**
   * 手动输入降级方案
   */
  async function manualInput(hint) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请手动输入订单号（移动端支持扫码）',
        '查找订单',
        {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          inputPlaceholder: '输入订单号，如 ORD202607090001',
          inputPattern: /^.{4,}$/,
          inputErrorMessage: '请输入有效的订单号',
          customClass: 'scanner-manual-dialog',
        }
      )
      return value ? { text: value.trim() } : null
    } catch {
      // 用户点击取消
      return null
    }
  }

  return { scan, manualInput }
}
