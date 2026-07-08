<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useWorkspaceStore } from '@/stores/workspace'
import { Plus, MessageSquare, Trash2 } from 'lucide-vue-next'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const router = useRouter()
const store = useSessionStore()
const workspaceStore = useWorkspaceStore()

const folderInput = ref<HTMLInputElement | null>(null)

interface SessionEntry {
  id: string
  name: string
  path: string
  messageCount: number
  timestamp: number
}

const sessions = ref<SessionEntry[]>([])
const sessionsLoading = ref(false)
const activeSessionId = ref<string | null>(null)

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__
  if (tauri?.core) return tauri.core.invoke(cmd, args)
  throw new Error('Not in Tauri environment')
}

async function loadSessionHistory() {
  if (isTauri()) {
    sessionsLoading.value = true
    try {
      const list = await tauriInvoke<any[]>('list_sessions')
      sessions.value = (list || []).map((s: any) => ({
        id: s.id,
        name: s.name || 'Untitled',
        path: s.path,
        messageCount: s.message_count,
        timestamp: s.timestamp,
      }))
    } catch (err) {
      console.error('Failed to list sessions:', err)
    } finally {
      sessionsLoading.value = false
    }
  } else {
    try {
      const saved = localStorage.getItem('juno-sessions')
      if (saved) sessions.value = JSON.parse(saved)
    } catch {}
  }
}

async function restoreSession(path: string, s: SessionEntry) {
  activeSessionId.value = s.id
  if (isTauri()) {
    store.clearMessages()
    try {
      await tauriInvoke('switch_session', { path })
    } catch (err) {
      console.error('Failed to switch session:', err)
    }
  }
}

function newSession() {
  activeSessionId.value = null
  store.clearMessages()
}

function onAddWorkspace() {
  folderInput.value?.click()
}

function onFolderPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  const first = files[0]
  const path = (first as any).path

  if (path) {
    const dirPath = path.substring(0, path.length - first.webkitRelativePath.length).replace(/\/$/, '')
    workspaceStore.addWorkspace(dirPath)
  } else {
    const parts = first.webkitRelativePath.split('/')
    workspaceStore.addWorkspace(parts[0])
  }

  input.value = ''
}

function onRemoveWorkspace(id: string, e: Event) {
  e.stopPropagation()
  workspaceStore.removeWorkspace(id)
}

onMounted(() => {
  loadSessionHistory()
})

watch(() => store.sessionId, (id) => {
  if (id && !id.startsWith('session_')) activeSessionId.value = null
})
</script>

<template>
  <div class="flex">
    <!-- Icon Rail -->
    <div class="w-12 flex flex-col items-center py-3 gap-2 flex-shrink-0 bg-muted/30 border-r border-border">
      <button
        v-for="ws in workspaceStore.workspaces"
        :key="ws.id"
        class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors hover:opacity-80 relative group"
        :style="{ backgroundColor: ws.iconBg, color: ws.iconText }"
        :class="{ 'ring-2 ring-offset-1 ring-offset-background': ws.id === workspaceStore.currentWorkspaceId }"
        @click="workspaceStore.selectWorkspace(ws.id)"
        :title="ws.name"
      >
        {{ ws.iconLetter }}
        <span
          class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          @click="onRemoveWorkspace(ws.id, $event)"
        >
          ×
        </span>
      </button>

      <div class="flex-1" />

      <button
        class="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        @click="onAddWorkspace"
        title="选择项目目录"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>

    <!-- Hidden folder input -->
    <input
      ref="folderInput"
      type="file"
      webkitdirectory
      class="hidden"
      @change="onFolderPicked"
    />

    <!-- Session List -->
    <div
      v-show="show"
      class="w-60 flex-shrink-0 border-r border-border overflow-y-auto bg-background flex flex-col"
    >
      <div class="px-3 pt-3 pb-2 space-y-2">
        <div class="text-xs text-muted-foreground truncate">
          {{ workspaceStore.currentWorkspace?.name || 'No workspace' }}
        </div>
        <button
          class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          @click="newSession()"
        >
          <Plus class="h-3.5 w-3.5" />
          新建会话
        </button>
      </div>

      <div v-if="sessions.length === 0" class="text-xs text-muted-foreground text-center py-8">
        No saved sessions
      </div>

      <div class="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        <button
          v-for="s in sessions"
          :key="s.id"
          class="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted/50 text-left transition-colors"
          :class="activeSessionId === s.id ? 'bg-muted/50' : ''"
          @click="restoreSession(s.path, s)"
        >
          <MessageSquare class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">{{ s.name }}</div>
            <div class="text-xs text-muted-foreground">{{ s.messageCount }} msgs</div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>