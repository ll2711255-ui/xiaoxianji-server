<template>
  <div>
    <!-- 筛选栏 -->
    <el-card style="margin-bottom:16px">
      <el-row :gutter="16">
        <el-col :span="4">
          <el-select v-model="filters.status" placeholder="订单状态" clearable @change="load">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="filters.type" placeholder="订单类型" clearable @change="load">
            <el-option label="线上订单" value="online" />
            <el-option label="线下订单" value="offline" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" @change="load" style="width:100%" />
        </el-col>
        <el-col :span="4">
          <el-input v-model="filters.keyword" placeholder="搜索订单号" clearable @keyup.enter="load" />
        </el-col>
        <el-col :span="3">
          <el-button type="primary" @click="load">查询</el-button>
        </el-col>
        <el-col :span="3">
          <el-button @click="exportCSV">导出报表</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 订单表格 -->
    <el-card>
      <el-table :data="list" stripe v-loading="loading" @row-click="goDetail" style="cursor:pointer">
        <el-table-column prop="order_no" label="订单号" width="120" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }"><el-tag :type="row.type==='offline'?'info':'success'" size="small">{{ typeMap[row.type] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusMap[row.status] || row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="金额(元)" width="100">
          <template #default="{ row }">¥{{ ((row.actual_amount || row.prepay_amount) / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="card_number" label="号码牌" width="80" />
        <el-table-column prop="payment_type" label="支付方式" width="80">
          <template #default="{ row }">{{ row.payment_type === 'cash' ? '现金' : '微信' }}</template>
        </el-table-column>
        <el-table-column prop="contact_name" label="联系人" width="80" />
        <el-table-column prop="created_at" label="下单时间" width="170">
          <template #default="{ row }">{{ dayjs(row.created_at).format('MM-DD HH:mm') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click.stop="goDetail(row)">详情</el-button>
            <el-button v-if="row.status==='paid'" size="small" type="success" @click.stop="updateStatus(row,'accept')">接单</el-button>
            <el-button v-if="row.status==='accepted'" size="small" type="warning" @click.stop="updateStatus(row,'process')">处理</el-button>
            <el-button v-if="row.status==='ready'" size="small" type="primary" @click.stop="updateStatus(row,'deliver')">发货</el-button>
            <el-button v-if="row.status==='delivering'" size="small" type="success" @click.stop="updateStatus(row,'complete')">完成</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination style="margin-top:16px;justify-content:flex-end" v-model:current-page="page" :total="total" :page-size="pageSize" layout="total, prev, pager, next" @change="load" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { orderApi, dashboardApi } from '../../../shared/api';

const router = useRouter();
const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const dateRange = ref<[Date, Date] | null>(null);

const filters = reactive({ status: '', type: 'online', keyword: '' });

const statusOptions = [
  { label: '待支付', value: 'pending' }, { label: '已支付', value: 'paid' },
  { label: '进行中', value: 'active' }, { label: '已完成', value: 'completed' },
];
const statusMap: Record<string, string> = {
  pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重',
  processing: '处理中', ready: '待发货', delivering: '配送中', completed: '已完成', cancelled: '已取消',
};
const typeMap: Record<string, string> = { delivery: '配送', pickup: '自提', offline: '线下' };

function statusType(s: string) {
  const m: Record<string, string> = { pending: 'warning', paid: 'info', accepted: '', processing: '', ready: 'warning', delivering: 'primary', completed: 'success', cancelled: 'danger' };
  return m[s] || '';
}

function goDetail(row: any) {
  router.push(`/orders/${row.order_no}`);
}

async function updateStatus(row: any, action: string) {
  try {
    await ElMessageBox.confirm(`确定要「${action === 'accept' ? '接单' : action === 'process' ? '处理' : action === 'deliver' ? '发货' : '完成'}」此订单吗？`, '确认操作');
    await orderApi.updateStatus(row.order_no, action);
    ElMessage.success('操作成功');
    load();
  } catch { /* 取消 */ }
}

async function load() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.keyword) params.keyword = filters.keyword;
    if (dateRange.value) {
      params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DD');
      params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DD');
    }
    const res: any = await orderApi.list(params);
    list.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (err: any) {
    ElMessage.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function exportCSV() {
  try {
    const blob: any = await dashboardApi.export();
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    ElMessage.error('导出失败');
  }
}

onMounted(load);
</script>
