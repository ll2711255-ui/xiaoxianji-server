<template>
  <div class="map-picker">
    <!-- 地址搜索栏 -->
    <div class="map-search-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索地址，直接在地图上定位"
        clearable
        @input="onSearchInput"
        @clear="suggestions = []"
      >
        <template #prefix>🔍</template>
      </el-input>
      <!-- 下拉建议 -->
      <div v-if="suggestions.length > 0" class="suggestion-list">
        <div
          v-for="(item, idx) in suggestions"
          :key="idx"
          class="suggestion-item"
          @click="onSelectSuggestion(item)"
        >
          <span class="sugg-title">{{ item.title }}</span>
          <span class="sugg-addr">{{ item.address }}</span>
        </div>
      </div>
    </div>

    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- 当前坐标 / 地址 只读展示 -->
    <div class="map-info">
      <span>📍 纬度 {{ displayLat }} &nbsp; 经度 {{ displayLng }}</span>
      <span v-if="displayAddress" class="map-addr">{{ displayAddress }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  latitude:  { type: Number, default: 23.1291 },
  longitude: { type: Number, default: 113.2644 },
  address:   { type: String, default: '' },
})

const emit = defineEmits(['update:latitude', 'update:longitude', 'update:address'])

const mapContainer = ref(null)
const searchQuery = ref('')
const suggestions = ref([])
let searchTimer = null
let map = null
let marker = null
let geocoder = null
let suggester = null
const displayLat = ref('23.1291')
const displayLng = ref('113.2644')
const displayAddress = ref('')

// ========== 初始化地图 ==========
function initMap(lat, lng) {
  if (!mapContainer.value) return
  // TMap 全局对象由 index.html 引入的 script 提供
  if (typeof TMap === 'undefined') {
    console.warn('[MapPicker] TMap SDK 未加载，请检查 index.html 中的 script 标签')
    return
  }

  lat = lat || 23.1291
  lng = lng || 113.2644

  // 初始化地图
  map = new TMap.Map(mapContainer.value, {
    center: new TMap.LatLng(lat, lng),
    zoom: 16,
    viewMode: '2D',
  })

  // 创建可拖动标记
  marker = new TMap.MultiMarker({
    map,
    styles: {
      'store-marker': new TMap.MarkerStyle({
        width: 40,
        height: 40,
        anchor: { x: 20, y: 40 },
        src: 'data:image/svg+xml;base64,' + btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="14" r="10" fill="#E8712A"/><path d="M20 24 L8 38 L20 32 L32 38 Z" fill="#E8712A" opacity="0.9"/><circle cx="20" cy="14" r="4" fill="#fff"/></svg>'
        ),
      }),
    },
    geometries: [
      {
        id: 'store',
        styleId: 'store-marker',
        position: new TMap.LatLng(lat, lng),
      },
    ],
  })

  // 标记拖动结束 → 逆地址解析
  marker.on('dragend', (e) => {
    const pos = e.geometry.position
    updateCoords(pos.lat, pos.lng)
    reverseLookup(pos.lat, pos.lng)
  })

  // 地图点击 → 移动标记
  map.on('click', (e) => {
    const pos = e.latLng
    moveMarkerTo(pos.lat, pos.lng)
    updateCoords(pos.lat, pos.lng)
    reverseLookup(pos.lat, pos.lng)
  })

  // 初始化 geocoder / suggester
  geocoder = new TMap.service.Geocoder()
  suggester = new TMap.service.Suggestion()

  displayLat.value = lat.toFixed(6)
  displayLng.value = lng.toFixed(6)
  if (props.address) displayAddress.value = props.address
}

// ========== 标记移动 ==========
function moveMarkerTo(lat, lng) {
  if (!marker) return
  marker.setGeometries([
    { id: 'store', styleId: 'store-marker', position: new TMap.LatLng(lat, lng) },
  ])
  map.setCenter(new TMap.LatLng(lat, lng))
}

function updateCoords(lat, lng) {
  displayLat.value = lat.toFixed(6)
  displayLng.value = lng.toFixed(6)
  emit('update:latitude', lat)
  emit('update:longitude', lng)
}

// ========== 逆地址解析 ==========
async function reverseLookup(lat, lng) {
  if (!geocoder) return
  try {
    const result = await geocoder.getLocation({ location: new TMap.LatLng(lat, lng) })
    if (result && result.result && result.result.address) {
      const addr = result.result.address
      displayAddress.value = addr
      emit('update:address', addr)
    }
  } catch (err) {
    console.warn('[MapPicker] 逆地址解析失败:', err)
  }
}

// ========== 地址搜索 ==========
function onSearchInput(val) {
  if (searchTimer) clearTimeout(searchTimer)
  if (!val || !val.trim()) { suggestions.value = []; return }
  searchTimer = setTimeout(() => doSuggest(val.trim()), 300)
}

async function doSuggest(keyword) {
  if (!suggester) return
  try {
    const result = await suggester.getSuggestions({
      keyword,
      region: '广州',
      region_fix: 1,
    })
    if (result && result.data) {
      suggestions.value = result.data.slice(0, 8).map(item => ({
        title: item.title || '',
        address: item.address || '',
        latitude: (item.location && item.location.lat) || 0,
        longitude: (item.location && item.location.lng) || 0,
      }))
    }
  } catch (err) {
    console.warn('[MapPicker] 地址搜索失败:', err)
  }
}

function onSelectSuggestion(item) {
  if (!item.latitude || !item.longitude) return
  searchQuery.value = item.title
  suggestions.value = []
  moveMarkerTo(item.latitude, item.longitude)
  updateCoords(item.latitude, item.longitude)
  displayAddress.value = item.address || item.title
  emit('update:address', item.address || item.title)
  map.setZoom(17) // 放大到更近的视角
}

// ========== 监听外部坐标变化 ==========
watch(
  () => [props.latitude, props.longitude],
  ([lat, lng]) => {
    if (lat && lng && map) {
      moveMarkerTo(lat, lng)
      displayLat.value = lat.toFixed(6)
      displayLng.value = lng.toFixed(6)
    }
  }
)

// ========== 生命周期 ==========
onMounted(async () => {
  await nextTick()
  // 给 SDK 一点时间加载（script 可能还在下载）
  if (typeof TMap === 'undefined') {
    // 轮询等待 SDK 加载（最多 5 秒）
    let retries = 0
    const interval = setInterval(() => {
      if (typeof TMap !== 'undefined') {
        clearInterval(interval)
        initMap(props.latitude, props.longitude)
        if (props.address) displayAddress.value = props.address
      }
      retries++
      if (retries > 50) clearInterval(interval)
    }, 100)
  } else {
    initMap(props.latitude, props.longitude)
    if (props.address) displayAddress.value = props.address
  }
})

onBeforeUnmount(() => {
  if (map) { map.destroy(); map = null }
  if (marker) { marker = null }
})
</script>

<style scoped>
.map-picker {
  width: 100%;
}
.map-search-bar {
  margin-bottom: 12px;
  position: relative;
}
.suggestion-list {
  position: absolute;
  z-index: 1000;
  background: #fff;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.suggestion-item {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}
.suggestion-item:last-child { border-bottom: none; }
.suggestion-item:hover { background: #f5f7fa; }
.sugg-title { font-size: 14px; color: #303133; font-weight: 500; }
.sugg-addr  { font-size: 12px; color: #909399; margin-top: 2px; }
.map-container {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}
.map-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #909399;
  padding: 8px 0 0;
}
.map-addr {
  color: #606266;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
