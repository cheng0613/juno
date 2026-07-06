<script setup lang="ts">
import { cn } from '@/lib/utils'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}>(), {
  variant: 'default',
})

const classes = computed(() => cn(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    'border-transparent bg-primary text-primary-foreground shadow': props.variant === 'default',
    'border-transparent bg-secondary text-secondary-foreground': props.variant === 'secondary',
    'border-transparent bg-destructive text-destructive-foreground shadow': props.variant === 'destructive',
    'text-foreground': props.variant === 'outline',
  },
))
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>