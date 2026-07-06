<template>
  <div>
    <el-page-header @back="$router.back()" content="订单详情" style="margin-bottom:16px" />
    <el-descriptions v-if="order" :column="2" border size="large" title="基本信息">
      <el-descriptions-item label="订单号">{{ order.order_no }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusType(order.status)">{{ statusMap[order.status] }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="类型">{{ typeMap[order.type] }}</el-descriptions-item>
      <el-descriptions-item label="支付方式">{{ order.payment_type === 'cash' ? '现金' : '微信支付' }}</el-descriptions-item>
      <el-descriptions-item label="交易单号">{{ order.transaction_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="下单时间">{{ dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss') }}</el-descriptions-item>
      <el-descriptions-item label="金额">¥{{ ((order.actual_amount || order.prepay_amount) / 100).toFixed(2) }}</el-descriptions-item>
      <el-descriptions-item label="退款金额">¥{{ ((order.refund_amount || 0) / 100).toFixed(2) }}</el-descriptions-item>
      <el-descriptions-item label="物流单号">{{ order.tracking_no || '-' }}</el-descriptions-item>
      <el-descriptions-item label="号码牌">{{ order.card_number || '-' }}</el-descriptions-item>
    </el-descriptions>

    <!-- 操作按钮 -->
    <div style="margin:16px 0">
      <el-button v-if="order.status==='paid'" type="success" @click="doAction('accept')">接单</el-button>
      <el-button v-if="order.status==='accepted'" type="warning" @click="handleWeigh">称重</el-button>
      <el-button v-if="order.status==='weighed'" type="primary" @click="doAction('process')">开始处理</el-button>
      <el-button v-if="order.status==='processing'" type="primary" @click="doAction('ready')">备货完成</el-button>
      <el-button v-if="order.status==='ready'" type="primary" @click="handleShip">发货</el-button>
      <el-button v-if="order.status==='delivering'" type="success" @click="doAction('complete')">确认完成</el-button>
      <el-button v-if="['paid','accepted','weighed'].includes(order.status)" type="danger" @click="handleRefund">退款</el-button>
    </div>

    <!-- 称重弹窗 -->
    <el-dialog v-model="weighVisible" title="称重录入" width="400px">
      <el-form>
        <el-form-item label="实际重量(克)">
          <el-input-number v-model="weighForm.weight" :min="0" :step="50" style="width:100%" />
        </el-form-item>
        <el-form-item label="号码牌">
          <el-input v-model="weighForm.cardNumber" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="weighVisible=false">取消</el-button>
        <el-button type="primary" @click="submitWeigh">确认称重</el-button>
      </template>
    </el-dialog>

    <!-- 发货弹窗 -->
    <el-dialog v-model="shipVisible" title="录入物流" width="400px">
      <el-form>
        <el-form-item label="物流单号">
          <el-input v-model="shipTrackingNo" placeholder="请输入快递单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible=false">取消</el-button>
        <el-button type="primary" @click="submitShip">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 商品清单 -->
    <el-card header="商品清单" style="margin-top:16px">
      <el-table :data="items" stripe>
        <el-table-column prop="productName" label="商品" />
        <el-table-column prop="pricingType" label="计价" width="100">
          <template #default="{ row }">{{ pricingMap[row.pricingType] || row.pricingType }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">¥{{ (row.unitPrice / 100).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { orderApi } from '../../../shared/api';

const route = useRoute();
const router = useRouter();
const order = ref<any>(null);
const weighVisible = ref(false);
const weighForm = ref({ weight: 500, cardNumber: '' });
const shipVisible = ref(false);
const shipTrackingNo = ref('');

const statusMap: Record<string, string> = {
  pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重',
  processing: '处理中', ready: '待发货', delivering: '配送中', completed: '已完成', cancelled: '已取消',
};
const typeMap: Record<string, string> = { delivery: '配送', pickup: '自提', offline: '线下' };
const pricingMap: Record<string, string> = { exact_weight: '称重', range_weight: '整鸡', per_piece: '按只' };

function statusType(s: string) {
  const m: Record<string, string> = { pending: 'warning', paid: 'info', completed: 'success', cancelled: 'danger', delivering: 'primary' };
  return m[s] || '';
}

const items = computed(() => {
  if (!order.value?.items) return [];
  return typeof order.value.items === 'string' ? JSON.parse(order.value.items) : order.value.items;
});

async function load() {
  const orderNo = route.params.orderNo as string;
  try {
    const res: any = await orderApi.detail(orderNo);
    order.value = res.data || res;
  } catch (err: any) {
    ElMessage.error('加载订单失败');
  }
}

async function doAction(action: string) {
  try {
    await ElMessageBox.confirm('确认执行此操作？', '提示');
    await orderApi.updateStatus(order.value.order_no, action);
    ElMessage.success('操作成功');
    load();
  } catch { /* 取消 */ }
}

function handleWeigh() { weighVisible.value = true; }
function handleShip() { shipVisible.value = true; }

async function submitWeigh() {
  try {
    await orderApi.weigh(order.value.order_no, {
      actualWeight: weighForm.value.weight,
      cardNumber: weighForm.value.cardNumber,
    });
    ElMessage.success('称重完成');
    weighVisible.value = false;
    load();
  } catch (err: any) {
    ElMessage.error(err.message || '称重失败');
  }
}

async function submitShip() {
  try {
    await orderApi.ship(order.value.order_no, shipTrackingNo.value);
    ElMessage.success('发货成功');
    shipVisible.value = false;
    load();
  } catch (err: any) {
    ElMessage.error(err.message || '发货失败');
  }
}

async function handleRefund() {
  try {
    const { value } = await ElMessageBox.prompt('退款金额（分）', '退款', { inputValue: String(order.value.prepay_amount) });
    if (!value) return;
    await orderApi.refund(order.value.order_no, { amount: parseInt(value) });
    ElMessage.success('退款申请已提交');
    load();
  } catch { /* 取消 */ }
}

onMounted(load);
</script>
