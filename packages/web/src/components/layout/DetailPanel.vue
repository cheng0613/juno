<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSessionStore } from '@/stores/session'
import { X, ChevronDown, ChevronRight, GitBranch, ListChecks, Bot, FileCode, Plus, Minus } from 'lucide-vue-next'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()

const expandedSections = ref<Record<string, boolean>>({
  git: true,
  tasks: true,
  agent: true,
})

function toggleSection(key: string) {
  expandedSections.value[key] = !expandedSections.value[key]
}

const workspacePath = computed(() => workspaceStore.currentWorkspace?.path || '')
const workspaceName = computed(() => workspaceStore.currentWorkspace?.name || '')
</script>

<template>
  <div
    v-show="show"
    class="w-80 flex-shrink-0 border-l border-border overflow-y-auto bg-background flex flex-col"
  >
    <div class="flex items-center justify-between px-4 py-2.5">
      <span class="text-xs font-medium text-muted-foreground">Details</span>
      <button class="text-muted-foreground hover:text-foreground transition-colors" @click="emit('close')">
        <X class="h-4 w-4" />
      </button>
    </div>

    <div class="px-3 pb-3 space-y-2">
      <!-- Git Changes -->
      <div class="rounded-lg border-none bg-muted/30">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground"
          @click="toggleSection('git')"
        >
          <span class="flex items-center gap-1.5">
            <GitBranch class="h-3.5 w-3.5" />
            Git Changes
          </span>
          <component :is="expandedSections.git ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
        </button>
        <div v-if="expandedSections.git" class="px-3 pb-3 space-y-1 text-xs text-muted-foreground">
          <div v-if="workspacePath" class="flex items-center gap-1.5">
            <FileCode class="h-3 w-3" />
            <span class="truncate">{{ workspaceName }}</span>
          </div>
          <div class="pt-1 text-center italic text-xs opacity-60">Git changes: pending implementation</div>
        </div>
      </div>

      <!-- Tasks -->
      <div class="rounded-lg border-none bg-muted/30">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground"
          @click="toggleSection('tasks')"
        >
          <span class="flex items-center gap-1.5">
            <ListChecks class="h-3.5 w-3.5" />
            Tasks
          </span>
          <component :is="expandedSections.tasks ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
        </button>
        <div v-if="expandedSections.tasks" class="px-3 pb-3 space-y-2 text-xs">
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <span class="text-xs">Task monitoring: pending implementation</span>
          </div>
        </div>
      </div>

      <!-- Agent -->
      <div class="rounded-lg border-none bg-muted/30">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground"
          @click="toggleSection('agent')"
        >
          <span class="flex items-center gap-1.5">
            <Bot class="h-3.5 w-3.5" />
            Agent
          </span>
          <component :is="expandedSections.agent ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
        </button>
        <div v-if="expandedSections.agent" class="px-3 pb-3 text-xs text-muted-foreground space-y-1">
          <div>Connected: {{ sessionStore.isConnected ? 'pi-agent' : 'disconnected' }}</div>
          <div>Model: {{ sessionStore.currentModel || 'none' }}</div>
          <div>Session: {{ sessionStore.sessionId ? sessionStore.sessionId.slice(0, 12) + '...' : 'inactive' }}</div>
          <div v-if="workspacePath">Workspace: {{ workspaceName }}</div>
        </div>
      </div>
    </div>
  </div>
</template>