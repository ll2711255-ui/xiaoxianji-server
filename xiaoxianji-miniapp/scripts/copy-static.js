/**
 * uni-app build 后复制 static/ 到 dist 各平台输出目录
 * uni-app v3 不会自动复制仅被 pages.json 引用的静态文件（如 tabBar 图标）
 */
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const staticDir = path.resolve(rootDir, 'static')

if (!fs.existsSync(staticDir)) {
  console.log('[copy-static] static/ 目录不存在，跳过')
  process.exit(0)
}

// 遍历 dist/build/ 和 dist/dev/ 下的所有平台目录
function walkDirs(root, depth) {
  if (depth <= 0) return []
  if (!fs.existsSync(root)) return []
  const results = []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const full = path.join(root, e.name)
    // 如果此目录下有 app.json，说明是小程序输出目录
    if (fs.existsSync(path.join(full, 'app.json'))) {
      results.push(full)
    } else if (depth > 1) {
      results.push(...walkDirs(full, depth - 1))
    }
  }
  return results
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const e of entries) {
    const srcPath = path.join(src, e.name)
    const destPath = path.join(dest, e.name)
    if (e.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const targets = walkDirs(distDir, 3)
if (targets.length === 0) {
  console.log('[copy-static] 未找到小程序输出目录，跳过')
  process.exit(0)
}

for (const target of targets) {
  const dest = path.join(target, 'static')
  console.log(`[copy-static] ${staticDir} → ${dest}`)
  copyDir(staticDir, dest)
}

console.log(`[copy-static] 完成，已复制到 ${targets.length} 个输出目录`)
