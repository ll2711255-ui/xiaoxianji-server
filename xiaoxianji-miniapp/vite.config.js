import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 全局注入 SCSS 变量（所有页面和组件均可使用）
        // 使用 @use ... as * 替代已废弃的 @import
        additionalData: `@use "@/styles/tokens.scss" as *;\n`,
        // 静默 Sass 依赖传递的废弃警告（非本代码产生）
        silenceDeprecations: ['legacy-js-api']
      }
    }
  }
})
