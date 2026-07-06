<script setup lang="ts">
import type { ChatMessage } from '@/stores/session'
import { User, Bot, Terminal, FileText, Code, ChevronDown, ChevronRight, Loader2 } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{
  message: ChatMessage
}>()

const isThinkingExpanded = ref(false)
const expandedToolCalls = ref<Set<string>>(new Set())

function toggleToolCall(id: string) {
  if (expandedToolCalls.value.has(id)) {
    expandedToolCalls.value.delete(id)
  } else {
    expandedToolCalls.value.add(id)
  }
}

function toolIcon(name: string) {
  switch (name) {
    case 'bash': return Terminal
    case 'read': case 'write': case 'edit': return FileText
    default: return Code
  }
}
</script>

<template>
  <div :class="['flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div v-if="message.role !== 'user'" class="flex-shrink-0">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <Bot class="h-4 w-4" />
      </div>
    </div>

    <div :class="['max-w-[80%] rounded-lg px-4 py-2', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted']">
      <div v-if="message.thinking" class="mb-2">
        <button
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          @click="isThinkingExpanded = !isThinkingExpanded"
        >
          <component :is="isThinkingExpanded ? ChevronDown : ChevronRight" class="h-3 w-3" />
          Thinking
        </button>
        <div
          v-if="isThinkingExpanded"
          class="mt-1 rounded bg-muted-foreground/10 p-2 text-xs italic whitespace-pre-wrap"
        >
          {{ message.thinking }}
        </div>
      </div>

      <div class="whitespace-pre-wrap text-sm leading-relaxed">
        {{ message.content }}
        <span v-if="message.isStreaming" class="animate-pulse">▊</span>
      </div>

      <div v-if="message.toolCalls?.length" class="mt-2 space-y-1">
        <div
          v-for="tc in message.toolCalls"
          :key="tc.id"
          class="rounded border bg-background/50"
        >
          <button
            class="flex w-full items-center gap-2 px-2 py-1 text-xs font-medium"
            @click="toggleToolCall(tc.id)"
          >
            <component :is="toolIcon(tc.name)" class="h-3 w-3" />
            <span>{{ tc.name }}</span>
            <Loader2 v-if="tc.isRunning" class="h-3 w-3 animate-spin ml-auto" />
            <ChevronDown v-else-if="expandedToolCalls.has(tc.id)" class="h-3 w-3 ml-auto" />
            <ChevronRight v-else class="h-3 w-3 ml-auto" />
          </button>
          <div v-if="expandedToolCalls.has(tc.id)" class="border-t px-2 py-1">
            <div v-if="tc.args && Object.keys(tc.args).length" class="mb-1">
              <code class="text-xs">{{ JSON.stringify(tc.args, null, 2) }}</code>
            </div>
            <div v-if="tc.result" class="max-h-48 overflow-y-auto">
              <pre class="text-xs whitespace-pre-wrap font-mono bg-muted-foreground/5 rounded p-1">{{ tc.result }}</pre>
            </div>
            <div v-if="tc.isError" class="text-xs text-destructive">Error</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="message.role === 'user'" class="flex-shrink-0">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <User class="h-4 w-4" />
      </div>
    </div>
  </div>
</template>