<script setup lang="ts">
import type { ChatMessage } from '@/stores/session'
import { User, Bot, Terminal, FileText, Code, ChevronDown, ChevronRight, Loader2 } from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import { Marked } from 'marked'
import hljs from 'highlight.js'

const marked = new Marked({
  gfm: true,
  breaks: true,
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

const props = defineProps<{
  message: ChatMessage
}>()

const isThinkingExpanded = ref(true)
const expandedToolCalls = ref<Set<string>>(new Set())
const contentRef = ref<HTMLElement | null>(null)

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  try {
    return marked.parse(props.message.content) as string
  } catch {
    return props.message.content
  }
})

watch(renderedContent, () => {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement)
      })
    }
  })
})

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
          Thinking ({{ message.thinking.length }} chars)
        </button>
        <div
          v-if="isThinkingExpanded"
          class="mt-1 rounded bg-muted-foreground/10 p-2 text-xs italic whitespace-pre-wrap max-h-48 overflow-y-auto"
        >
          {{ message.thinking }}
        </div>
      </div>

      <div ref="contentRef" class="prose prose-sm max-w-none dark:prose-invert">
        <div v-if="message.isStreaming" v-html="renderedContent + '▊'" />
        <div v-else v-html="renderedContent" />
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
              <pre class="text-xs whitespace-pre-wrap font-mono bg-muted-foreground/5 rounded p-1">{{ JSON.stringify(tc.args, null, 2) }}</pre>
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

<style scoped>
.prose pre {
  background-color: hsl(var(--muted));
  border-radius: 0.375rem;
  padding: 0.75rem;
  overflow-x: auto;
  font-size: 0.8rem;
}
.prose code {
  font-size: 0.8rem;
  background-color: hsl(var(--muted));
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
.prose pre code {
  background: none;
  padding: 0;
}
.prose p {
  margin: 0.5rem 0;
}
.prose p:first-child {
  margin-top: 0;
}
.prose p:last-child {
  margin-bottom: 0;
}
.prose ul, .prose ol {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
.prose li {
  margin: 0.25rem 0;
}
.prose h1, .prose h2, .prose h3, .prose h4 {
  margin: 0.75rem 0 0.5rem;
  font-weight: 600;
}
.prose blockquote {
  border-left: 3px solid hsl(var(--border));
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: hsl(var(--muted-foreground));
}
.prose table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
}
.prose th, .prose td {
  border: 1px solid hsl(var(--border));
  padding: 0.375rem 0.5rem;
  text-align: left;
}
.prose th {
  background-color: hsl(var(--muted));
  font-weight: 600;
}
</style>