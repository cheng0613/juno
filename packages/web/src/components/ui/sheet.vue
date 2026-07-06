<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  open?: boolean
  side?: 'left' | 'right'
  title?: string
}>(), {
  side: 'right',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="fixed inset-0 bg-black/50" @click="emit('update:open', false)" />
      <div :class="cn(
        'fixed top-0 bottom-0 z-50 w-full max-w-md border bg-background p-6 shadow-lg',
        side === 'right' ? 'right-0' : 'left-0',
      )">
        <div v-if="title" class="mb-4 text-lg font-semibold">{{ title }}</div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>