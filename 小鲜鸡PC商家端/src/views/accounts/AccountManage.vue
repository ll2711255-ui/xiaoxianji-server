<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">账号管理</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建账号
      </el-button>
    </div>

    <!-- 账号列表 -->
    <el-card>
      <el-table :data="accounts" stripe v-loading="loading">
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="姓名" min-width="100" />
        <el-table-column label="角色" width="80">
          <template #default="{ row }">
            <el-tag :type="roleTag(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.lastLoginAt) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="warning" size="small" @click="resetPassword(row)">重置密码</el-button>
            <el-button
              text type="danger" size="small"
              :disabled="row.role === 'admin' || row.id === authStore.merchantId"
              @click="removeAccount(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑账号' : '新建账号'"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录用用户名" maxlength="20" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="至少6位" show-password maxlength="32" />
        </el-form-item>
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="显示名称" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role">
            <!-- admin 可以创建 manager 和 staff -->
            <el-option
              v-if="authStore.role === 'admin'"
              label="店长（可管理员工）" value="manager"
            />
            <!-- admin 和 manager 都可以创建 staff -->
            <el-option label="员工（仅业务操作）" value="staff" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态" prop="isActive">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="400px" :close-on-click-modal="false">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" placeholder="至少6位" show-password maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onResetPassword" :loading="resetting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

const authStore = useAuthStore()
const accounts = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref(null)
const passwordDialogVisible = ref(false)
const pwdFormRef = ref(null)
const resetting = ref(false)
const resetTargetId = ref('')

function emptyForm() {
  return {
    id: '',
    username: '',
    password: '',
    displayName: '',
    role: 'staff',
    isActive: true,
  }
}

const form = reactive(emptyForm())

const rules = computed(() => ({
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: isEdit.value ? [] : [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}))

const pwdForm = reactive({ newPassword: '' })
const pwdRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
}

function roleTag(role) {
  const map = { admin: 'danger', manager: 'warning', staff: 'info' }
  return map[role] || 'info'
}

function roleLabel(role) {
  const map = { admin: '管理员', manager: '店长', staff: '员工' }
  return map[role] || role
}

function formatDate(str) {
  if (!str) return '-'
  return new Date(str).toLocaleString('zh-CN', { hour12: false })
}

// ========== 数据加载 ==========
async function loadAccounts() {
  loading.value = true
  try {
    const res = await api.get('/merchant/accounts')
    accounts.value = (res && res.data && res.data.accounts) || []
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '加载账号列表失败')
  } finally {
    loading.value = false
  }
}

// ========== 新建 ==========
function openCreate() {
  isEdit.value = false
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

// ========== 编辑 ==========
function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    username: row.username,
    password: '',
    displayName: row.displayName,
    role: row.role,
    isActive: row.isActive,
  })
  dialogVisible.value = true
}

// ========== 保存 ==========
async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value) {
      await api.put('/merchant/accounts/' + form.id, {
        displayName: form.displayName,
        role: form.role,
        isActive: form.isActive,
      })
      ElMessage.success('账号已更新')
    } else {
      await api.post('/merchant/accounts', {
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        role: form.role,
      })
      ElMessage.success('账号已创建')
    }
    dialogVisible.value = false
    loadAccounts()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '操作失败')
  } finally {
    saving.value = false
  }
}

// ========== 删除 ==========
async function removeAccount(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除账号「${row.displayName}」(${row.username}) 吗？此操作不可撤销。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch { return }

  try {
    await api.del('/merchant/accounts/' + row.id)
    ElMessage.success('账号已删除')
    loadAccounts()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '删除失败')
  }
}

// ========== 重置密码 ==========
function resetPassword(row) {
  resetTargetId.value = row.id
  pwdForm.newPassword = ''
  passwordDialogVisible.value = true
}

async function onResetPassword() {
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return

  resetting.value = true
  try {
    await api.put('/merchant/accounts/' + resetTargetId.value + '/reset-password', {
      newPassword: pwdForm.newPassword,
    })
    ElMessage.success('密码已重置')
    passwordDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || '重置密码失败')
  } finally {
    resetting.value = false
  }
}

onMounted(() => { loadAccounts() })
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  font-size: 22px; font-weight: 700; margin: 0; color: #303133;
}
</style>
