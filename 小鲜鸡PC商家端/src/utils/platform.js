/**
 * 运行环境检测
 * 用于判断当前是在 Web 浏览器、Tauri 桌面端还是 Tauri 移动端
 *
 * 使用方式：
 *   import { isTauri, isWeb, getPlatform } from '@/utils/platform'
 *   if (isTauri) { ... }
 *   const { isDesktop, isMobile } = await getPlatform()
 */

// Tauri 2 运行时注入 window.__TAURI__ 全局对象
export const isTauri = typeof window !== 'undefined' &&
  !!(window.__TAURI__ || window.__TAURI_INTERNALS__)

// Web 浏览器环境（不是 Tauri 壳）
export const isWeb = !isTauri

/**
 * 异步获取详细平台信息（仅在 Tauri 环境中调用 runtime API）
 * @returns {Promise<{platform: string, isWeb: boolean, isDesktop: boolean, isMobile: boolean}>}
 */
export async function getPlatform() {
  // Web 环境直接返回
  if (!isTauri) {
    return { platform: 'web', isWeb: true, isDesktop: false, isMobile: false }
  }

  // Tauri 环境：动态导入 plugin-os（Web 打包时不会被包含）
  try {
    const { platform } = await import('@tauri-apps/plugin-os')
    const p = platform()
    return {
      platform: p,
      isWeb: false,
      isDesktop: p === 'windows' || p === 'macos' || p === 'linux',
      isMobile: p === 'android' || p === 'ios'
    }
  } catch {
    // plugin-os 未注册时降级为 desktop
    return { platform: 'unknown', isWeb: false, isDesktop: true, isMobile: false }
  }
}
