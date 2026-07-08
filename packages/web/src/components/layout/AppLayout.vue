<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'
import AppSidebar from './AppSidebar.vue'
import DetailPanel from './DetailPanel.vue'

const showSidebar = ref(true)
const showDetail = ref(false)

provide('showSidebar', showSidebar)
provide('showDetail', showDetail)

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
}

function toggleDetail() {
  showDetail.value = !showDetail.value
}

provide('toggleSidebar', toggleSidebar)
provide('toggleDetail', toggleDetail)

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'b' && !e.shiftKey) {
      e.preventDefault()
      toggleSidebar()
    } else if (e.key.toLowerCase() === 'd' && e.shiftKey) {
      e.preventDefault()
      toggleDetail()
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <AppSidebar :show="showSidebar" @toggle="toggleSidebar" />

    <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <slot />
    </main>

    <DetailPanel :show="showDetail" @close="showDetail = false" />
  </div>
</template>