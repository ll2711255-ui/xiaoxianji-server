<template>
  <div class="mobile-scan">
    <h3 class="page-title">扫码接单</h3>

    <!-- 扫描区 -->
    <div class="scan-area" @click="onScanClick">
      <el-icon :size="64"><Camera /></el-icon>
      <p>点击扫描订单条形码</p>
      <p class="scan-hint">支持 CODE-128、EAN-13、QR 码</p>
    </div>

    <!-- 手输降级 -->
    <div class="manual-area">
      <el-divider content-position="center">或手动输入</el-divider>
      <el-input
        v-model="orderNo"
        placeholder="输入订单号"
        size="large"
        clearable
        @keyup.enter="onManualSearch"
      >
        <template #append>
          <el-button @click="onManualSearch">查找</el-button>
        </template>
      </el-input>
    </div>

    <!-- 扫描结果 -->
    <div v-if="scanResult" class="scan-result">
      <el-tag type="success" size="large" effect="dark">扫描成功</el-tag>
      <p class="scan-result-text">{{ scanResult }}</p>
      <el-button type="primary" size="large" @click="onGoToOrder" style="width:100%;margin-top:12px">
        查看订单详情
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useScanner } from '@/composables/useScanner'

const router = useRouter()
const { scan } = useScanner()

const orderNo = ref('')
const scanResult = ref('')

async function onScanClick() {
  const result = await scan({ hint: '扫描订单条形码或二维码' })
  if (result && result.text) {
    scanResult.value = result.text
    // 自动跳转
    setTimeout(() => router.push('/mobile/orders/' + result.text), 600)
  }
}

function onManualSearch() {
  const no = orderNo.value.trim()
  if (!no) return ElMessage.warning('请输入订单号')
  router.push('/mobile/orders/' + no)
}

function onGoToOrder() {
  if (scanResult.value) {
    router.push('/mobile/orders/' + scanResult.value)
  }
}
</script>

<style scoped>
.mobile-scan { padding-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; color: #222; margin: 0 0 16px; text-align: center; }

.scan-area {
  background: #fff; border: 2px dashed #D4420A; border-radius: 16px;
  padding: 48px 24px; text-align: center; cursor: pointer;
  -webkit-tap-highlight-color: transparent; color: #D4420A;
  transition: background 0.15s;
}
.scan-area:active { background: #FFF5F0; }
.scan-area p { margin: 8px 0 0; font-size: 16px; }
.scan-hint { font-size: 13px !important; color: #999 !important; }

.manual-area { margin-top: 32px; }

.scan-result {
  margin-top: 24px; background: #f0f9eb; border-radius: 12px;
  padding: 24px; text-align: center;
}
.scan-result-text { font-size: 18px; font-weight: 700; color: #333; margin: 12px 0 0; word-break: break-all; }
</style>
