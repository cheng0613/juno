<script setup lang="ts">
import { onMounted, ref, nextTick, inject } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useWorkspaceStore } from '@/stores/workspace'
import { useProviderStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'
import MessageItem from '@/components/chat/MessageItem.vue'
import ChatFooter from '@/components/chat/ChatFooter.vue'
import { Settings, Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const store = useSessionStore()
const workspaceStore = useWorkspaceStore()
const providerStore = useProviderStore()
const settingsStore = useSettingsStore()
const { theme, toggleTheme } = useTheme()

const messagesContainer = ref<HTMLElement | null>(null)

const toggleDetail = inject<() => void>('toggleDetail', () => {})

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function handleSend(message: string, images?: { data: string; mimeType: string }[]) {
  store.sendPrompt(message, images)
  scrollToBottom()
}

function handleAbort() {
  store.abort()
}

onMounted(async () => {
  if (!store.isConnected) {
    store.connect()
  }
  await Promise.all([
    providerStore.fetchProviders(),
    providerStore.fetchModels(true),
    settingsStore.fetchSettings(),
  ])
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Minimal header -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
      <div class="text-sm font-medium text-foreground">{{ workspaceStore.currentWorkspace?.name || 'Juno' }}</div>
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          @click="toggleDetail()"
          title="Toggle detail panel"
        >
          <Settings class="h-4 w-4" />
        </button>
        <button
          class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          @click="toggleTheme"
          title="Toggle theme"
        >
          <Sun v-if="theme === 'light'" class="h-4 w-4" />
          <Moon v-else class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-3 sm:px-4"
    >
      <div class="space-y-3 pb-4">
        <div
          v-if="store.messages.length === 0"
          class="flex items-center justify-center h-full min-h-[200px] text-muted-foreground"
        >
          <div class="text-center">
            <p class="text-sm">Send a message to start a conversation</p>
          </div>
        </div>
        <MessageItem
          v-for="msg in store.messages"
          :key="msg.id"
          :message="msg"
        />
      </div>
    </div>

    <!-- Chat Footer -->
    <ChatFooter
      :disabled="store.isStreaming"
      @send="handleSend"
      @abort="handleAbort"
    />
  </div>
</template>