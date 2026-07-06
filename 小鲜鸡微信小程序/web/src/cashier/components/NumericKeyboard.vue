<template>
  <div class="keyboard">
    <div class="key-row" v-for="row in rows" :key="row.join()">
      <button v-for="k in row" :key="k" :class="['key',{ wide:k==='0', fn:k==='clear'||k==='⌫' }]" @click="$emit('key',k==='⌫'?'backspace':k)">
        {{ k }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ key: [key: string] }>();
const rows = [
  ['1','2','3','⌫'],
  ['4','5','6','clear'],
  ['7','8','9','.'],
  ['0'],
];
</script>

<style scoped>
.keyboard{display:flex;flex-direction:column;gap:4px}
.key-row{display:flex;gap:4px}
.key{flex:1;height:56px;font-size:22px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;user-select:none;transition:background .1s}
.key:hover{background:#f0f0f0}
.key:active{background:#e0e0e0}
.key.wide{flex:3}
.key.fn{background:#f5f5f5;font-size:16px;color:#666}
</style>
