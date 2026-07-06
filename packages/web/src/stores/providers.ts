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

export const useProviderStore = defineStore('providers', () => {
  const providers = ref<any[]>([])
  const models = ref<any[]>([])
  const loading = ref(false)

  async function fetchProviders() {
    loading.value = true
    try {
      if (isTauri()) {
        providers.value = await tauriInvoke<any[]>('get_providers')
      } else {
        providers.value = await api.getProviders()
      }
    } catch (err: any) {
      console.error('Failed to fetch providers:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchModels(availableOnly = true) {
    try {
      if (isTauri()) {
        models.value = await tauriInvoke<any[]>('get_models', { available_only: availableOnly })
      } else {
        models.value = await api.getModels(availableOnly)
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err)
    }
  }

  async function setApiKey(provider: string, key: string, _env?: Record<string, string>) {
    if (isTauri()) {
      await tauriInvoke('set_api_key', { provider, key })
    } else {
      await api.setApiKey(provider, key, _env)
    }
    await fetchProviders()
    await fetchModels()
  }

  async function removeApiKey(provider: string) {
    if (isTauri()) {
      await tauriInvoke('remove_api_key', { provider })
    } else {
      await api.removeApiKey(provider)
    }
    await fetchProviders()
    await fetchModels()
  }

  async function testConnection(provider: string) {
    if (isTauri()) {
      return tauriInvoke<any>('test_connection', { provider })
    }
    return api.testConnection(provider)
  }

  async function getEndpoint(provider: string) {
    if (isTauri()) {
      return tauriInvoke<any>('get_endpoint', { provider })
    }
    return api.getEndpoint(provider)
  }

  async function setEndpoint(provider: string, config: { baseUrl?: string; api?: string; headers?: Record<string, string> }) {
    if (isTauri()) {
      await tauriInvoke('set_endpoint', { provider, base_url: config.baseUrl, api: config.api })
    } else {
      await api.setEndpoint(provider, config)
    }
  }

  async function removeEndpoint(provider: string) {
    if (isTauri()) {
      await tauriInvoke('remove_endpoint', { provider })
    } else {
      await api.removeEndpoint(provider)
    }
  }

  async function addCustomProvider(config: {
    name: string
    displayName?: string
    baseUrl: string
    api: string
    apiKey?: string
    modelId?: string
    modelName?: string
  }) {
    if (isTauri()) {
      await tauriInvoke('add_custom_provider', {
        name: config.name,
        display_name: config.displayName,
        base_url: config.baseUrl,
        api: config.api,
        api_key: config.apiKey,
        model_id: config.modelId,
        model_name: config.modelName,
      })
    } else {
      const models = config.modelId
        ? [{ id: config.modelId, name: config.modelName }]
        : []
      await api.addCustomProvider({
        name: config.name,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        api: config.api,
        apiKey: config.apiKey,
        models,
      })
    }
    await fetchProviders()
    await fetchModels(false)
  }

  async function addCustomModel(config: {
    provider: string
    baseUrl?: string
    api?: string
    modelId: string
    modelName?: string
    contextWindow?: number
  }) {
    if (isTauri()) {
      await tauriInvoke('add_custom_model', {
        provider: config.provider,
        base_url: config.baseUrl,
        api: config.api,
        model_id: config.modelId,
        model_name: config.modelName,
        context_window: config.contextWindow,
      })
    } else {
      await api.addCustomModel({
        provider: config.provider,
        baseUrl: config.baseUrl,
        api: config.api,
        models: [{ id: config.modelId, name: config.modelName, contextWindow: config.contextWindow }],
      })
    }
    await fetchProviders()
    await fetchModels(false)
  }

  async function removeCustomModel(provider: string, modelId: string) {
    if (isTauri()) {
      await tauriInvoke('remove_custom_model', { provider, model_id: modelId })
    } else {
      await api.removeCustomModel(provider, modelId)
    }
    await fetchProviders()
    await fetchModels(false)
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
    getEndpoint,
    setEndpoint,
    removeEndpoint,
    addCustomProvider,
    addCustomModel,
    removeCustomModel,
  }
})