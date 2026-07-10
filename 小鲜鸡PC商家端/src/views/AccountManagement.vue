<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">账号管理</h2>
      <el-button type="primary" @click="openCreate" v-if="authStore.canManageAccounts">
        <el-icon><Plus /></el-icon> 新增账号
      </el-button>
    </div>

    <!-- 统计卡片（仅 admin） -->
    <el-row :gutter="16" v-if="authStore.isAdmin" class="stat-row">
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num">{{ stats.managerCount }}</div>
          <div class="stat-label">店长</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num">{{ stats.staffCount }}</div>
          <div class="stat-label">员工</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num disabled">{{ stats.disabledCount }}</div>
          <div class="stat-label">已禁用</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Tab：账号列表 + 操作日志 -->
    <el-card>
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="账号列表" name="accounts">
          <!-- 工具栏 -->
          <div class="toolbar">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索用户名或姓名"
              clearable
              style="width: 220px"
              @input="filterAccounts"
            />
            <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 120px" @change="filterAccounts">
              <el-option label="店长" value="manager" />
              <el-option label="员工" value="staff" />
            </el-select>
          </div>

          <el-table :data="filteredAccounts" stripe v-loading="loading">
            <el-table-column label="显示名" min-width="120">
              <template #default="{ row }">
                <div class="user-cell">
                  <el-avatar :size="32" class="user-avatar">
                    {{ (row.displayName || row.username || '?')[0] }}
                  </el-avatar>
                  <span>{{ row.displayName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="username" label="用户名" min-width="110" />
            <el-table-column label="角色" width="80">
              <template #default="{ row }">
                <el-tag :type="roleTag(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
                  {{ row.isActive ? '正常' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column v-if="authStore.isAdmin" label="创建者" width="100">
              <template #default="{ row }">
                {{ row.creatorName || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="最后登录" min-width="155">
              <template #default="{ row }">
                {{ formatDate(row.lastLoginAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <template v-if="canOperateRow(row)">
                  <el-button text type="warning" size="small" @click="openResetPassword(row)">
                    重置密码
                  </el-button>
                  <el-popconfirm
                    :title="row.isActive ? '确认禁用该账号？' : '确认启用该账号？'"
                    @confirm="toggleActive(row)"
                  >
                    <template #reference>
                      <el-button text :type="row.isActive ? 'info' : 'success'" size="small">
                        {{ row.isActive ? '禁用' : '启用' }}
                      </el-button>
                    </template>
                  </el-popconfirm>
                  <el-popconfirm
                    title="确认删除该账号？此操作不可恢复。"
                    @confirm="handleDelete(row)"
                  >
                    <template #reference>
                      <el-button text type="danger" size="small">删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
                <span v-else class="no-perm">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 操作日志 Tab（仅 admin） -->
        <el-tab-pane v-if="authStore.isAdmin" label="操作日志" name="logs">
          <el-table :data="logs" stripe v-loading="logsLoading">
            <el-table-column prop="operatorName" label="操作者" width="100" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-tag :type="logActionTag(row.action)" size="small">{{ logActionLabel(row.action) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="targetName" label="目标账号" width="100" />
            <el-table-column label="详情" min-width="200">
              <template #default="{ row }">
                <code class="log-detail">{{ formatDetail(row.detail) }}</code>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="160">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="logsTotal > 20"
            layout="prev, pager, next"
            :total="logsTotal"
            :page-size="20"
            v-model:current-page="logsPage"
            @current-change="loadLogs"
            class="log-pagination"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑账号' : '新增账号'"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="显示名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="真实姓名或昵称" maxlength="20" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="英文数字下划线，3-20位" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role">
            <el-option
              v-if="authStore.isAdmin"
              label="店长（可管理员工）"
              value="manager"
            />
            <el-option label="员工（仅业务操作）" value="staff" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="至少6位" show-password maxlength="32" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" show-password maxlength="32" />
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态" prop="isActive">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="pwdDialogVisible" title="重置密码" width="400px" :close-on-click-modal="false">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" placeholder="至少6位" show-password maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onResetPassword" :loading="resetting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改自己密码弹窗 -->
    <el-dialog v-model="ownPwdVisible" title="修改密码" width="400px" :close-on-click-modal="false">
      <el-form ref="ownPwdFormRef" :model="ownPwdForm" :rules="ownPwdRules" label-width="80px">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="ownPwdForm.oldPassword" type="password" placeholder="输入原密码" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="ownPwdForm.newPassword" type="password" placeholder="至少6位" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="ownPwdForm.confirmPassword" type="password" placeholder="再次输入" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ownPwdVisible = false">取消</el-button>
        <el-button type="primary" @click="onChangeOwnPassword" :loading="changingPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

const authStore = useAuthStore()

// ========== 状态 ==========
const accounts = ref([])
const loading = ref(false)
const activeTab = ref('accounts')
const searchKeyword = ref('')
const roleFilter = ref('')

// 统计
const stats = reactive({ managerCount: 0, staffCount: 0, disabledCount: 0 })

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())

const pwdDialogVisible = ref(false)
const pwdFormRef = ref(null)
const resetting = ref(false)
const pwdForm = reactive({ newPassword: '', targetId: '' })

const ownPwdVisible = ref(false)
const ownPwdFormRef = ref(null)
const changingPwd = ref(false)
const ownPwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

// 日志
const logs = ref([])
const logsLoading = ref(false)
const logsPage = ref(1)
const logsTotal = ref(0)

// ========== 工具函数 ==========
function emptyForm() {
  return { id: '', username: '', password: '', confirmPassword: '', displayName: '', role: 'staff', isActive: true }
}

const formRules = computed(() => ({
  displayName: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '只能包含字母数字下划线，3-20位', trigger: 'blur' }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: isEdit.value ? [] : [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '至少6位', trigger: 'blur' }
  ],
  confirmPassword: isEdit.value ? [] : [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: (_r, v, cb) => v === form.password ? cb() : cb('两次密码不一致'), trigger: 'blur' }
  ],
}))

const pwdRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '至少6位', trigger: 'blur' }
  ]
}

const ownPwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: (_r, v, cb) => v === ownPwdForm.newPassword ? cb() : cb('两次密码不一致'), trigger: 'blur' }
  ]
}

function roleTag(role) {
  return { admin: 'danger', manager: 'warning', staff: 'info' }[role] || 'info'
}
function roleLabel(role) {
  return { admin: '管理员', manager: '店长', staff: '员工' }[role] || role
}
function logActionTag(action) {
  return { create_account: 'success', delete_account: 'danger', reset_password: 'warning', toggle_active: 'info' }[action] || 'info'
}
function logActionLabel(action) {
  return { create_account: '创建', delete_account: '删除', reset_password: '重置密码', toggle_active: '启/禁用', update_account: '编辑', change_own_password: '改密' }[action] || action
}

function formatDate(str) {
  if (!str) return '-'
  return new Date(str).toLocaleString('zh-CN', { hour12: false })
}

function formatDetail(detail) {
  if (!detail) return '-'
  try {
    const obj = typeof detail === 'string' ? JSON.parse(detail) : detail
    return Object.entries(obj).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${v}`).join(', ')
  } catch { return '-' }
}

function canOperateRow(row) {
  if (authStore.isAdmin) return true
  if (authStore.isManager && row.createdBy === parseInt(authStore.userInfo.id)) return true
  return false
}

const filteredAccounts = computed(() => {
  let list = accounts.value
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(a =>
      (a.username || '').toLowerCase().includes(kw) ||
      (a.displayName || '').toLowerCase().includes(kw)
    )
  }
  if (roleFilter.value) {
    list = list.filter(a => a.role === roleFilter.value)
  }
  return list
})

// ========== 数据加载 ==========
async function loadAccounts() {
  loading.value = true
  try {
    const res = await api.get('/merchant/accounts')
    const data = res && res.data
    accounts.value = Array.isArray(data) ? data : (data?.accounts || data?.list || [])
    updateStats()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '加载账号列表失败')
  } finally {
    loading.value = false
  }
}

function updateStats() {
  stats.managerCount = accounts.value.filter(a => a.role === 'manager').length
  stats.staffCount = accounts.value.filter(a => a.role === 'staff').length
  stats.disabledCount = accounts.value.filter(a => !a.isActive).length
}

function filterAccounts() { /* computed handles this */ }

// ========== 操作日志 ==========
async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await api.get('/merchant/accounts/logs', { params: { page: logsPage.value, pageSize: 20 } })
    const data = res?.data || res
    logs.value = data.list || []
    logsTotal.value = data.total || 0
  } catch (err) {
    ElMessage.error('加载操作日志失败')
  } finally {
    logsLoading.value = false
  }
}

function onTabChange(tab) {
  if (tab === 'logs' && logs.value.length === 0) loadLogs()
}

// ========== 创建/编辑账号 ==========
function openCreate() {
  isEdit.value = false
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id, username: row.username, password: '', confirmPassword: '',
    displayName: row.displayName, role: row.role, isActive: !!row.isActive
  })
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (isEdit.value) {
      await api.patch('/merchant/accounts/' + form.id, {
        displayName: form.displayName,
        role: form.role,
        isActive: form.isActive
      })
      ElMessage.success('账号已更新')
    } else {
      await api.post('/merchant/accounts', {
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        role: form.role
      })
      ElMessage.success('账号已创建')
    }
    dialogVisible.value = false
    loadAccounts()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

// ========== 启用/禁用 ==========
async function toggleActive(row) {
  try {
    await api.patch('/merchant/accounts/' + row.id, { isActive: !row.isActive })
    ElMessage.success(row.isActive ? '账号已禁用' : '账号已启用')
    loadAccounts()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '操作失败')
  }
}

// ========== 重置密码 ==========
function openResetPassword(row) {
  pwdForm.targetId = row.id
  pwdForm.newPassword = ''
  pwdDialogVisible.value = true
}

async function onResetPassword() {
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return
  resetting.value = true
  try {
    await api.patch('/merchant/accounts/' + pwdForm.targetId, { password: pwdForm.newPassword })
    ElMessage.success('密码已重置')
    pwdDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '重置失败')
  } finally {
    resetting.value = false
  }
}

// ========== 删除 ==========
async function handleDelete(row) {
  try {
    await api.del('/merchant/accounts/' + row.id)
    ElMessage.success('账号已删除')
    loadAccounts()
  } catch (err) {
    const msg = err.response?.data?.message || '删除失败'
    ElMessage.error(msg)
  }
}

// ========== 修改自己密码 ==========
function openOwnPassword() {
  ownPwdForm.oldPassword = ''
  ownPwdForm.newPassword = ''
  ownPwdForm.confirmPassword = ''
  ownPwdVisible.value = true
}

async function onChangeOwnPassword() {
  const valid = await ownPwdFormRef.value.validate().catch(() => false)
  if (!valid) return
  changingPwd.value = true
  try {
    await api.patch('/merchant/accounts/me/password', {
      oldPassword: ownPwdForm.oldPassword,
      newPassword: ownPwdForm.newPassword
    })
    ElMessage.success('密码修改成功')
    ownPwdVisible.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '修改密码失败')
  } finally {
    changingPwd.value = false
  }
}

// ========== 初始化 ==========
onMounted(() => loadAccounts())

// 暴露给父组件（MainLayout header 使用）
defineExpose({ openOwnPassword })
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-title { font-size: 22px; font-weight: 700; margin: 0; color: #303133; }
.stat-row { margin-bottom: 16px; }
.stat-card { text-align: center; }
.stat-num { font-size: 32px; font-weight: 700; color: #303133; }
.stat-num.disabled { color: #909399; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-avatar { background: #D4420A; color: #fff; font-weight: 600; }
.no-perm { color: #c0c4cc; }
.log-detail { font-size: 12px; color: #666; word-break: break-all; }
.log-pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
