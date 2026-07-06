<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore, type ChatMessage } from '@/stores/session'
import MessageItem from '@/components/chat/MessageItem.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { Settings, Bot, Loader2 } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'

const router = useRouter()
const store = useSessionStore()
const messagesContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!store.isConnected) {
    store.connect()
  }
})

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
        <span v-if="store.isStreaming" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 class="h-3 w-3 animate-spin" />
          streaming
        </span>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" @click="router.push('/models')">
          <Settings class="h-4 w-4 mr-1" />
          Models
        </Button>
        <Button variant="ghost" size="sm" @click="store.clearMessages()">
          Clear
        </Button>
      </div>
    </header>

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

    <div class="border-t p-4">
      <ChatInput
        :disabled="store.isStreaming"
        @send="handleSend"
        @abort="handleAbort"
      />
    </div>
  </div>
</template>