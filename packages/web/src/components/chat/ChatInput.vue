<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import { Send, Square } from 'lucide-vue-next'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
  abort: []
}>()

const input = ref('')

function handleSend() {
  const text = input.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  input.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="flex items-end gap-2">
    <Input
      v-model="input"
      :rows="3"
      placeholder="Type a message... (Shift+Enter for new line)"
      :disabled="disabled"
      @keydown="handleKeydown"
      class="flex-1"
    />
    <div class="flex gap-1">
      <Button
        v-if="disabled"
        variant="destructive"
        size="icon"
        @click="emit('abort')"
        title="Abort"
      >
        <Square class="h-4 w-4" />
      </Button>
      <Button
        v-else
        size="icon"
        :disabled="!input.trim()"
        @click="handleSend"
        title="Send"
      >
        <Send class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>