<script setup lang="ts">
import { cn } from '@/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  label: string
  selected?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    :class="cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
      selected && 'bg-accent text-accent-foreground',
      disabled && 'pointer-events-none opacity-50',
    )"
    @click="emit('click')"
  >
    <slot />
    <span v-if="label" class="ml-auto text-xs text-muted-foreground">{{ label }}</span>
  </button>
</template>