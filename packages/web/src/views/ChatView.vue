<script setup lang="ts">
import { onMounted, ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore, type ChatMessage } from '@/stores/session'
import { useProviderStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'
import MessageItem from '@/components/chat/MessageItem.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import Dialog from '@/components/ui/dialog.vue'
import NativeSelect from '@/components/ui/native-select.vue'
import Button from '@/components/ui/button.vue'
import Badge from '@/components/ui/badge.vue'
import { Settings, Bot, Loader2, SlidersHorizontal, MessageSquare, Plus, Trash2 } from 'lucide-vue-next'

const router = useRouter()
const store = useSessionStore()
const providerStore = useProviderStore()
const settingsStore = useSettingsStore()

const messagesContainer = ref<HTMLElement | null>(null)
const showSettings = ref(false)
const showSidebar = ref(false)

interface SessionEntry {
  id: string
  name: string
  messageCount: number
  timestamp: number
}

const sessions = ref<SessionEntry[]>([])

function loadSessionHistory() {
  try {
    const saved = localStorage.getItem('juno-sessions')
    if (saved) sessions.value = JSON.parse(saved)
  } catch {}
}

function saveSession() {
  if (store.messages.length === 0) return
  const entry: SessionEntry = {
    id: crypto.randomUUID(),
    name: store.messages[0]?.content.slice(0, 50) || 'New session',
    messageCount: store.messages.length,
    timestamp: Date.now(),
  }
  const existing = sessions.value.findIndex(s => s.id === store.sessionId)
  if (existing >= 0) {
    sessions.value[existing] = { ...sessions.value[existing], messageCount: store.messages.length }
  } else {
    sessions.value.unshift(entry)
  }
  // Keep only 50 sessions
  if (sessions.value.length > 50) sessions.value = sessions.value.slice(0, 50)
  localStorage.setItem('juno-sessions', JSON.stringify(sessions.value))
}

function restoreSession(id: string) {
  // For now: save current, load placeholder (real restore needs RPC)
  saveSession()
  store.clearMessages()
  // In future: call RPC to load session
}

function deleteSession(id: string) {
  sessions.value = sessions.value.filter(s => s.id !== id)
  localStorage.setItem('juno-sessions', JSON.stringify(sessions.value))
}

const thinkingOptions = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

onMounted(async () => {
  if (!store.isConnected) {
    store.connect()
  }
  loadSessionHistory()
  await Promise.all([
    providerStore.fetchProviders(),
    providerStore.fetchModels(true),
    settingsStore.fetchSettings(),
  ])
})

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

function handleModelChange(val: string) {
  const [provider, ...rest] = val.split('/')
  const modelId = rest.join('/')
  if (provider && modelId) {
    store.setModel(provider, modelId)
    settingsStore.setDefaultModel(provider, modelId)
  }
}

function handleThinkingChange(level: string) {
  store.setThinkingLevel(level)
  settingsStore.setDefaultModel(settingsStore.defaultProvider, settingsStore.defaultModel, level)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function handleSend(message: string) {
  store.sendPrompt(message)
  scrollToBottom()
}

function handleAbort() {
  store.abort()
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex items-center justify-between border-b px-4 py-2">
      <div class="flex items-center gap-2">
        <Bot class="h-5 w-5" />
        <span class="font-semibold">Juno</span>
        <span v-if="store.currentModel" class="text-xs text-muted-foreground hidden sm:inline">
          · {{ store.currentModel }}
        </span>
        <span v-if="store.isStreaming" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 class="h-3 w-3 animate-spin" />
          streaming
        </span>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" @click="showSidebar = !showSidebar">
          <MessageSquare class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" @click="showSettings = true">
          <SlidersHorizontal class="h-4 w-4 mr-1" />
          Settings
        </Button>
        <Button variant="ghost" size="sm" @click="router.push('/models')">
          <Settings class="h-4 w-4 mr-1" />
          Models
        </Button>
        <Button variant="ghost" size="sm" @click="saveSession(); store.clearMessages()">
          <Plus class="h-4 w-4 mr-1" />
          New
        </Button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <div v-if="showSidebar" class="w-64 border-r overflow-y-auto p-2 flex-shrink-0 space-y-1">
        <div class="flex items-center justify-between px-2 py-1">
          <span class="text-xs font-medium text-muted-foreground">Sessions</span>
          <Button variant="ghost" size="sm" @click="showSidebar = false">
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
        <div v-if="sessions.length === 0" class="text-xs text-muted-foreground text-center py-4">
          No saved sessions
        </div>
        <button
          v-for="s in sessions"
          :key="s.id"
          class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent text-left"
          @click="restoreSession(s.id)"
        >
          <MessageSquare class="h-3 w-3 flex-shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="truncate">{{ s.name }}</div>
            <div class="text-muted-foreground">{{ s.messageCount }} msgs</div>
          </div>
        </button>
      </div>

    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <div v-if="store.messages.length === 0" class="flex h-full items-center justify-center text-muted-foreground">
        <div class="text-center">
          <Bot class="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Send a message to start a conversation</p>
        </div>
      </div>
      <MessageItem
        v-for="msg in store.messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
    </div>

    <div class="border-t p-4">
      <ChatInput
        :disabled="store.isStreaming"
        @send="handleSend"
        @abort="handleAbort"
      />
    </div>

    <Dialog v-model:open="showSettings" title="Chat Settings">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium">Model</label>
          <NativeSelect
            :model-value="currentModelValue"
            @update:model-value="handleModelChange"
          >
            <option value="" disabled>Select a model...</option>
            <option
              v-for="m in allModels"
              :key="m.value"
              :value="m.value"
            >
              {{ m.label }}
            </option>
          </NativeSelect>
          <p v-if="!currentModelValue" class="text-xs text-muted-foreground mt-1">
            No model selected. Go to Models page to configure.
          </p>
        </div>

        <div>
          <label class="text-xs font-medium">Thinking Level</label>
          <div class="flex gap-1 flex-wrap mt-1">
            <button
              v-for="level in thinkingOptions"
              :key="level"
              :class="[
                'px-2 py-1 text-xs rounded border transition-colors',
                settingsStore.defaultThinkingLevel === level
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input',
              ]"
              @click="handleThinkingChange(level)"
            >
              {{ level }}
            </button>
          </div>
        </div>

        <div class="border-t pt-2">
          <div class="text-xs font-medium mb-1">Session Info</div>
          <div class="text-xs text-muted-foreground space-y-0.5">
            <div>Messages: {{ store.messages.length }}</div>
            <div>Streaming: {{ store.isStreaming ? 'Yes' : 'No' }}</div>
            <div v-if="store.sessionId">Session: {{ store.sessionId.slice(0, 12) }}...</div>
            <Badge variant="outline" class="mt-1">
              {{ store.isConnected ? 'Connected' : 'Disconnected' }}
            </Badge>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>