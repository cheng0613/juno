const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  getProviders: () => request<any[]>('/providers'),
  getProviderStatus: (name: string) => request<any>(`/providers/${name}/status`),
  setApiKey: (name: string, key: string, env?: Record<string, string>) =>
    request(`/providers/${name}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ key, env }),
    }),
  removeApiKey: (name: string) =>
    request(`/providers/${name}/credentials`, { method: 'DELETE' }),
  testConnection: (name: string) =>
    request<any>(`/providers/${name}/test`, { method: 'POST' }),

  getEndpoint: (name: string) =>
    request<any>(`/providers/${name}/endpoint`),
  setEndpoint: (name: string, config: { baseUrl?: string; api?: string; headers?: Record<string, string> }) =>
    request(`/providers/${name}/endpoint`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  removeEndpoint: (name: string) =>
    request(`/providers/${name}/endpoint`, { method: 'DELETE' }),

  addCustomProvider: (config: {
    name: string
    displayName?: string
    baseUrl: string
    api: string
    apiKey?: string
    models?: { id: string; name?: string; contextWindow?: number; maxTokens?: number }[]
  }) =>
    request('/providers/custom', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getModels: (availableOnly = true) =>
    request<any[]>(`/models${availableOnly ? '' : '/all'}`),
  addCustomModel: (config: any) =>
    request('/models/custom', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  removeCustomModel: (provider: string, modelId: string) =>
    request(`/models/custom/${provider}/${modelId}`, { method: 'DELETE' }),

  getSettings: () => request<any>('/settings'),
  setDefaultModel: (provider: string, modelId: string, thinkingLevel?: string) =>
    request('/settings/default-model', {
      method: 'PUT',
      body: JSON.stringify({ provider, modelId, thinkingLevel }),
    }),
  setEnabledModels: (patterns: string[]) =>
    request('/settings/enabled-models', {
      method: 'PUT',
      body: JSON.stringify({ patterns }),
    }),
}