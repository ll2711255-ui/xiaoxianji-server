<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">号码牌管理</h2>
      <el-button @click="loadNumbers" :loading="loading">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <el-row :gutter="12">
      <el-col :span="8" v-for="n in numbers" :key="n._id" style="margin-bottom:12px">
        <div class="number-card" :class="'status-' + n.status">
          <div class="number-num">{{ n.number }}</div>
          <div class="number-status">{{ statusLabel(n.status) }}</div>
          <div class="number-order" v-if="n.orderNo">{{ n.orderNo }}</div>
          <el-button
            v-if="n.status === 'in_use'"
            size="small"
            type="danger"
            @click="onRelease(n)"
            style="margin-top:8px"
          >
            释放
          </el-button>
        </div>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && numbers.length === 0" description="暂无号码牌" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import api from '@/utils/api'

const numbers = ref([])
const loading = ref(false)

function statusLabel(s) {
  return { idle: '空闲', in_use: '使用中', used: '已使用' }[s] || s
}

async function loadNumbers() {
  loading.value = true
  try {
    const res = await api.get('/pai-numbers')
    numbers.value = (res && res.data && res.data.numbers) || []
  } catch (err) { console.error('加载号码牌失败:', err) }
  loading.value = false
}

async function onRelease(n) {
  try {
    await ElMessageBox.confirm(`确定释放 ${n.number} 号牌吗？`, '确认释放')
  } catch { return }

  try {
    const res = await api.post('/pai-numbers/' + n.number + '/release')
    if (res && res.success) { ElMessage.success('已释放 ' + n.number + ' 号'); loadNumbers() }
    else { ElMessage.error((res && res.message) || '释放失败') }
  } catch (err) { ElMessage.error('释放失败') }
}

onMounted(() => loadNumbers())
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: #333; }
.number-card {
  background: #fff; border-radius: 8px; padding: 16px; text-align: center;
  border: 2px solid #eee; transition: all 0.2s;
}
.number-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.number-card.status-idle { border-color: #67C23A; }
.number-card.status-in_use { border-color: #F5A623; }
.number-card.status-used { border-color: #ccc; opacity: 0.7; }
.number-num { font-size: 32px; font-weight: 700; color: #333; }
.number-status { font-size: 13px; color: #999; margin-top: 4px; }
.number-order { font-size: 12px; color: #D4420A; margin-top: 4px; word-break: break-all; }
</style>
