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
        additionalData: `@import "@/styles/tokens.scss";`
      }
    }
  }
})
