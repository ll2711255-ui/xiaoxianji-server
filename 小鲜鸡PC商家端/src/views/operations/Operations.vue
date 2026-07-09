<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">运营数据</h2>
      <el-space>
        <el-button @click="prevDay" :icon="ArrowLeft" circle size="small" />
        <el-date-picker v-model="date" type="date" placeholder="选择日期" @change="loadData" value-format="YYYY-MM-DD" />
        <el-button @click="nextDay" :icon="ArrowRight" circle size="small" :disabled="isToday" />
      </el-space>
    </div>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="overview-row">
      <el-col :span="6">
        <StatCard icon="Money" label="今日营收" :value="'¥' + overview.revenue" color="#D4420A" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="Document" label="总订单" :value="overview.orderCount" color="#F5A623" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="Goods" label="线上订单" :value="overview.onlineCount" color="#409EFF" />
      </el-col>
      <el-col :span="6">
        <StatCard icon="Sell" label="客单价" :value="'¥' + overview.avgValue" color="#67C23A" />
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" style="margin-top:20px">
      <el-col :span="14">
        <el-card header="商品销量排行">
          <div ref="rankChartRef" style="height:320px" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card header="品类销量占比">
          <div ref="pieChartRef" style="height:320px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近订单 -->
    <el-card header="当日完成订单" style="margin-top:20px">
      <el-table :data="recentOrders" stripe size="small">
        <el-table-column prop="orderNo" label="订单号" width="150" />
        <el-table-column label="类型" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'offline' ? 'warning' : 'info'">
              {{ row.type === 'offline' ? '线下' : row.typeLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><OrderStatusTag :status="row.status" :type="row.type" size="small" /></template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ formatMoney(row.actualAmount || row.payAmount || 0) }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="150">
          <template #default="{ row }">{{ row.createTime }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="recentOrders.length === 0" description="暂无数据" :image-size="60" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import api from '@/utils/api'
import StatCard from '@/components/StatCard.vue'
import OrderStatusTag from '@/components/OrderStatusTag.vue'

const rankChartRef = ref(null)
const pieChartRef = ref(null)
let rankChart, pieChart

const date = ref(new Date().toISOString().slice(0, 10))
const isToday = ref(true)
const overview = reactive({ revenue: '0.00', orderCount: 0, onlineCount: 0, offlineCount: 0, avgValue: '0.00' })
const salesRank = ref([])
const categoryStats = ref([])
const recentOrders = ref([])

function formatMoney(fen) { return (fen / 100).toFixed(2) }

function prevDay() {
  const d = new Date(date.value)
  d.setDate(d.getDate() - 1)
  date.value = d.toISOString().slice(0, 10)
  isToday.value = false
  loadData()
}

function nextDay() {
  const d = new Date(date.value)
  d.setDate(d.getDate() + 1)
  const today = new Date().toISOString().slice(0, 10)
  date.value = d.toISOString().slice(0, 10)
  isToday.value = date.value >= today
  loadData()
}

function getDateRange() {
  const start = date.value + 'T00:00:00.000Z'
  const endDate = new Date(date.value)
  endDate.setDate(endDate.getDate() + 1)
  const end = endDate.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  return { startDate: start, endDate: end }
}

async function loadData() {
  const { startDate, endDate } = getDateRange()
  try {
    const [onlineRes, offlineRes] = await Promise.all([
      api.get('/merchant/orders', { status: 'completed', type: 'online', pageSize: 200, startDate, endDate }),
      api.get('/merchant/orders', { status: 'completed', type: 'offline', pageSize: 200, startDate, endDate })
    ])

    const onlineOrders = (onlineRes && onlineRes.data && onlineRes.data.orders) || []
    const offlineOrders = (offlineRes && offlineRes.data && offlineRes.data.orders) || []
    const allOrders = [...onlineOrders, ...offlineOrders]

    const totalFen = allOrders.reduce((s, o) => s + (o.actualAmount || o.payAmount || 0), 0)
    overview.revenue = formatMoney(totalFen)
    overview.orderCount = allOrders.length
    overview.onlineCount = onlineOrders.length
    overview.offlineCount = offlineOrders.length
    overview.avgValue = allOrders.length > 0 ? formatMoney(Math.round(totalFen / allOrders.length)) : '0.00'

    // 销量排行
    const rankMap = {}
    onlineOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.productId || item.productName
        if (!rankMap[key]) rankMap[key] = { name: item.productName, count: 0, amount: 0 }
        rankMap[key].count += item.quantity || 1
        rankMap[key].amount += (item.unitPrice || 0) * (item.quantity || 1)
      })
    })
    salesRank.value = Object.values(rankMap).sort((a, b) => b.count - a.count).slice(0, 10)

    // 品类占比
    const catMap = {}
    onlineOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const cat = item.categoryName || '其他'
        catMap[cat] = (catMap[cat] || 0) + (item.quantity || 1)
      })
    })
    if (offlineOrders.length > 0) catMap['线下订单'] = offlineOrders.length
    const totalItems = Object.values(catMap).reduce((s, v) => s + v, 0) || 1
    categoryStats.value = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

    // 最近订单
    recentOrders.value = [...allOrders].sort((a, b) => new Date(b.createTime) - new Date(a.createTime)).slice(0, 10)
      .map(o => ({
        ...o,
        typeLabel: o.type === 'delivery' ? '配送' : o.type === 'pickup' ? '自取' : '线下'
      }))

    await nextTick()
    renderCharts()
  } catch (err) { console.error('加载运营数据失败:', err) }
}

function renderCharts() {
  // 排行柱状图
  if (rankChartRef.value) {
    if (!rankChart) rankChart = echarts.init(rankChartRef.value)
    rankChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 120, right: 40, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: salesRank.value.map(r => r.name).reverse(), inverse: true, axisLabel: { width: 100, overflow: 'truncate' } },
      series: [{
        type: 'bar', data: salesRank.value.map(r => r.count).reverse(),
        itemStyle: { color: '#D4420A', borderRadius: [0, 4, 4, 0] }
      }]
    })
  }

  // 品类饼图
  if (pieChartRef.value) {
    if (!pieChart) pieChart = echarts.init(pieChartRef.value)
    const colors = ['#D4420A', '#F5A623', '#FF6B35', '#E64A19', '#A83108', '#FFD166']
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['45%', '75%'], center: ['50%', '45%'],
        data: categoryStats.value.map(([name, count]) => ({ name, value: count })),
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        color: colors
      }]
    })
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: #333; }
.overview-row { margin-bottom: 0; }
</style>
