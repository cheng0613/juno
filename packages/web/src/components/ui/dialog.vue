<script setup lang="ts">
import { cn } from '@/lib/utils'
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
}>(), {
  open: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = ref(false)

watch(() => props.open, (v) => {
  isOpen.value = v
}, { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', handleEsc)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc)
})

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    emit('update:open', false)
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="isOpen = false; emit('update:open', false)" />
      <div :class="cn(
        'relative z-50 rounded-lg border bg-background p-6 shadow-lg',
        'w-full max-w-lg max-h-[85vh] overflow-y-auto',
      )">
        <div v-if="title" class="mb-4 text-lg font-semibold">{{ title }}</div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>