<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import { Send, Square, Image, X, File, Folder } from 'lucide-vue-next'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [message: string, images?: { data: string; mimeType: string }[]]
  abort: []
}>()

const input = ref('')
const pastedImages = ref<{ data: string; mimeType: string; preview: string }[]>([])
const inputRef = ref<HTMLTextAreaElement | HTMLInputElement | null>(null)

// @ autocomplete
const showAtMenu = ref(false)
const atQuery = ref('')
const atResults = ref<{ name: string; path: string; is_dir: boolean }[]>([])
const atSelectedIndex = ref(0)
const atTriggerPos = ref(0) // cursor position where @ was typed

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__
  if (tauri?.core) return tauri.core.invoke(cmd, args)
  throw new Error('Not in Tauri environment')
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  const cursorPos = target.selectionStart
  const text = target.value

  // Check for @ trigger
  const beforeCursor = text.slice(0, cursorPos)
  const atMatch = beforeCursor.match(/@(\w*)$/)

  if (atMatch && !props.disabled) {
    const query = atMatch[1]
    atQuery.value = query
    atTriggerPos.value = atMatch.index!
    showAtMenu.value = true

    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(async () => {
      if (isTauri()) {
        try {
          atResults.value = await tauriInvoke<any[]>('list_files', { query })
        } catch { atResults.value = [] }
      } else {
        // Web mode: no file listing, show placeholder
        atResults.value = []
      }
      atSelectedIndex.value = 0
    }, 200)
  } else {
    showAtMenu.value = false
  }
}

function selectFile(file: { name: string; path: string; is_dir: boolean }) {
  const text = input.value
  const before = text.slice(0, atTriggerPos.value)
  const after = text.slice(atTriggerPos.value + 1 + atQuery.value.length)
  input.value = `${before}@${file.name} ${after}`
  showAtMenu.value = false

  nextTick(() => {
    const el = inputRef.value
    if (el) {
      const newPos = before.length + 1 + file.name.length + 1
      el.setSelectionRange(newPos, newPos)
      el.focus()
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (showAtMenu.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      atSelectedIndex.value = Math.min(atSelectedIndex.value + 1, atResults.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      atSelectedIndex.value = Math.max(atSelectedIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (atResults.value[atSelectedIndex.value]) {
        e.preventDefault()
        selectFile(atResults.value[atSelectedIndex.value])
        return
      }
    }
    if (e.key === 'Escape') {
      showAtMenu.value = false
      e.preventDefault()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const text = input.value.trim()
  if ((!text || props.disabled) && pastedImages.value.length === 0) return
  emit('send', text, pastedImages.value.length > 0 ? pastedImages.value.map(i => ({ data: i.data, mimeType: i.mimeType })) : undefined)
  input.value = ''
  pastedImages.value = []
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
  <div class="space-y-2 relative">
    <div v-if="pastedImages.length" class="flex gap-2 flex-wrap">
      <div v-for="(img, i) in pastedImages" :key="i" class="relative group">
        <img :src="img.preview" class="h-16 w-16 rounded border object-cover" alt="pasted image" />
        <button
          class="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          @click="removeImage(i)"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
    </div>

    <div class="flex items-end gap-2 relative">
      <div class="relative flex-1">
        <Input
          ref="inputRef"
          v-model="input"
          :rows="3"
          placeholder="Type a message... (@ to reference files, Shift+Enter for new line)"
          :disabled="disabled"
          @keydown="handleKeydown"
          @paste="handlePaste"
          @input="handleInput"
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
          title="Abort (Ctrl+.)"
        >
          <Square class="h-4 w-4" />
        </Button>
        <Button
          v-else
          size="icon"
          :disabled="!input.trim() && pastedImages.length === 0"
          @click="handleSend"
          title="Send (Enter)"
        >
          <Send class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- @ autocomplete dropdown -->
    <div
      v-if="showAtMenu && atResults.length > 0"
      class="absolute bottom-full left-0 mb-2 w-80 rounded-lg border bg-background shadow-lg overflow-hidden z-50"
    >
      <div class="text-xs text-muted-foreground px-3 py-1.5 border-b">Files</div>
      <div class="max-h-48 overflow-y-auto">
        <button
          v-for="(file, i) in atResults"
          :key="file.path"
          :class="[
            'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left',
            i === atSelectedIndex ? 'bg-accent' : '',
          ]"
          @click="selectFile(file)"
          @mouseenter="atSelectedIndex = i"
        >
          <component :is="file.is_dir ? Folder : File" class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span class="truncate">{{ file.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>