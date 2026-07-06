<template>
  <div class="cashier">
    <div class="left-panel">
      <!-- 金额显示 -->
      <div class="amount-display">
        <span class="amount">¥{{ amountDisplay }}</span>
      </div>

      <!-- 数字键盘 -->
      <NumericKeyboard @key="onKey" />

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button size="large" @click="clear" style="flex:1">清除</el-button>
        <el-button size="large" type="success" @click="submit" :loading="submitting" style="flex:2;height:56px;font-size:20px">确认收款</el-button>
      </div>
    </div>

    <div class="right-panel">
      <!-- 付款方式 -->
      <div class="section">
        <h3>付款方式</h3>
        <div class="pay-types">
          <el-button :type="payType==='cash'?'success':''" size="large" @click="payType='cash'" style="flex:1">💵 现金</el-button>
          <el-button :type="payType==='wechat'?'success':''" size="large" @click="payType='wechat'" style="flex:1">💳 微信</el-button>
        </div>
      </div>

      <!-- 号码牌 -->
      <div class="section">
        <h3>取餐号码牌</h3>
        <div class="card-grid">
          <div v-for="c in cards" :key="c.number" :class="['card-item',{selected:selectedCard===c.number,used:c.status!=='idle'}]" @click="selectCard(c)">
            {{ c.number }}
          </div>
        </div>
        <el-button size="small" @click="refreshCards" :loading="cardLoading">刷新</el-button>
      </div>

      <!-- 最近订单 -->
      <div class="section">
        <h3>最近订单</h3>
        <div v-for="o in recentOrders" :key="o.order_no" class="order-item">
          <span>{{ o.order_no }}</span>
          <span>{{ o.card_number }}</span>
          <span>¥{{ (o.prepay_amount/100).toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { orderApi } from '../../shared/api';
import { useSocketStore } from '../../shared/stores/websocket';
import NumericKeyboard from '../components/NumericKeyboard.vue';

const amount = ref('');
const payType = ref('cash');
const cards = ref<any[]>([]);
const selectedCard = ref('');
const submitting = ref(false);
const cardLoading = ref(false);
const recentOrders = ref<any[]>([]);
const socketStore = useSocketStore();

const amountDisplay = computed(() => {
  const amt = parseFloat(amount.value || '0');
  return isNaN(amt) ? '0.00' : amt.toFixed(2);
});

function onKey(key: string) {
  if (key === 'clear') { amount.value = ''; return; }
  if (key === 'backspace') { amount.value = amount.value.slice(0, -1); return; }
  if (key === '.') { if (amount.value.includes('.')) return; amount.value += '.'; return; }
  const parts = amount.value.split('.');
  if (parts.length === 2 && parts[1].length >= 2) return;
  amount.value += key;
}

function clear() { amount.value = ''; selectedCard.value = ''; }

function selectCard(c: any) {
  if (c.status !== 'idle') return;
  selectedCard.value = selectedCard.value === c.number ? '' : c.number;
}

async function refreshCards() {
  cardLoading.value = true;
  try {
    const api = (await import('../../shared/api')).default;
    const res: any = await api.get('/pai-numbers');
    cards.value = (res.data || []).filter((c: any) => c.status === 'idle');
  } catch { cards.value = []; }
  finally { cardLoading.value = false; }
}

async function submit() {
  const amtFen = Math.round(parseFloat(amount.value || '0') * 100);
  if (!amtFen || amtFen <= 0) { ElMessage.warning('请输入金额'); return; }
  if (!selectedCard.value) { ElMessage.warning('请选择号码牌'); return; }

  try {
    await ElMessageBox.confirm(`金额：¥${amountDisplay.value}\n付款方式：${payType.value==='cash'?'现金':'微信'}\n号码牌：${selectedCard.value}`, '确认收款', { confirmButtonText: '确认', cancelButtonText: '取消' });
  } catch { return; }

  submitting.value = true;
  try {
    const res: any = await orderApi.createOffline({
      amount: amtFen,
      cardNumber: selectedCard.value,
      paymentType: payType.value,
    });
    ElMessage.success(`收款成功 ${res.data?.orderNo || ''}`);
    clear();
    refreshCards();
    loadRecentOrders();
  } catch (err: any) { ElMessage.error(err.message || '收款失败'); }
  finally { submitting.value = false; }
}

async function loadRecentOrders() {
  try {
    const res: any = await orderApi.list({ type: 'offline', pageSize: 10 });
    recentOrders.value = res.data?.list || [];
  } catch {}
}

onMounted(() => {
  refreshCards();
  loadRecentOrders();
  socketStore.connect();
  socketStore.join('cashier');
});

onUnmounted(() => socketStore.disconnect());
</script>

<style scoped>
.cashier{display:flex;gap:16px}
.left-panel{flex:1;background:#fff;border-radius:12px;padding:20px}
.right-panel{width:320px;display:flex;flex-direction:column;gap:12px}
.amount-display{text-align:right;padding:16px 8px;background:#f9f9f9;border-radius:8px;margin-bottom:16px}
.amount{font-size:40px;font-weight:700;color:#333;font-family:'SF Mono',monospace}
.actions{display:flex;gap:8px;margin-top:12px}
.section{background:#fff;border-radius:12px;padding:16px}
.section h3{font-size:16px;margin-bottom:10px;color:#333}
.pay-types{display:flex;gap:8px}
.card-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.card-item{padding:8px 12px;border:2px solid #ddd;border-radius:8px;cursor:pointer;font-size:18px;font-weight:600;text-align:center;min-width:48px}
.card-item.selected{border-color:#1DB96A;background:#E8F8EF;color:#1DB96A}
.card-item.used{border-color:#eee;background:#f5f5f5;color:#ccc;cursor:not-allowed}
.order-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
</style>
