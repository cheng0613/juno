import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/httpClient'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__
  if (tauri?.core) {
    return tauri.core.invoke(cmd, args)
  }
  throw new Error('Not in Tauri environment')
}

export const useSettingsStore = defineStore('settings', () => {
  const defaultProvider = ref('')
  const defaultModel = ref('')
  const defaultThinkingLevel = ref('medium')
  const enabledModels = ref<string[]>([])

  async function fetchSettings() {
    try {
      let s: any
      if (isTauri()) {
        s = await tauriInvoke<any>('get_settings')
        s = {
          defaultProvider: s.default_provider,
          defaultModel: s.default_model,
          defaultThinkingLevel: s.default_thinking_level || 'medium',
          enabledModels: s.enabled_models || [],
        }
      } else {
        s = await api.getSettings()
      }
      defaultProvider.value = s.defaultProvider || ''
      defaultModel.value = s.defaultModel || ''
      defaultThinkingLevel.value = s.defaultThinkingLevel || 'medium'
      enabledModels.value = s.enabledModels || []
    } catch (err: any) {
      console.error('Failed to fetch settings:', err)
    }
  }

  async function setDefaultModel(provider: string, modelId: string, level?: string) {
    if (isTauri()) {
      await tauriInvoke('set_default_model', { provider, model_id: modelId, thinking_level: level })
    } else {
      await api.setDefaultModel(provider, modelId, level)
    }
    defaultProvider.value = provider
    defaultModel.value = modelId
    if (level) defaultThinkingLevel.value = level
  }

  return {
    defaultProvider,
    defaultModel,
    defaultThinkingLevel,
    enabledModels,
    fetchSettings,
    setDefaultModel,
  }
})