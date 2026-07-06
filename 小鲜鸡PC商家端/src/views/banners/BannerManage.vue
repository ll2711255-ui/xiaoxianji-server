<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">首页广告管理</h2>
      <el-button type="primary" @click="onAddBanner">
        <el-icon><Plus /></el-icon> 新增广告
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="8" v-for="(b, i) in banners" :key="b._id" style="margin-bottom:16px">
        <el-card shadow="hover">
          <div class="banner-img-wrapper">
            <img v-if="b.image" :src="b.image" class="banner-img" />
            <div v-else class="banner-img-placeholder">
              <el-icon :size="40"><Picture /></el-icon>
              <p>点击上传图片</p>
            </div>
            <el-upload
              class="banner-upload-overlay"
              :show-file-list="false"
              :before-upload="(file) => onUploadBannerImage(file, i)"
              accept="image/*"
            >
              <div class="upload-trigger" />
            </el-upload>
          </div>
          <div style="padding:12px 0">
            <el-input v-model="b.title" placeholder="广告标题" size="small" style="margin-bottom:8px" />
            <el-input v-model="b.subtitle" placeholder="副标题（选填）" size="small" style="margin-bottom:8px" />
            <el-row :gutter="8" align="middle">
              <el-col :span="8">
                <el-switch v-model="b.statusOn" active-text="启用" inactive-text="禁用" size="small" />
              </el-col>
              <el-col :span="16" style="text-align:right">
                <el-button size="small" @click="moveUp(i)" :disabled="i === 0">↑</el-button>
                <el-button size="small" @click="moveDown(i)" :disabled="i === banners.length - 1">↓</el-button>
                <el-button size="small" type="danger" @click="onDel(i)">删除</el-button>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="banners.length === 0" description="暂无广告，点击上方按钮新增" />

    <div style="margin-top:20px;text-align:center">
      <el-button type="primary" size="large" @click="onSave" :loading="saving">保存广告设置</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Picture } from '@element-plus/icons-vue'
import api from '@/utils/api'

const banners = ref([])
const saving = ref(false)

async function loadBanners() {
  try {
    const res = await api.get('/banners')
    const list = (res && res.data && res.data.banners) || []
    banners.value = list.map(b => ({ ...b, statusOn: b.status === 'on' }))
  } catch (err) { console.error('加载广告失败:', err) }
}

function onAddBanner() {
  banners.value.push({
    _id: 'banner_new_' + Date.now(),
    image: '', title: '', subtitle: '', bg: '#FFF8F5', sort: banners.value.length + 1, statusOn: true
  })
}

function onDel(i) {
  ElMessageBox.confirm('确定删除该广告吗？').then(() => {
    banners.value.splice(i, 1)
  }).catch(() => {})
}

function moveUp(i) {
  if (i <= 0) return
  const list = banners.value
  ;[list[i - 1], list[i]] = [list[i], list[i - 1]]
  list.forEach((b, j) => b.sort = j + 1)
}

function moveDown(i) {
  const list = banners.value
  if (i >= list.length - 1) return
  ;[list[i], list[i + 1]] = [list[i + 1], list[i]]
  list.forEach((b, j) => b.sort = j + 1)
}

async function onUploadBannerImage(file, i) {
  try {
    const res = await api.upload('/upload/image', file)
    if (res && res.success) {
      banners.value[i].image = res.data.url || URL.createObjectURL(file)
    } else {
      banners.value[i].image = URL.createObjectURL(file)
    }
    ElMessage.success('图片已上传')
  } catch (err) {
    banners.value[i].image = URL.createObjectURL(file)
  }
  return false
}

async function onSave() {
  const empty = banners.value.find(b => !(b.title || '').trim())
  if (empty) { ElMessage.warning('请填写所有广告的标题'); return }

  saving.value = true
  const payload = banners.value.map(b => ({
    ...b, status: b.statusOn ? 'on' : 'off'
  }))
  try {
    const res = await api.put('/banners', { banners: payload })
    if (res && res.success) {
      ElMessage.success('广告已保存'); loadBanners()
    } else {
      ElMessage.error((res && res.message) || '保存失败')
    }
  } catch (err) { ElMessage.error('保存失败') }
  saving.value = false
}

onMounted(() => loadBanners())
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: #333; }
.banner-img-wrapper { position: relative; width: 100%; height: 160px; overflow: hidden; border-radius: 6px; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.banner-img-placeholder {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; background: #f5f6fa;
  color: #ccc; font-size: 13px;
}
.banner-upload-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.upload-trigger { width: 100%; height: 100%; cursor: pointer; }
</style>
