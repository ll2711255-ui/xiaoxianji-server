<template>
  <div class="pos-page">
    <h2 class="page-title">收银界面</h2>

    <el-tabs v-model="posTab" type="border-card">
      <!-- ==================== Tab 1: 收银开单 ==================== -->
      <el-tab-pane label="收银开单" name="order">
        <el-row :gutter="20">
          <!-- 左侧：号码牌选择（置顶）+ 确认收款 -->
          <el-col :span="10">
            <!-- 号码牌 -->
            <div class="card-section">
              <div class="card-section-header">
                <span class="card-section-title">🏷 选择号码牌</span>
                <el-tag type="danger" size="small" effect="dark" round>
                  空闲 {{ idleCards.length }} 个
                </el-tag>
              </div>
              <div class="card-chips" v-if="idleCards.length > 0">
                <div
                  v-for="card in idleCards" :key="card.number"
                  class="card-chip"
                  :class="{ selected: selectedCard === card.number }"
                  @click="onCardSelect(card.number)"
                >
                  <span class="card-chip-num">{{ card.number }}</span>
                </div>
              </div>
              <el-empty v-else description="暂无可用的空闲号码牌" :image-size="50" />
            </div>

            <!-- 提交按钮 -->
            <el-button
              type="primary" size="large" class="submit-btn"
              :disabled="!selectedCard || submitting"
              :loading="submitting"
              @click="onSubmitOrder"
            >
              {{ selectedCard ? `确认收款（绑定 ${selectedCard} 号牌）` : '👆 请先选择号码牌' }}
            </el-button>
          </el-col>

          <!-- 右侧：金额显示 + 付款方式 + 数字键盘 -->
          <el-col :span="14">
            <!-- 金额显示区 -->
            <div class="amount-display">
              <span class="currency">¥</span>
              <span class="amount">{{ amountDisplay }}</span>
            </div>

            <!-- 付款方式 -->
            <div class="pay-types">
              <div
                v-for="pt in payTypes" :key="pt.value"
                class="pay-type-btn"
                :class="{ active: paymentType === pt.value }"
                @click="paymentType = pt.value"
              >
                <span class="pay-type-icon">{{ pt.icon }}</span>
                <span class="pay-type-label">{{ pt.label }}</span>
              </div>
            </div>

            <!-- 数字键盘 -->
            <div class="keypad">
              <div class="keypad-row" v-for="row in keypadRows" :key="row.join('')">
                <div
                  v-for="key in row" :key="key"
                  class="keypad-key"
                  :class="{
                    'key-backspace': key === '⌫',
                    'key-clear': key === '清除',
                    'key-submit': key === '确认',
                    'key-calc': key === '计算',
                  }"
                  @click="onKeyTap(key)"
                >
                  <template v-if="key === '⌫'">⌫</template>
                  <template v-else>{{ key }}</template>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- ==================== Tab 2: 称重处理 ==================== -->
      <el-tab-pane label="称重处理" name="weigh">
        <!-- 步骤1：输入订单号 -->
        <div v-if="!weighOrder" class="weigh-search">
          <el-input
            v-model="weighOrderNo"
            placeholder="请输入待称重的订单号"
            size="large"
            clearable
            @keyup.enter="onLoadWeighOrder"
          >
            <template #append>
              <el-button type="primary" @click="onLoadWeighOrder" :loading="weighLoading">
                查询订单
              </el-button>
            </template>
          </el-input>
          <p class="weigh-hint">输入线上已接单的订单号进行称重处理</p>
        </div>

        <!-- 步骤2：称重表单 -->
        <div v-else>
          <el-button text type="primary" @click="weighOrder = null; weighOrderNo = ''" style="margin-bottom:16px">
            ← 返回查询
          </el-button>

          <el-row :gutter="20">
            <el-col :span="14">
              <!-- 商品信息 -->
              <el-card header="商品信息" shadow="hover" class="weigh-card">
                <div class="product-name">{{ weighProductName }}</div>
                <div class="spec-tags" v-if="weighSpecTags.length">
                  <el-tag v-for="t in weighSpecTags" :key="t.text" size="small" effect="plain">{{ t.text }}</el-tag>
                </div>
                <el-descriptions :column="2" border size="small" style="margin-top:12px">
                  <el-descriptions-item label="每斤单价">¥{{ weighPricePerJinDisplay }}</el-descriptions-item>
                  <el-descriptions-item label="处理附加费">¥{{ weighProcessingFeeDisplay }}</el-descriptions-item>
                  <el-descriptions-item label="预收金额">
                    <span style="color:#D4420A;font-weight:700">¥{{ weighPrepayDisplay }}</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="订单状态">
                    <el-tag size="small" type="warning">待称重</el-tag>
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 重量输入 -->
              <el-card header="实际称重" shadow="hover" class="weigh-card">
                <div class="weigh-input-row">
                  <el-input
                    v-model="weighWeightInput"
                    placeholder="请输入克数，如 1380"
                    size="large"
                    :class="{ 'is-warn': weighWarning }"
                    @input="onWeighWeightInput"
                    maxlength="5"
                  >
                    <template #append>克</template>
                  </el-input>
                </div>
                <div v-if="weighConstraint" class="constraint-label">{{ weighConstraint.label }}</div>
                <div v-else class="input-hint">输入实际称重克数，下方实时计算</div>
                <el-alert v-if="weighWarning" :title="weighWarning" type="error" :closable="false" show-icon style="margin-top:8px" />
              </el-card>

              <!-- 计算结果 -->
              <el-card header="计算结果" shadow="hover" class="weigh-card" v-if="weighGrams > 0">
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="实际重量">{{ weighGrams }}克（{{ weighActualJin }}斤）</el-descriptions-item>
                  <el-descriptions-item label="实际金额">
                    <span style="color:#D4420A;font-size:18px;font-weight:700">¥{{ weighActualAmountDisplay }}</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="退款金额">
                    <span v-if="weighRefundAmount > 0" style="color:#F56C6C;font-weight:700">¥{{ weighRefundAmountDisplay }}</span>
                    <span v-else style="color:#67C23A">无需退款</span>
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>

            <el-col :span="10">
              <!-- 称重照片 -->
              <el-card header="称重照片" shadow="hover" class="weigh-card">
                <div v-if="!weighPhoto" class="photo-empty" @click="onChoosePhoto">
                  <el-icon :size="40"><Camera /></el-icon>
                  <p>点击上传称重照片</p>
                </div>
                <div v-else class="photo-preview">
                  <img :src="weighPhoto" alt="称重照片" />
                  <div class="photo-actions">
                    <el-button size="small" @click="onChoosePhoto">重新选择</el-button>
                    <el-button size="small" type="danger" @click="weighPhoto = ''">删除</el-button>
                  </div>
                </div>
                <input ref="photoInput" type="file" accept="image/*" style="display:none" @change="onPhotoChange" />
              </el-card>

              <!-- 号码牌选择 -->
              <el-card header="号码牌绑定" shadow="hover" class="weigh-card">
                <div class="card-chips" v-if="allCards.length > 0">
                  <div
                    v-for="card in allCards" :key="card.number"
                    class="card-chip"
                    :class="{
                      selected: weighSelectedCard === card.number,
                      used: card.status !== 'idle' && card.number !== weighOrderCardNumber
                    }"
                    @click="onWeighCardSelect(card)"
                  >{{ card.number }}</div>
                </div>
                <el-empty v-else description="暂无号码牌" :image-size="40" />
                <p class="card-hint" v-if="weighSelectedCard">已选 {{ weighSelectedCard }} 号牌</p>
                <p class="card-hint optional" v-else>可选绑定号码牌（不选则沿用订单已有牌号）</p>
              </el-card>

              <!-- 提交 -->
              <el-button
                type="primary" size="large" style="width:100%"
                :disabled="weighGrams <= 0 || !!weighWarning || weighSubmitting"
                :loading="weighSubmitting"
                @click="onSubmitWeigh"
              >
                {{ weighWarning ? '重量不符合规则' : '确认提交称重' }}
              </el-button>
            </el-col>
          </el-row>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 收款成功弹窗 ==================== -->
    <el-dialog v-model="showResult" title="收款成功" width="420px" center :close-on-click-modal="false">
      <div class="result-body">
        <div class="result-icon">✓</div>
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="订单编号">{{ resultData.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="号码牌">
            <span class="result-card-num">{{ resultData.cardNumber }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="金额">
            <span class="result-price">¥{{ resultAmountDisplay }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="onPrintReceipt" type="warning">🖨 打印小票</el-button>
        <el-button @click="onNewOrder" type="primary">继续收银</el-button>
        <el-button @click="showResult = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 称重成功弹窗 ==================== -->
    <el-dialog v-model="showWeighResult" title="称重完成" width="460px" center :close-on-click-modal="false">
      <div class="result-body">
        <div class="result-icon">✓</div>
        <p style="text-align:center;font-size:15px;margin-bottom:16px">
          {{ weighResultRefund > 0 ? `已退款 ¥${formatMoney(weighResultRefund)}` : '称重完成，无需退款' }}
        </p>
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="订单号">{{ weighResultData.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="实际重量">{{ weighResultData.actualWeight }}克</el-descriptions-item>
          <el-descriptions-item label="实收金额">¥{{ formatMoney(weighResultData.actualAmount || 0) }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="onPrintWeighReceipt" type="warning">🖨 打印称重小票</el-button>
        <el-button @click="showWeighResult = false" type="primary">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 小票预览弹窗 ==================== -->
    <el-dialog v-model="showTicketPreview" :title="ticketTitle" width="380px" center>
      <div class="ticket-paper">
        <div class="ticket-center">
          <div class="ticket-shop">小鲜鸡</div>
          <div class="ticket-sub">鲜鸡现宰 · 新鲜直达</div>
          <div class="ticket-divider">──────────────────</div>
        </div>

        <div class="ticket-body">
          <div class="ticket-row">
            <span class="ticket-label">订单号：</span>
            <span>{{ ticketData.orderNo }}</span>
          </div>
          <div class="ticket-row" v-if="ticketData.typeLabel">
            <span class="ticket-label">类型：</span>
            <span>{{ ticketData.typeLabel }}</span>
          </div>
          <div class="ticket-row" v-if="ticketData.cardNumber">
            <span class="ticket-label">号码牌：</span>
            <span class="ticket-card-no">{{ ticketData.cardNumber }}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">支付方式：</span>
            <span>{{ ticketData.paymentLabel }}</span>
          </div>
          <div class="ticket-row" v-if="ticketData.productName">
            <span class="ticket-label">商品：</span>
            <span>{{ ticketData.productName }}{{ ticketData.specSummary ? '（' + ticketData.specSummary + '）' : '' }}</span>
          </div>
          <div class="ticket-row" v-if="ticketData.actualWeightJin">
            <span class="ticket-label">实际重量：</span>
            <span>{{ ticketData.actualWeightJin }}斤（{{ ticketData.actualWeightGrams }}克）</span>
          </div>
          <div class="ticket-row" v-if="ticketData.pricePerJinYuan">
            <span class="ticket-label">单价：</span>
            <span>¥{{ ticketData.pricePerJinYuan }}/斤</span>
          </div>

          <div class="ticket-divider">──────────────────</div>

          <div class="ticket-center ticket-amount-block">
            <div class="ticket-amount">¥{{ ticketData.isWeigh ? ticketData.actualAmountYuan : ticketData.amountYuan }}</div>
            <div class="ticket-amount-label">{{ ticketData.isWeigh ? '实收金额' : '' }}</div>
          </div>

          <div class="ticket-center" v-if="ticketData.hasRefund">
            <div class="ticket-refund">(退款 ¥{{ ticketData.refundAmountYuan }})</div>
          </div>

          <div class="ticket-divider">──────────────────</div>

          <div class="ticket-center">
            <div class="ticket-qr-placeholder">[ 扫码查看订单详情 ]</div>
          </div>

          <div class="ticket-divider">──────────────────</div>

          <div class="ticket-center">
            <div class="ticket-time">{{ ticketData.time }}</div>
            <div class="ticket-thanks">谢谢惠顾，欢迎再次光临</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTicketPreview = false">关闭预览</el-button>
        <el-button type="primary" @click="onMockPrintDone">✓ 模拟打印完成</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 计算器弹窗 ==================== -->
    <el-dialog v-model="showCalc" title="计算器" width="320px" center :close-on-click-modal="false">
      <div class="calc-display">{{ calcDisplay }}</div>
      <div class="calc-keypad">
        <div v-for="row in calcKeyRows" :key="row.join('')" class="calc-row">
          <div
            v-for="key in row" :key="key"
            class="calc-key"
            :class="{
              'calc-key-op': '+-×÷'.includes(key),
              'calc-key-eq': key === '=',
              'calc-key-clr': key === 'C',
            }"
            @click="onCalcKey(key)"
          >{{ key }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCalc = false">取消</el-button>
        <el-button type="primary" @click="onCalcConfirm">确认金额</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const router = useRouter()
const posTab = ref('order')

// ============= 通用工具 =============
function formatMoney(fen) { return (fen / 100).toFixed(2) }
function formatTime(d) {
  const dt = d || new Date()
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

// ============= 收银开单 =============
const amount = ref('')
const amountDisplay = computed(() => {
  const v = parseFloat(amount.value)
  return amount.value ? (isNaN(v) ? '0.00' : v.toFixed(2)) : '0.00'
})
const paymentType = ref('cash')
const payTypes = [
  { label: '现金/扫码', value: 'cash', icon: '💵' },
  { label: '微信支付', value: 'wechat', icon: '💚' },
  { label: '未支付', value: 'unpaid', icon: '📝' }
]
const selectedCard = ref('')
const cardNumbers = ref([])
const submitting = ref(false)
const showResult = ref(false)
const resultData = ref({})
const resultAmountDisplay = ref('0.00')

const idleCards = computed(() => cardNumbers.value.filter(c => c.status === 'idle'))

// 数字键盘布局
const keypadRows = [
  ['1', '2', '3', '⌫'],
  ['4', '5', '6', '清除'],
  ['7', '8', '9', '计算'],
  ['.', '0', '确认']
]

function onKeyTap(key) {
  if (key === '确认') {
    onSubmitOrder()
    return
  }
  if (key === '清除') {
    amount.value = ''
    return
  }
  if (key === '⌫') {
    amount.value = amount.value.slice(0, -1)
    return
  }
  if (key === '计算') {
    showCalc.value = true
    return
  }
  // 数字或小数点
  const parts = amount.value.split('.')
  if (key === '.') {
    if (amount.value.includes('.')) return
    amount.value += '.'
    return
  }
  if (parts.length === 2 && parts[1].length >= 2) return
  amount.value += key
}

function onCardSelect(number) {
  selectedCard.value = selectedCard.value === number ? '' : number
}

async function onSubmitOrder() {
  const amountFen = Math.round(parseFloat(amount.value) * 100)
  if (!amount.value || isNaN(amountFen) || amountFen <= 0) {
    ElMessage.warning('请输入金额')
    return
  }
  if (!selectedCard.value) {
    ElMessage.warning('请选择号码牌')
    return
  }

  try {
    await ElMessageBox.confirm(
      `金额：¥${amountDisplay.value}\n付款方式：${payTypes.find(p => p.value === paymentType.value)?.label}\n号码牌：${selectedCard.value}`,
      '确认收款', { type: 'info' }
    )
  } catch { return }

  submitting.value = true
  try {
    const result = await api.post('/merchant/offline-orders', {
      amount: amountFen,
      cardNumber: selectedCard.value,
      paymentType: paymentType.value
    })
    const d = (result && result.data) || result || {}
    if (!d.orderNo) {
      submitting.value = false
      ElMessage.error('创建订单超时，请重试')
      return
    }
    // 自动进入处理中
    await api.post('/merchant/orders/' + d.orderNo + '/process')

    resultData.value = {
      orderNo: d.orderNo,
      cardNumber: selectedCard.value,
      amountFen,
      paymentType: paymentType.value
    }
    resultAmountDisplay.value = amountDisplay.value
    submitting.value = false
    showResult.value = true
  } catch (err) {
    submitting.value = false
    ElMessage.error('创建订单失败')
  }
}

function onNewOrder() {
  amount.value = ''
  selectedCard.value = ''
  paymentType.value = 'cash'
  showResult.value = false
  resultData.value = {}
  resultAmountDisplay.value = '0.00'
  loadCardNumbers()
}

// ============= 打印机 / 小票 =============
const showTicketPreview = ref(false)
const ticketTitle = ref('小票预览')
const ticketData = ref({})

function onPrintReceipt() {
  const d = resultData.value
  if (!d.orderNo) return
  const amountYuan = ((d.amountFen || 0) / 100).toFixed(2)
  const payLabel = d.paymentType === 'wechat' ? '微信支付' : d.paymentType === 'unpaid' ? '未支付' : '现金/扫码'

  ticketTitle.value = '小票预览'
  ticketData.value = {
    orderNo: d.orderNo,
    cardNumber: d.cardNumber || '',
    paymentLabel: payLabel,
    amountYuan,
    isWeigh: false,
    time: formatTime()
  }
  showTicketPreview.value = true
}

// ============= 称重小票打印 =============
const showWeighResult = ref(false)
const weighResultData = ref({})
const weighResultRefund = ref(0)

function onPrintWeighReceipt() {
  const d = weighResultData.value
  if (!d.orderNo) return
  const actualWeightJin = d.actualWeight ? (d.actualWeight / 500).toFixed(2) : '0.00'
  const actualAmountYuan = ((d.actualAmount || 0) / 100).toFixed(2)
  const refundAmountYuan = ((weighResultRefund.value || 0) / 100).toFixed(2)
  const pricePerJinYuan = weighPricePerJin.value ? (weighPricePerJin.value / 100).toFixed(2) : '--'

  ticketTitle.value = '称重小票预览'
  ticketData.value = {
    orderNo: d.orderNo,
    cardNumber: weighSelectedCard.value || weighOrderCardNumber.value || '',
    paymentLabel: weighOrder.value?.type === 'delivery' ? '配送上门' : '到店自取',
    typeLabel: weighOrder.value?.type === 'delivery' ? '配送上门' : weighOrder.value?.type === 'pickup' ? '到店自取' : '',
    productName: weighProductName.value,
    specSummary: weighSpecTags.value.map(t => t.text).join('/'),
    actualWeightGrams: d.actualWeight || 0,
    actualWeightJin,
    pricePerJinYuan,
    actualAmountYuan,
    refundAmountYuan,
    hasRefund: weighResultRefund.value > 0,
    isWeigh: true,
    time: formatTime()
  }
  showTicketPreview.value = true
}

function onMockPrintDone() {
  showTicketPreview.value = false
  ElMessage.success('小票已打印')
}

// ============= 计算器 =============
const showCalc = ref(false)
const calcDisplay = ref('0')
const calcPendingOp = ref(null)
const calcPendingVal = ref(0)
const calcFresh = ref(true)

const calcKeyRows = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['C', '0', '.', '+'],
  ['=', '⌫']
]

function onCalcKey(key) {
  let display = calcDisplay.value
  const fresh = calcFresh.value
  const ops = ['+', '-', '×', '÷']

  if (key === 'C') {
    calcDisplay.value = '0'
    calcPendingOp.value = null
    calcPendingVal.value = 0
    calcFresh.value = true
    return
  }
  if (key === '⌫') {
    if (!fresh) {
      display = display.slice(0, -1)
      calcDisplay.value = display || '0'
      calcFresh.value = !display || display === '' || display === '-'
    }
    return
  }
  if (ops.includes(key)) {
    const num = parseFloat(display)
    if (isNaN(num)) return
    if (calcPendingOp.value) {
      const result = calcEval(calcPendingVal.value, num, calcPendingOp.value)
      calcDisplay.value = String(result)
      calcPendingVal.value = result
    } else {
      calcPendingVal.value = num
    }
    calcPendingOp.value = key
    calcFresh.value = true
    return
  }
  if (key === '=') {
    if (!calcPendingOp.value) return
    const num = parseFloat(display)
    if (isNaN(num)) return
    const result = calcEval(calcPendingVal.value, num, calcPendingOp.value)
    calcDisplay.value = String(result)
    calcPendingOp.value = null
    calcFresh.value = true
    return
  }
  // 数字或小数点
  if (key === '.' && display.includes('.')) return
  if (fresh) {
    calcDisplay.value = key
    calcFresh.value = false
  } else {
    if (display.replace('.', '').length >= 9) return
    calcDisplay.value = display + key
  }
}

function calcEval(a, b, op) {
  switch (op) {
    case '+': return Math.round((a + b) * 100) / 100
    case '-': return Math.round((a - b) * 100) / 100
    case '×': return Math.round((a * b) * 100) / 100
    case '÷': return b === 0 ? 0 : Math.round((a / b) * 100) / 100
    default: return b
  }
}

function onCalcConfirm() {
  const display = parseFloat(calcDisplay.value)
  if (isNaN(display) || display <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  amount.value = String(display)
  showCalc.value = false
}

// ============= 称重处理 =============
const weighOrderNo = ref('')
const weighLoading = ref(false)
const weighOrder = ref(null)
const weighProductName = ref('')
const weighSpecTags = ref([])
const weighPricePerJin = ref(0)
const weighProcessingFee = ref(0)
const weighPrepayAmount = ref(0)
const weighWeightInput = ref('')
const weighGrams = ref(0)
const weighConstraint = ref(null)
const weighWarning = ref('')
const weighActualJin = ref('0.00')
const weighActualAmount = ref(0)
const weighRefundAmount = ref(0)
const weighPhoto = ref('')
const photoInput = ref(null)
const weighSelectedCard = ref('')
const weighOrderCardNumber = ref('')
const allCards = ref([])
const weighSubmitting = ref(false)

const weighPricePerJinDisplay = computed(() => formatMoney(weighPricePerJin.value))
const weighProcessingFeeDisplay = computed(() => formatMoney(weighProcessingFee.value))
const weighPrepayDisplay = computed(() => formatMoney(weighPrepayAmount.value))
const weighActualAmountDisplay = computed(() => formatMoney(weighActualAmount.value))
const weighRefundAmountDisplay = computed(() => formatMoney(weighRefundAmount.value))

async function onLoadWeighOrder() {
  if (!weighOrderNo.value.trim()) {
    ElMessage.warning('请输入订单号')
    return
  }
  weighLoading.value = true
  try {
    const res = await api.get('/orders/' + weighOrderNo.value.trim())
    const d = (res && res.data) || res || {}
    const order = d.order
    if (!order) { ElMessage.error('订单不存在'); weighLoading.value = false; return }

    // 校验状态
    if (order.status !== 'accepted') {
      ElMessage.error('该订单状态不可称重（需为已接单状态）')
      weighLoading.value = false
      return
    }

    const item = (order.items && order.items[0]) || {}
    const spec = item.spec || {}

    // 构建规格标签
    const specTags = []
    if (spec.type) specTags.push({ text: spec.type })
    if (spec.weight) specTags.push({ text: spec.weight })
    if (spec.processing) specTags.push({ text: spec.processing })

    const pricePerJin = spec.type_price_per_jin || item.unitPrice || 0
    const processingFee = spec.processing_fee || 0
    const payAmount = order.payAmount || 0

    // 构建重量约束
    const pricingType = item.pricingType || ''
    let weightConstraint = null
    if (pricingType === 'range_weight') {
      const weightMax = spec.weight_max
      if (weightMax && weightMax > 0) {
        const maxJin = (weightMax / 500).toFixed(2)
        weightConstraint = { type: 'max', value: weightMax, label: `最大不超过 ${weightMax}克（${maxJin}斤）` }
      }
    } else if (pricingType === 'exact_weight') {
      const targetGrams = spec.weightGrams
      if (targetGrams && targetGrams > 0) {
        const targetJin = (targetGrams / 500).toFixed(2)
        weightConstraint = { type: 'equal', value: targetGrams, label: `须等于 ${targetGrams}克（${targetJin}斤）` }
      }
    }

    weighOrder.value = order
    weighProductName.value = item.productName || ''
    weighSpecTags.value = specTags
    weighPricePerJin.value = pricePerJin
    weighProcessingFee.value = processingFee
    weighPrepayAmount.value = payAmount
    weighConstraint.value = weightConstraint
    weighWarning.value = ''
    weighWeightInput.value = ''
    weighGrams.value = 0
    weighActualJin.value = '0.00'
    weighActualAmount.value = 0
    weighRefundAmount.value = 0
    weighPhoto.value = ''
    weighSelectedCard.value = ''
    weighOrderCardNumber.value = order.cardNumber || ''

    weighLoading.value = false
    loadAllCards()
  } catch (err) {
    weighLoading.value = false
    ElMessage.error('加载订单失败')
  }
}

function onWeighWeightInput(value) {
  const filtered = String(value || '').replace(/[^0-9]/g, '')
  weighWeightInput.value = filtered
  const grams = parseInt(filtered) || 0
  weighGrams.value = grams

  if (grams > 0) {
    calculateWeigh(grams)
  } else {
    weighActualJin.value = '0.00'
    weighActualAmount.value = 0
    weighRefundAmount.value = 0
  }

  // 实时校验重量约束
  let warning = ''
  const constraint = weighConstraint.value
  if (constraint && grams > 0) {
    if (constraint.type === 'max' && grams > constraint.value) {
      const maxJin = (constraint.value / 500).toFixed(2)
      warning = `重量超出订单范围（最大${constraint.value}克/${maxJin}斤）`
    } else if (constraint.type === 'equal' && grams !== constraint.value) {
      const diff = Math.abs(grams - constraint.value)
      const targetJin = (constraint.value / 500).toFixed(2)
      warning = `重量须等于${constraint.value}克/${targetJin}斤（差${diff}克）`
    }
  }
  weighWarning.value = warning
}

function calculateWeigh(grams) {
  const { value: ppj } = weighPricePerJin
  const { value: pf } = weighProcessingFee
  const { value: prepay } = weighPrepayAmount

  weighActualJin.value = (grams / 500).toFixed(2)
  const actual = Math.floor((grams / 500) * ppj + pf)
  weighActualAmount.value = actual
  weighRefundAmount.value = Math.max(0, prepay - actual)
}

function onChoosePhoto() {
  photoInput.value?.click()
}

function onPhotoChange(e) {
  const file = e.target.files[0]
  if (!file) return
  // 先用本地预览 URL
  weighPhoto.value = URL.createObjectURL(file)
  // 暂存 file 对象用于上传
  weighPhotoFile.value = file
  e.target.value = ''
}

const weighPhotoFile = ref(null)

async function uploadWeighPhoto() {
  if (!weighPhotoFile.value) return weighPhoto.value
  try {
    const res = await api.upload('/upload/image', weighPhotoFile.value)
    return (res && res.data && res.data.url) || weighPhoto.value
  } catch (err) {
    console.error('照片上传失败:', err)
    return weighPhoto.value
  }
}

function onWeighCardSelect(card) {
  const existingCard = weighOrderCardNumber.value
  const isAllowed = card.status === 'idle' || card.number === existingCard
  if (!isAllowed) return
  weighSelectedCard.value = weighSelectedCard.value === card.number ? '' : card.number
}

async function onSubmitWeigh() {
  if (weighGrams.value <= 0) {
    ElMessage.warning('请输入实际重量')
    return
  }
  if (weighWarning.value) {
    ElMessage.warning(weighWarning.value)
    return
  }

  const actualWeightDisplay = weighGrams.value + '克（' + weighActualJin.value + '斤）'
  let content = `确认称重信息？\n实际重量：${actualWeightDisplay}\n实际金额：¥${weighActualAmountDisplay.value}`
  if (weighRefundAmount.value > 0) {
    content += `\n将退款：¥${weighRefundAmountDisplay.value} 给用户`
  } else {
    content += '\n无需退款'
  }
  if (weighSelectedCard.value) {
    content += `\n绑定号码牌：${weighSelectedCard.value}`
  }
  if (!weighPhoto.value) {
    content += '\n⚠ 未上传称重照片'
  }
  content += '\n确认后无法修改'

  try {
    await ElMessageBox.confirm(content, '确认称重', {
      confirmButtonText: '确认提交',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }

  weighSubmitting.value = true

  try {
    const photoUrl = await uploadWeighPhoto()

    const result = await api.post('/merchant/orders/' + weighOrder.value.orderNo + '/weigh', {
      actualWeight: weighGrams.value,
      weighPhoto: photoUrl,
      cardNumber: weighSelectedCard.value || weighOrderCardNumber.value || '',
      pricePerJin: weighPricePerJin.value,
      processingFee: weighProcessingFee.value
    })

    weighSubmitting.value = false

    const rd = (result && result.data) || result || {}
    if (result && result.success) {
      weighResultData.value = {
        orderNo: weighOrder.value.orderNo,
        actualWeight: weighGrams.value,
        actualAmount: weighActualAmount.value
      }
      weighResultRefund.value = rd.refundAmount || 0
      showWeighResult.value = true
    } else {
      ElMessage.error((result && result.message) || '提交失败')
    }
  } catch (err) {
    weighSubmitting.value = false
    ElMessage.error('提交失败，请重试')
  }
}

// ============= 数据加载 =============
async function loadCardNumbers() {
  try {
    const res = await api.get('/pai-numbers')
    cardNumbers.value = (res && res.data && res.data.numbers) || []
  } catch (err) {
    console.error('加载号码牌失败:', err)
  }
}

async function loadAllCards() {
  try {
    const res = await api.get('/pai-numbers')
    allCards.value = (res && res.data && res.data.numbers) || []
  } catch (err) {
    console.error('加载号码牌失败:', err)
  }
}

onMounted(() => {
  loadCardNumbers()
})
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #333; margin-bottom: 20px; }

/* ========== 金额显示（右侧上方） ========== */
.amount-display {
  background: linear-gradient(135deg, #A83108, #D4420A);
  padding: 20px 24px; border-radius: 12px; text-align: center; margin-bottom: 12px;
}
.currency { font-size: 24px; color: rgba(255,255,255,0.5); margin-right: 4px; }
.amount { font-size: 48px; font-weight: 700; color: #fff; letter-spacing: 2px; }

/* ========== 付款方式 ========== */
.pay-types { display: flex; gap: 8px; margin-bottom: 12px; }
.pay-type-btn {
  flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px; 
  background: #f5f6fa; color: #999; border: 2px solid #e0e0e0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: all 0.2s;
}
.pay-type-btn:hover { border-color: #D4420A; color: #D4420A; transform: translateY(-1px); }
.pay-type-btn.active { background: #FFF8F5; color: #D4420A; border-color: #D4420A; font-weight: 600; box-shadow: 0 2px 8px rgba(212,66,10,0.15); }
.pay-type-icon { font-size: 20px; line-height: 1; }
.pay-type-label { font-size: 12px; }

/* ========== 号码牌区域（左侧置顶） ========== */
.card-section {
  background: #fff; border: 1px solid #ebeef5; border-radius: 12px; padding: 20px;
  margin-bottom: 16px; min-height: 320px;
}
.card-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f5f6fa;
}
.card-section-title { font-size: 16px; font-weight: 700; color: #333; }
/* ========== 号码牌 ========== */
.card-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.card-chip {
  padding: 14px 20px; border-radius: 10px; background: #fff; border: 2px solid #e0e0e0;
  font-size: 16px; font-weight: 600; text-align: center; min-width: 56px; color: #333; cursor: pointer; transition: all 0.2s;
}
.card-chip:hover { border-color: #D4420A; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(212,66,10,0.12); }
.card-chip.selected { background: #D4420A; color: #fff; border-color: #D4420A; box-shadow: 0 4px 12px rgba(212,66,10,0.3); }
.card-chip.used { opacity: 0.35; cursor: not-allowed; }

/* ========== 提交按钮 ========== */
.submit-btn {
  width: 100%; height: 52px; font-size: 17px; font-weight: 700; border-radius: 10px;
  background: linear-gradient(135deg, #D4420A, #E55A2B) !important;
  border: none !important; letter-spacing: 1px;
}

/* ========== 数字键盘 ========== */
.keypad {
  background: #e8e8e8; border-radius: 12px; padding: 8px; }
.keypad-row { display: flex; gap: 6px; margin-bottom: 6px; }
.keypad-row:last-child { margin-bottom: 0; }
.keypad-key {
  flex: 1; background: #fff; border-radius: 8px; text-align: center; padding: 20px 0;
  font-size: 24px; font-weight: 500; color: #333; cursor: pointer; user-select: none;
  transition: all 0.15s; min-height: 56px; display: flex; align-items: center; justify-content: center;
}
.keypad-key:active { background: #d0d0d0; transform: scale(0.96); }
.key-backspace { background: #d8d8d8; font-size: 20px; }
.key-clear { background: #E6A23C; color: #fff; font-size: 20px; font-weight: 600; }
.key-clear:active { background: #cf9236; }
.key-submit {
  flex: 2; background: linear-gradient(135deg, #D4420A, #E55A2B); color: #fff;
  font-size: 20px; font-weight: 700;
}
.key-submit:active { background: #A83108; }
.key-calc { background: #409EFF; color: #fff; font-size: 16px; font-weight: 600; }
.key-calc:active { background: #3a8ee6; }

/* ========== 结果弹窗 ========== */
.result-body { text-align: center; }
.result-icon {
  font-size: 64px; color: #D4420A; display: inline-block; margin-bottom: 16px;
  width: 80px; height: 80px; line-height: 80px; border-radius: 50%;
  background: #FFF8F5; border: 3px solid #D4420A;
}
.result-card-num { font-size: 26px; font-weight: 800; color: #D4420A; }
.result-price { font-size: 22px; font-weight: 700; color: #E55A2B; }

/* ========== 称重 ========== */
.weigh-search { max-width: 500px; margin: 40px auto; }
.weigh-hint { text-align: center; color: #bbb; font-size: 13px; margin-top: 12px; }
.weigh-card { margin-bottom: 16px; }
.product-name { font-size: 18px; font-weight: 600; color: #333; }
.spec-tags { display: flex; gap: 6px; margin-top: 8px; }
.weigh-input-row { margin-bottom: 4px; }
.input-hint { font-size: 12px; color: #c0c4cc; margin-top: 4px; }
.constraint-label { font-size: 12px; color: #E6A23C; margin-top: 4px; }
.card-hint { font-size: 12px; color: #D4420A; margin-top: 8px; }
.card-hint.optional { color: #c0c4cc; }

.is-warn :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 2px #F56C6C inset !important;
}

/* 称重照片 */
.photo-empty {
  border: 2px dashed #dcdfe6; border-radius: 8px; padding: 32px; text-align: center;
  cursor: pointer; color: #c0c4cc; transition: all 0.2s;
}
.photo-empty:hover { border-color: #D4420A; color: #D4420A; }
.photo-preview img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; }
.photo-actions { display: flex; gap: 8px; margin-top: 8px; }

/* ========== 小票预览 ========== */
.ticket-paper {
  background: #fff; padding: 20px 12px; font-family: 'Courier New', monospace;
  font-size: 13px; line-height: 1.8; border: 1px solid #eee; border-radius: 4px;
}
.ticket-center { text-align: center; }
.ticket-shop { font-size: 18px; font-weight: 700; }
.ticket-sub { font-size: 11px; color: #999; margin: 4px 0 8px; }
.ticket-divider { color: #ddd;  letter-spacing: 2px; margin: 8px 0; text-align: center; }
.ticket-body { text-align: left; }
.ticket-row { display: flex; padding: 1px 0; }
.ticket-label { color: #666; white-space: nowrap; }
.ticket-card-no { color: #D4420A; font-weight: 700; font-size: 15px; }
.ticket-amount-block { margin: 10px 0; }
.ticket-amount { font-size: 28px; font-weight: 700; color: #D4420A; }
.ticket-amount-label { font-size: 12px; color: #999; }
.ticket-refund { color: #F56C6C; font-size: 12px; }
.ticket-qr-placeholder {
  display: inline-block; padding: 40px 30px; border: 2px dashed #eee; border-radius: 4px;
  color: #ccc; font-size: 12px; margin: 6px 0;
}
.ticket-time { font-size: 11px; color: #999; }
.ticket-thanks { font-size: 12px; color: #666; margin-top: 4px; }

/* ========== 计算器 ========== */
.calc-display {
  background: #f5f6fa; border-radius: 8px; padding: 16px; text-align: right;
  font-size: 28px; font-weight: 700; color: #333; margin-bottom: 12px; min-height: 40px;
}
.calc-keypad { }
.calc-row { display: flex; gap: 6px; margin-bottom: 6px; }
.calc-key {
  flex: 1; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; text-align: center;
  padding: 12px 0; font-size: 18px; cursor: pointer; user-select: none; transition: all 0.15s;
}
.calc-key:active { background: #e0e0e0; }
.calc-key-op { background: #f0f0f0; font-weight: 600; color: #D4420A; }
.calc-key-eq { background: #D4420A; color: #fff; font-weight: 700; }
.calc-key-eq:active { background: #A83108; }
.calc-key-clr { background: #909399; color: #fff; }
.calc-key-clr:active { background: #73767a; }
</style>
