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
          <div class="banner-img-wrapper" @click="onClickUpload(i)">
            <img v-if="b.image" :src="b.image" class="banner-img" />
            <div v-else class="banner-img-placeholder">
              <el-icon :size="40"><Picture /></el-icon>
              <p>点击上传图片</p>
            </div>
            <div v-if="b.uploading" class="banner-uploading-mask">
              <el-icon class="is-loading" :size="28"><Loading /></el-icon>
              <span>上传中...</span>
            </div>
            <!-- 原生 file input，每个 banner 独立 -->
            <input
              type="file"
              :ref="el => fileInputs[i] = el"
              accept="image/*"
              style="display:none"
              @change="(e) => onFileChange(e, i)"
            />
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
import { Plus, Picture, Loading } from '@element-plus/icons-vue'
import api from '@/utils/api'

const banners = ref([])
const saving = ref(false)
const fileInputs = ref({})

async function loadBanners() {
  try {
    const res = await api.get('/store/banners')
    const list = (res && res.data && res.data.banners) || []
    banners.value = list.map(b => ({
      ...b,
      // 后端返 imageUrl（image_url 转驼峰），统一为 image 供模板和上传逻辑使用
      image: b.imageUrl || b.image || '',
      statusOn: b.status === 'on',
      uploading: false
    }))
  } catch (err) { console.error('加载广告失败:', err) }
}

function onAddBanner() {
  banners.value.push({
    _id: 'banner_new_' + Date.now(),
    image: '', title: '', subtitle: '', bg: '#FFF8F5', sort: banners.value.length + 1, statusOn: true, uploading: false
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

// 点击整个图片区域 → 触发对应 banner 的隐藏 file input
function onClickUpload(i) {
  const el = fileInputs.value[i]
  if (el) {
    el.value = ''  // 清空，允许重复选同一文件
    el.click()
  }
}

async function onFileChange(e, i) {
  const file = e.target.files && e.target.files[0]
  if (!file) return

  // 前端校验
  if (!file.type.startsWith('image/')) { ElMessage.error('只能上传图片文件'); return }
  if (file.size / 1024 / 1024 > 5) { ElMessage.error('图片大小不能超过 5MB'); return }

  banners.value[i].uploading = true
  try {
    const res = await api.upload('/upload/image', file)
    if (res && res.success && res.data && res.data.url) {
      banners.value[i].image = res.data.url
      ElMessage.success('图片已上传')
    } else {
      ElMessage.error((res && res.message) || '上传失败')
    }
  } catch (err) {
    ElMessage.error(err.message || '上传失败')
  }
  banners.value[i].uploading = false
  // 清空 input，允许重复上传
  e.target.value = ''
}

async function onSave() {
  const empty = banners.value.find(b => !(b.title || '').trim())
  if (empty) { ElMessage.warning('请填写所有广告的标题'); return }

  saving.value = true
  const payload = banners.value.map(b => ({
    ...b, status: b.statusOn ? 'on' : 'off'
  }))
  try {
    const res = await api.put('/store/banners', { banners: payload })
    if (res && res.success) {
      ElMessage.success('广告已保存'); loadBanners()
    } else {
      ElMessage.error((res && res.message) || '保存失败')
    }
  } catch (err) { ElMessage.error(err.response?.data?.message || err.message || '保存失败') }
  saving.value = false
}

onMounted(() => loadBanners())
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: #333; }
.banner-img-wrapper { position: relative; width: 100%; height: 160px; overflow: hidden; border-radius: 6px; cursor: pointer; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.banner-img-placeholder {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; background: #f5f6fa;
  color: #ccc; font-size: 13px;
}
.banner-uploading-mask {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #fff; gap: 8px;
  font-size: 13px;
}
</style>
