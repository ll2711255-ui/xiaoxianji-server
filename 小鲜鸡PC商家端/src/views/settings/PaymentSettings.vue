<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">支付设置</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建支付方式
      </el-button>
    </div>

    <!-- 已有支付方式列表 -->
    <el-card v-if="methods.length > 0" style="margin-bottom:20px">
      <el-table :data="methods" stripe>
        <el-table-column prop="name" label="支付名称" min-width="140" />
        <el-table-column label="支付方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.channel === 'wechat' ? 'success' : 'primary'" size="small">
              {{ row.channel === 'wechat' ? '微信' : '支付宝' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商户类型" width="110">
          <template #default="{ row }">
            {{ row.merchantType === 'normal' ? '普通商户' : '服务商' }}
          </template>
        </el-table-column>
        <el-table-column prop="mchid" label="商户号" min-width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row, $index }">
            <el-button text type="primary" size="small" @click="openEdit($index)">编辑</el-button>
            <el-button text type="danger" size="small" @click="removeMethod($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-empty v-else description="暂无支付方式，点击上方按钮新建" />

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑支付方式' : '新建支付方式'"
      width="620px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="160px" size="default">
        <el-form-item label="支付名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：微信支付(主商户)" maxlength="30" />
        </el-form-item>

        <el-form-item label="支付方式" prop="channel">
          <el-radio-group v-model="form.channel">
            <el-radio value="wechat">微信</el-radio>
            <el-radio value="alipay">支付宝</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="支付类型" prop="merchantType">
          <el-radio-group v-model="form.merchantType">
            <el-radio value="normal">普通商户</el-radio>
            <el-radio value="service">服务商</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 微信专属字段 -->
        <template v-if="form.channel === 'wechat'">
          <el-form-item label="微信 AppID" prop="appId">
            <el-input v-model="form.appId" placeholder="小程序 AppID（如 wx1234567890abcdef）" />
          </el-form-item>

          <el-form-item label="微信 AppSecret">
            <div class="secret-field">
              <el-input
                v-model="form.appSecret"
                :type="showAppSecret ? 'text' : 'password'"
                placeholder="小程序 AppSecret（用于静默登录）"
              />
              <el-button
                text
                :type="showAppSecret ? 'warning' : 'primary'"
                size="small"
                @click="showAppSecret = !showAppSecret"
              >
                {{ showAppSecret ? '隐藏内容' : '点击查看或编辑' }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="微信支付商户号" prop="mchid">
            <el-input v-model="form.mchid" placeholder="商户号（10位数字）" />
          </el-form-item>

          <el-form-item label="证书序列号" prop="serialNo">
            <el-input v-model="form.serialNo" placeholder="APIv3 证书序列号（如 1234567890ABCDEF）" />
          </el-form-item>

          <el-form-item label="API 密钥">
            <div class="secret-field">
              <el-input
                v-model="form.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="APIv3 密钥（32位）"
              />
              <el-button
                text
                :type="showApiKey ? 'warning' : 'primary'"
                size="small"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? '隐藏内容' : '点击查看或编辑' }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="apiclient_cert.pem">
            <div class="secret-field">
              <el-input
                v-if="showCertPem"
                v-model="form.certPem"
                type="textarea"
                placeholder="证书内容 -----BEGIN CERTIFICATE-----"
                :rows="6"
              />
              <el-input
                v-else
                v-model="form.certPem"
                type="password"
                placeholder="证书内容（已隐藏，点击下方按钮查看/编辑）"
              />
              <el-button
                text
                :type="showCertPem ? 'warning' : 'primary'"
                size="small"
                @click="showCertPem = !showCertPem"
              >
                {{ showCertPem ? '隐藏内容' : '点击查看或编辑' }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="apiclient_key.pem">
            <div class="secret-field">
              <el-input
                v-if="showKeyPem"
                v-model="form.keyPem"
                type="textarea"
                placeholder="密钥内容 -----BEGIN PRIVATE KEY-----"
                :rows="6"
              />
              <el-input
                v-else
                v-model="form.keyPem"
                type="password"
                placeholder="密钥内容（已隐藏，点击下方按钮查看/编辑）"
              />
              <el-button
                text
                :type="showKeyPem ? 'warning' : 'primary'"
                size="small"
                @click="showKeyPem = !showKeyPem"
              >
                {{ showKeyPem ? '隐藏内容' : '点击查看或编辑' }}
              </el-button>
            </div>
          </el-form-item>
        </template>

        <!-- 支付宝专属字段（预留） -->
        <template v-if="form.channel === 'alipay'">
          <el-form-item label="支付宝 AppID">
            <el-input v-model="form.alipayAppId" placeholder="支付宝应用 AppID" />
          </el-form-item>
          <el-form-item label="支付宝私钥">
            <div class="secret-field">
              <el-input
                v-if="showAlipayKey"
                v-model="form.alipayPrivateKey"
                type="textarea"
                placeholder="应用私钥 -----BEGIN RSA PRIVATE KEY-----"
                :rows="6"
              />
              <el-input
                v-else
                v-model="form.alipayPrivateKey"
                type="password"
                placeholder="应用私钥（已隐藏，点击下方按钮查看/编辑）"
              />
              <el-button
                text
                :type="showAlipayKey ? 'warning' : 'primary'"
                size="small"
                @click="showAlipayKey = !showAlipayKey"
              >
                {{ showAlipayKey ? '隐藏内容' : '点击查看或编辑' }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="支付宝公钥">
            <el-input v-model="form.alipayPublicKey" placeholder="支付宝公钥" />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

// ========== 已有支付方式列表 ==========
const methods = ref([])

// ========== 弹窗状态 ==========
const dialogVisible = ref(false)
const isEdit = ref(false)
const editIndex = ref(-1)
const saving = ref(false)
const formRef = ref(null)

// 敏感字段显隐
const showApiKey = ref(false)
const showAppSecret = ref(false)
const showCertPem = ref(false)
const showKeyPem = ref(false)
const showAlipayKey = ref(false)

// ========== 表单默认值 ==========
function emptyForm() {
  return {
    name: '',
    channel: 'wechat',
    merchantType: 'normal',
    appId: '',
    appSecret: '',
    mchid: '',
    serialNo: '',
    apiKey: '',
    certPem: '',
    keyPem: '',
    alipayAppId: '',
    alipayPrivateKey: '',
    alipayPublicKey: '',
    enabled: true
  }
}

const form = reactive(emptyForm())

const rules = {
  name: [{ required: true, message: '请输入支付名称', trigger: 'blur' }],
  channel: [{ required: true, message: '请选择支付方式', trigger: 'change' }],
  merchantType: [{ required: true, message: '请选择支付类型', trigger: 'change' }]
}

// ========== 方法 ==========
function openCreate() {
  isEdit.value = false
  editIndex.value = -1
  Object.assign(form, emptyForm())
  resetSecretToggles()
  dialogVisible.value = true
}

function openEdit(index) {
  isEdit.value = true
  editIndex.value = index
  const item = methods.value[index]
  // 先从列表数据填充（不含密钥），再异步加载完整数据
  Object.assign(form, {
    ...item,
    appSecret: item.appSecret || '',
    certPem: '',
    keyPem: '',
    apiKey: '',
    alipayPrivateKey: '',
    alipayPublicKey: '',
    alipayAppId: item.alipayAppId || ''
  })
  resetSecretToggles()
  dialogVisible.value = true
  // 异步加载完整凭证（含密钥）
  if (item._id) {
    loadMethodFull(item._id)
  }
}

async function loadMethodFull(id) {
  try {
    const res = await api.get('/payment-methods/' + id + '/full')
    const full = (res && res.data && res.data.paymentMethod) || null
    if (full) {
      // 只回填密钥字段（保护用户正在编辑的普通字段）
      if (full.apiKey !== undefined) form.apiKey = full.apiKey || ''
      if (full.appSecret !== undefined) form.appSecret = full.appSecret || ''
      if (full.certPem !== undefined) form.certPem = full.certPem || ''
      if (full.keyPem !== undefined) form.keyPem = full.keyPem || ''
      if (full.serialNo !== undefined) form.serialNo = full.serialNo || ''
      if (full.alipayPrivateKey !== undefined) form.alipayPrivateKey = full.alipayPrivateKey || ''
      if (full.alipayPublicKey !== undefined) form.alipayPublicKey = full.alipayPublicKey || ''
    }
  } catch (err) {
    console.error('加载支付方式完整信息失败:', err)
  }
}

function resetSecretToggles() {
  showApiKey.value = false
  showAppSecret.value = false
  showCertPem.value = false
  showKeyPem.value = false
  showAlipayKey.value = false
}

async function removeMethod(index) {
  const item = methods.value[index]
  if (!item || !item._id) {
    methods.value.splice(index, 1)
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该支付方式吗？', '提示', { type: 'warning' })
  } catch { return }
  try {
    await api.del('/payment-methods/' + item._id)
    ElMessage.success('已删除')
    loadMethods()
  } catch (err) { ElMessage.error(err.response?.data?.message || err.message || '删除失败') }
}

async function loadMethods() {
  try {
    const res = await api.get('/payment-methods')
    methods.value = (res && res.data && res.data.paymentMethods) || []
  } catch { /* 加载失败保持旧数据 */ }
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const data = { ...form }

    if (isEdit.value) {
      await api.put('/payment-methods/' + data._id, data)
      ElMessage.success('支付方式已更新')
    } else {
      await api.post('/payment-methods', data)
      ElMessage.success('支付方式已创建')
    }

    dialogVisible.value = false
    loadMethods()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => { loadMethods() })
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  font-size: 22px; font-weight: 700; margin: 0; color: #303133;
}
.secret-field {
  width: 100%;
}
.secret-field .el-input {
  margin-bottom: 4px;
}
</style>
