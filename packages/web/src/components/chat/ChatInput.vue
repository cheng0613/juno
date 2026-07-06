<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import { Send, Square, Image, X } from 'lucide-vue-next'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [message: string, images?: { data: string; mimeType: string }[]]
  abort: []
}>()

const input = ref('')
const pastedImages = ref<{ data: string; mimeType: string; preview: string }[]>([])

function handleSend() {
  const text = input.value.trim()
  if ((!text || props.disabled) && pastedImages.value.length === 0) return
  emit('send', text, pastedImages.value.length > 0 ? pastedImages.value.map(i => ({ data: i.data, mimeType: i.mimeType })) : undefined)
  input.value = ''
  pastedImages.value = []
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        pastedImages.value.push({
          data: base64.split(',')[1],
          mimeType: file.type,
          preview: base64,
        })
      }
      reader.readAsDataURL(file)
    }
  }
}

function removeImage(index: number) {
  pastedImages.value.splice(index, 1)
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="pastedImages.length" class="flex gap-2 flex-wrap">
      <div
        v-for="(img, i) in pastedImages"
        :key="i"
        class="relative group"
      >
        <img
          :src="img.preview"
          class="h-16 w-16 rounded border object-cover"
          alt="pasted image"
        />
        <button
          class="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          @click="removeImage(i)"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
    </div>
    <div class="flex items-end gap-2">
      <div class="relative flex-1">
        <Input
          v-model="input"
          :rows="3"
          placeholder="Type a message... (Shift+Enter for new line, Ctrl+V to paste images)"
          :disabled="disabled"
          @keydown="handleKeydown"
          @paste="handlePaste"
          class="flex-1"
        />
        <Image v-if="pastedImages.length" class="absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
      </div>
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
          :disabled="!input.trim() && pastedImages.length === 0"
          @click="handleSend"
          title="Send"
        >
          <Send class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>