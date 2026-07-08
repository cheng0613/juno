import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Workspace {
  id: string
  name: string
  path: string
  iconLetter: string
  iconBg: string
  iconText: string
}

const macaronColors = [
  { bg: '#FFE4E8', text: '#E83E5C' },
  { bg: '#E8E0F0', text: '#7C4DAE' },
  { bg: '#DCF5E6', text: '#2D8F5E' },
  { bg: '#FFE8D6', text: '#E87A2D' },
  { bg: '#DEE8F5', text: '#4A7DB4' },
  { bg: '#FCF5D6', text: '#B89E1A' },
  { bg: '#F5E0EC', text: '#C44A7C' },
  { bg: '#DCF0E0', text: '#3A8F6A' },
]

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__
  if (tauri?.core) return tauri.core.invoke(cmd, args)
  throw new Error('Not in Tauri environment')
}

function getStorageKey() {
  return 'juno-workspaces'
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const currentWorkspaceId = ref<string | null>(null)

  const currentWorkspace = computed(() =>
    workspaces.value.find(w => w.id === currentWorkspaceId.value) || null
  )

  function load() {
    try {
      const raw = localStorage.getItem(getStorageKey())
      if (raw) {
        const list = JSON.parse(raw) as Workspace[]
        workspaces.value = list
        if (list.length > 0 && !currentWorkspaceId.value) {
          currentWorkspaceId.value = list[0].id
        }
      }
    } catch {}
  }

  function save() {
    localStorage.setItem(getStorageKey(), JSON.stringify(workspaces.value))
  }

  function addWorkspace(path: string) {
    const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Untitled'
    const letter = name.charAt(0).toUpperCase()
    const colorIdx = workspaces.value.length % macaronColors.length
    const color = macaronColors[colorIdx]

    const ws: Workspace = {
      id: crypto.randomUUID(),
      name,
      path,
      iconLetter: letter,
      iconBg: color.bg,
      iconText: color.text,
    }

    workspaces.value.push(ws)
    currentWorkspaceId.value = ws.id
    save()
    return ws
  }

  function removeWorkspace(id: string) {
    const idx = workspaces.value.findIndex(w => w.id === id)
    if (idx === -1) return
    workspaces.value.splice(idx, 1)
    if (currentWorkspaceId.value === id) {
      currentWorkspaceId.value = workspaces.value.length > 0 ? workspaces.value[0].id : null
    }
    save()
  }

  function selectWorkspace(id: string) {
    if (workspaces.value.find(w => w.id === id)) {
      currentWorkspaceId.value = id
    }
  }

  async function pickFolder(): Promise<string | null> {
    if (isTauri()) {
      try {
        const tauri = (window as any).__TAURI__
        const selected = await tauri.dialog.open({
          directory: true,
          multiple: false,
          title: '选择项目目录',
        })
        return selected as string | null
      } catch (err) {
        console.error('Failed to pick folder:', err)
        return null
      }
    }
    return null
  }

  load()

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    addWorkspace,
    removeWorkspace,
    selectWorkspace,
    pickFolder,
    save,
  }
})