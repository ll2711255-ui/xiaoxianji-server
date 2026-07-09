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
 * 同步检测是否为移动端（基于 userAgent）
 * 用于布局切换等需要在渲染前知道平台的场景
 * 注意：在 Tauri 移动端中 userAgent 包含 Android/iPhone
 */
export function detectMobile() {
  if (!isTauri) {
    // Web 浏览器：通过 userAgent + 屏幕宽度判断
    const ua = navigator.userAgent || ''
    const hasMobileUA = /Android|iPhone|iPad|iPod|webOS/i.test(ua)
    const hasSmallScreen = window.innerWidth < 768
    return hasMobileUA || hasSmallScreen
  }
  // Tauri 环境：先看 userAgent
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true
  // 再看屏幕尺寸
  return window.innerWidth < 768 || window.innerHeight < 768
}

/**
 * 异步获取详细平台信息（仅在 Tauri 环境中调用 runtime API）
 * @returns {Promise<{platform: string, isWeb: boolean, isDesktop: boolean, isMobile: boolean}>}
 */
export async function getPlatform() {
  // Web 环境直接返回
  if (!isTauri) {
    return { platform: 'web', isWeb: true, isDesktop: false, isMobile: detectMobile() }
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
