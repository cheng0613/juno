import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/httpClient'

export const useProviderStore = defineStore('providers', () => {
  const providers = ref<any[]>([])
  const models = ref<any[]>([])
  const loading = ref(false)

  async function fetchProviders() {
    loading.value = true
    try {
      providers.value = await api.getProviders()
    } catch (err: any) {
      console.error('Failed to fetch providers:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchModels(availableOnly = true) {
    try {
      models.value = await api.getModels(availableOnly)
    } catch (err: any) {
      console.error('Failed to fetch models:', err)
    }
  }

  async function setApiKey(provider: string, key: string, env?: Record<string, string>) {
    await api.setApiKey(provider, key, env)
    await fetchProviders()
    await fetchModels()
  }

  async function removeApiKey(provider: string) {
    await api.removeApiKey(provider)
    await fetchProviders()
    await fetchModels()
  }

  async function testConnection(provider: string) {
    return api.testConnection(provider)
  }

  return {
    providers,
    models,
    loading,
    fetchProviders,
    fetchModels,
    setApiKey,
    removeApiKey,
    testConnection,
  }
})