import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'

export const useCashierStore = defineStore('cashier', () => {
  // 当前输入
  const amount = ref('')
  const paymentType = ref('cash')
  const selectedCard = ref('')

  // 今日统计
  const todayStats = reactive({
    revenue: '0.00',
    orderCount: 0,
    onlineCount: 0
  })

  // 号码牌缓存
  const paiNumbers = ref([])

  // 今日订单
  const todayOrders = ref([])

  function resetForm() {
    amount.value = ''
    paymentType.value = 'cash'
    selectedCard.value = ''
  }

  return { amount, paymentType, selectedCard, todayStats, paiNumbers, todayOrders, resetForm }
})
