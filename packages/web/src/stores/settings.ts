import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/httpClient'

export const useSettingsStore = defineStore('settings', () => {
  const defaultProvider = ref('')
  const defaultModel = ref('')
  const defaultThinkingLevel = ref('medium')
  const enabledModels = ref<string[]>([])

  async function fetchSettings() {
    try {
      const s = await api.getSettings()
      defaultProvider.value = s.defaultProvider || ''
      defaultModel.value = s.defaultModel || ''
      defaultThinkingLevel.value = s.defaultThinkingLevel || 'medium'
      enabledModels.value = s.enabledModels || []
    } catch (err: any) {
      console.error('Failed to fetch settings:', err)
    }
  }

  async function setDefaultModel(provider: string, modelId: string, level?: string) {
    await api.setDefaultModel(provider, modelId, level)
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