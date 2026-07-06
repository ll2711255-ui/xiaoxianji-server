<template>
  <el-card>
    <div style="margin-bottom:12px">
      <el-button type="primary" @click="dialogVisible=true">新增店员</el-button>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="nick_name" label="姓名" width="100" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role==='admin'?'danger':row.role==='merchant'?'warning':'info'" size="small">{{ roleMap[row.role] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录" width="170" />
      <el-table-column prop="created_at" label="创建时间" width="170" />
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增店员" width="400px">
      <el-form :model="staffForm" label-width="80px">
        <el-form-item label="手机号" required><el-input v-model="staffForm.phone" /></el-form-item>
        <el-form-item label="密码" required><el-input v-model="staffForm.password" type="password" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="staffForm.nickName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="staffForm.role">
            <el-option label="店员" value="staff" />
            <el-option label="店长" value="merchant" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="createStaff">确认</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { userApi } from '../../../shared/api';

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const staffForm = reactive({ phone: '', password: '', nickName: '', role: 'staff' });
const roleMap: Record<string, string> = { admin: '管理员', merchant: '店长', staff: '店员' };

async function load() { const res: any = await userApi.staffList(); list.value = res.data || []; }

async function createStaff() {
  if (!staffForm.phone || !staffForm.password) { ElMessage.warning('手机号和密码不能为空'); return; }
  try {
    await userApi.createStaff(staffForm);
    ElMessage.success('创建成功');
    dialogVisible.value = false;
    Object.assign(staffForm, { phone: '', password: '', nickName: '', role: 'staff' });
    load();
  } catch (err: any) { ElMessage.error(err.message); }
}

onMounted(load);
</script>
