<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useProviderStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'
import { Plus, Square } from 'lucide-vue-next'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ send: [message: string, images?: { data: string; mimeType: string }[]]; abort: [] }>()

const store = useSessionStore()
const providerStore = useProviderStore()
const settingsStore = useSettingsStore()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const images = ref<{ data: string; mimeType: string }[]>([])

const allModels = computed(() => {
  return providerStore.models.map(m => ({
    label: `${m.name || m.id} (${m.provider})`,
    value: `${m.provider}/${m.id}`,
  }))
})

const currentModelValue = computed(() => {
  if (settingsStore.defaultProvider && settingsStore.defaultModel) {
    return `${settingsStore.defaultProvider}/${settingsStore.defaultModel}`
  }
  return ''
})

const thinkingOptions = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

function handleModelChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  const [provider, ...rest] = val.split('/')
  const modelId = rest.join('/')
  if (provider && modelId) {
    store.setModel(provider, modelId)
    settingsStore.setDefaultModel(provider, modelId)
  }
}

function handleThinkingChange(e: Event) {
  const level = (e.target as HTMLSelectElement).value
  store.setThinkingLevel(level)
  settingsStore.setDefaultModel(settingsStore.defaultProvider, settingsStore.defaultModel, level)
}

function autoResize() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 160) + 'px'
  }
}

function handleSend() {
  const msg = input.value.trim()
  if (!msg && images.value.length === 0) return
  emit('send', msg, images.value.length > 0 ? images.value : undefined)
  input.value = ''
  images.value = []
  nextTick(autoResize)
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
        images.value.push({
          data: reader.result as string,
          mimeType: file.type,
        })
      }
      reader.readAsDataURL(file)
    }
  }
}
</script>

<template>
  <div class="px-4 pb-3 pt-1">
    <div class="space-y-1.5">
      <!-- Input -->
      <div class="relative">
        <textarea
          ref="textareaRef"
          v-model="input"
          :disabled="disabled"
          placeholder="随便问点什么..."
          class="w-full resize-none rounded-lg bg-muted/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 min-h-[40px] max-h-40 leading-relaxed"
          rows="1"
          @keydown="handleKeydown"
          @paste="handlePaste"
          @input="autoResize"
        />
      </div>

      <!-- Images preview -->
      <div v-if="images.length > 0" class="flex gap-2 flex-wrap">
        <div
          v-for="(img, i) in images"
          :key="i"
          class="relative"
        >
          <img :src="img.data" class="h-12 w-12 rounded object-cover" alt="pasted image" />
          <button
            class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
            @click="images.splice(i, 1)"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Controls bar -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <button class="flex items-center gap-1 hover:text-foreground transition-colors">
          <Plus class="h-3.5 w-3.5" />
        </button>
        <button class="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted/50 hover:text-foreground transition-colors">
          Build
        </button>
        <div class="flex-1" />
        <select
          :value="currentModelValue"
          class="bg-transparent text-xs outline-none cursor-pointer hover:text-foreground transition-colors"
          @change="handleModelChange"
        >
          <option value="" disabled>Select model...</option>
          <option v-for="m in allModels" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <select
          :value="settingsStore.defaultThinkingLevel"
          class="bg-transparent text-xs outline-none cursor-pointer hover:text-foreground transition-colors"
          @change="handleThinkingChange"
        >
          <option v-for="level in thinkingOptions" :key="level" :value="level">{{ level }}</option>
        </select>
        <button
          v-if="disabled"
          class="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted/50 hover:text-foreground transition-colors"
          @click="emit('abort')"
        >
          <Square class="h-3 w-3" />
          Abort
        </button>
      </div>
    </div>
  </div>
</template>