<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()
onMounted(() => initTheme())
</script>

<template>
  <RouterView />
  <Toaster position="top-right" richColors />
</template>