<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in cards" :key="card.label">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="16">
        <el-card>
          <template #header>近7天订单趋势</template>
          <div ref="trendChart" style="height:300px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>订单状态分布（今日）</template>
          <div ref="statusChart" style="height:300px"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { dashboardApi } from '../../shared/api';

const cards = reactive([
  { label: '今日订单', value: '0', color: '#1DB96A' },
  { label: '今日营业额', value: '¥0.00', color: '#F5A623' },
  { label: '待处理', value: '0', color: '#E74C3C' },
  { label: '总订单', value: '0', color: '#3A7BFF' },
]);

const trendChart = ref<HTMLDivElement>();
const statusChart = ref<HTMLDivElement>();
let trendInstance: echarts.ECharts | null = null;
let statusInstance: echarts.ECharts | null = null;

function fmtAmount(fen: number) {
  return '¥' + (fen / 100).toFixed(2);
}

async function load() {
  try {
    const [overview, trends] = await Promise.all([
      dashboardApi.overview(),
      dashboardApi.trends(7),
    ]);
    const o = (overview as any).data || overview;
    cards[0].value = String(o.todayOrderCount || 0);
    cards[1].value = fmtAmount(o.todayAmount || 0);
    cards[2].value = String((o.statusDistribution || []).filter((s: any) => ['paid', 'accepted'].includes(s.status)).reduce((a: number, s: any) => a + s.cnt, 0));
    cards[3].value = String(o.totalOrderCount || 0);

    // 趋势图
    const t = (trends as any).data || trends || [];
    if (trendInstance && t.length > 0) {
      trendInstance.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: t.map((r: any) => r.date) },
        yAxis: { type: 'value', name: '单量' },
        series: [
          { name: '订单数', type: 'line', data: t.map((r: any) => r.order_count), smooth: true, itemStyle: { color: '#1DB96A' } },
          { name: '金额(元)', type: 'line', data: t.map((r: any) => +(r.amount / 100).toFixed(0)), smooth: true, itemStyle: { color: '#F5A623' }, yAxisIndex: 1 },
        ],
      });
    }

    // 状态分布
    const statusData = o.statusDistribution || [];
    if (statusInstance && statusData.length > 0) {
      statusInstance.setOption({
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie', radius: ['40%', '70%'],
          data: statusData.map((s: any) => ({ name: s.status, value: s.cnt })),
          label: { show: false },
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
        }],
      });
    }
  } catch (err) {
    console.error('加载看板失败:', err);
  }
}

onMounted(() => {
  trendInstance = echarts.init(trendChart.value!);
  statusInstance = echarts.init(statusChart.value!);

  // 插入默认值
  trendInstance.setOption({ xAxis: { data: [] }, yAxis: {}, series: [] });
  statusInstance.setOption({ series: [{ type: 'pie', data: [] }] });

  load();
});

onUnmounted(() => {
  trendInstance?.dispose();
  statusInstance?.dispose();
});
</script>

<style scoped>
.stat-card { text-align: center; }
.stat-label { font-size: 14px; color: #999; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 700; }
</style>
