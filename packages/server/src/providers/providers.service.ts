import { Injectable } from '@nestjs/common'
import { ModelRegistry, AuthStorage } from '@earendil-works/pi-coding-agent'
import { PiService } from '../pi/pi.service.js'

@Injectable()
export class ProvidersService {
  constructor(private readonly piService: PiService) {}

  get auth(): AuthStorage { return this.piService.auth }
  get registry(): ModelRegistry { return this.piService.registry }

  private async getModelsJsonPath() {
    const os = await import('os')
    const path = await import('path')
    return path.join(os.homedir(), '.pi', 'agent', 'models.json')
  }

  private async readModelsJson(): Promise<any> {
    const fs = await import('fs/promises')
    try {
      const raw = await fs.readFile(await this.getModelsJsonPath(), 'utf-8')
      return JSON.parse(raw)
    } catch {
      return { providers: {} }
    }
  }

  private async writeModelsJson(data: any) {
    const fs = await import('fs/promises')
    await fs.writeFile(await this.getModelsJsonPath(), JSON.stringify(data, null, 2))
  }

  async getProviders() {
    return this.piService.getProviders()
  }

  async getModels(availableOnly = false) {
    return this.piService.getModels(availableOnly)
  }

  async setApiKey(provider: string, key: string, env?: Record<string, string>) {
    await this.piService.setApiKey(provider, key, env)
  }

  async removeApiKey(provider: string) {
    await this.piService.removeApiKey(provider)
  }

  async getAuthStatus(provider: string) {
    return this.piService.getAuthStatus(provider)
  }

  async testConnection(provider: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    try {
      const key = await this.auth.getApiKey(provider)
      if (!key) {
        return { success: false, error: 'No API key configured' }
      }
      const start = Date.now()
      const models = await this.registry.getAvailable()
      const providerModels = models.filter((m) => m.provider === provider)
      const latencyMs = Date.now() - start
      return {
        success: providerModels.length > 0,
        latencyMs,
        error: providerModels.length === 0 ? 'No models available for this provider' : undefined,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getEndpoint(provider: string) {
    const data = await this.readModelsJson()
    const providerConfig = data.providers?.[provider]
    if (!providerConfig) return null
    return {
      baseUrl: providerConfig.baseUrl,
      api: providerConfig.api,
      headers: providerConfig.headers,
    }
  }

  async setEndpoint(provider: string, config: { baseUrl?: string; api?: string; headers?: Record<string, string> }) {
    const data = await this.readModelsJson()
    if (!data.providers[provider]) {
      data.providers[provider] = { models: [] }
    }
    if (config.baseUrl !== undefined) data.providers[provider].baseUrl = config.baseUrl
    if (config.api !== undefined) data.providers[provider].api = config.api
    if (config.headers !== undefined) data.providers[provider].headers = config.headers
    await this.writeModelsJson(data)
    await this.registry.refresh()
  }

  async removeEndpoint(provider: string) {
    const data = await this.readModelsJson()
    if (data.providers[provider]) {
      delete data.providers[provider].baseUrl
      delete data.providers[provider].api
      delete data.providers[provider].headers
    }
    await this.writeModelsJson(data)
    await this.registry.refresh()
  }

  async addCustomProvider(body: {
    name: string
    displayName?: string
    baseUrl: string
    api: string
    apiKey?: string
    models?: { id: string; name?: string; contextWindow?: number; maxTokens?: number }[]
  }) {
    const data = await this.readModelsJson()

    data.providers[body.name] = {
      name: body.displayName || body.name,
      baseUrl: body.baseUrl,
      api: body.api,
      models: body.models?.length ? body.models : [],
    }

    await this.writeModelsJson(data)

    if (body.apiKey) {
      this.auth.set(body.name, { type: 'api_key', key: body.apiKey })
    }

    await this.registry.refresh()
  }

  async addCustomModel(config: any) {
    const data = await this.readModelsJson()

    if (!data.providers[config.provider]) {
      data.providers[config.provider] = {
        baseUrl: config.baseUrl,
        api: config.api,
        models: [],
      }
    }

    const provider = data.providers[config.provider]
    if (config.baseUrl) provider.baseUrl = config.baseUrl
    if (config.api) provider.api = config.api

    if (config.models) {
      provider.models = [
        ...(provider.models || []),
        ...config.models,
      ]
    }

    await this.writeModelsJson(data)
    await this.registry.refresh()
  }

  async removeCustomModel(provider: string, modelId: string) {
    const data = await this.readModelsJson()
    if (data.providers?.[provider]?.models) {
      data.providers[provider].models = data.providers[provider].models.filter(
        (m: any) => m.id !== modelId,
      )
      await this.writeModelsJson(data)
      await this.registry.refresh()
    }
  }
}