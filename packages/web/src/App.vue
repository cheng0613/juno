<script setup lang="ts">
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()
onMounted(() => initTheme())
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
  <Toaster position="top-right" richColors />
</template>