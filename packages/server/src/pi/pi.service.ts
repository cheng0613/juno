import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common'
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  SessionManager,
  createAgentSessionServices,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  type AgentSession,
  type AgentSessionEvent,
  getAgentDir,
} from '@earendil-works/pi-coding-agent'
import { Subject, Observable } from 'rxjs'

export interface PiSessionState {
  session: AgentSession
}

@Injectable()
export class PiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PiService.name)
  private readonly eventsSubject = new Subject<AgentSessionEvent>()
  private authStorage!: AuthStorage
  private modelRegistry!: ModelRegistry
  private settingsManager!: SettingsManager
  private runtime!: Awaited<ReturnType<typeof createAgentSessionRuntime>>
  private currentSession: PiSessionState | null = null
  private _ready = false
  private sessionUnsubscribe: (() => void) | null = null

  get ready() { return this._ready }
  get auth() { return this.authStorage }
  get registry() { return this.modelRegistry }
  get settings() { return this.settingsManager }
  get sessionState() { return this.currentSession }
  get events(): Observable<AgentSessionEvent> { return this.eventsSubject }

async onModuleInit() {
    this.logger.log('Initializing PiService...')

    // Set config directory to ~/.juno/agent/ instead of ~/.pi/agent/
    const os = await import('os')
    const path = await import('path')
    const junoDir = path.join(os.homedir(), '.juno', 'agent')
    process.env.PI_CODING_AGENT_DIR = junoDir

    this.authStorage = AuthStorage.create()
    this.modelRegistry = ModelRegistry.create(this.authStorage)
    this.settingsManager = SettingsManager.create(process.cwd())

    this.settingsManager.applyOverrides({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 3 },
    })

    await this.createNewSession()

    const available = await this.modelRegistry.getAvailable()
    this.logger.log(`Available models: ${available.length}`)

    if (available.length > 0 && this.currentSession) {
      const defaultProvider = this.settingsManager.getDefaultProvider()
      const defaultModel = this.settingsManager.getDefaultModel()
      const match = available.find(
        (m) => m.provider === defaultProvider && m.id === defaultModel,
      )
      const model = match || available[0]
      await this.currentSession.session.setModel(model)
      this.logger.log(`Model set: ${model.provider}/${model.id} (reasoning: ${model.reasoning}, ctx: ${model.contextWindow})`)
    } else {
      this.logger.warn('No available models found — LLM calls will fail')
    }

    this._ready = true
    this.logger.log('PiService ready')
  }

async onModuleDestroy() {
    this.sessionUnsubscribe?.()
    this.currentSession?.session.dispose()
    this.runtime?.session?.dispose()
  }

async createNewSession(): Promise<PiSessionState> {
    this.logger.log('Creating new session...')
    const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
      const services = await createAgentSessionServices({
        cwd,
        authStorage: this.authStorage,
        modelRegistry: this.modelRegistry,
        settingsManager: this.settingsManager,
      })
      return {
        ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
        services,
        diagnostics: services.diagnostics,
      }
    }

    this.runtime = await createAgentSessionRuntime(createRuntime, {
      cwd: process.cwd(),
      agentDir: getAgentDir(),
      sessionManager: SessionManager.create(process.cwd()),
    })

const session = this.runtime.session
    if (this.sessionUnsubscribe) this.sessionUnsubscribe()
    this.sessionUnsubscribe = session.subscribe((event) => this.eventsSubject.next(event))

this.currentSession = { session }
    this.logger.log(`Session created: id=${session.sessionId}`)
    const agentModel = (session as any).agent?.state?.model
    if (agentModel) {
      this.logger.log(`Session agent model after create: ${agentModel.provider}/${agentModel.id}`)
    } else {
      this.logger.warn('Session agent model is NULL after createNewSession')
    }

    return this.currentSession
  }

async prompt(message: string, images?: { type: 'image'; data: string; mimeType: string }[], streamingBehavior?: 'steer' | 'followUp') {
    if (!this.currentSession) throw new Error('No active session')

    const agent = (this.currentSession.session as any).agent
    if (agent?.state?.model) {
      const m = agent.state.model
      this.logger.log(`Session model: ${m.provider}/${m.id}`)
      const auth = await this.modelRegistry.getApiKeyAndHeaders(m)
      this.logger.log(`API key check: ${auth.ok ? 'OK' : 'MISSING: ' + (auth as any).error}`)
    } else {
      this.logger.warn('Session model is NULL — no LLM call will be made')
    }

    const isStreaming = this.currentSession.session.isStreaming
    this.logger.log(`prompt() called: msg="${message.slice(0, 80)}", streaming=${isStreaming}, behavior=${streamingBehavior || 'default'}`)
    try {
      await this.currentSession.session.prompt(message, {
        images,
        streamingBehavior,
      })
      const msgs = this.currentSession.session.messages
      this.logger.log(`Messages after prompt: ${msgs.length}`)
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1] as any
        const contentStr = typeof last.content === 'string'
          ? last.content.slice(0, 200)
          : JSON.stringify(last.content).slice(0, 200)
        this.logger.log(`Last msg role=${last.role} content="${contentStr}"`)
        if (last.stopReason) this.logger.log(`Stop reason: ${last.stopReason}`)
      }
      this.logger.log('prompt() completed')
    } catch (err: any) {
      this.logger.error(`prompt() error: ${err.message}`, err.stack)
      throw err
    }
  }

  async abort() {
    this.logger.log('abort() called')
    if (!this.currentSession) throw new Error('No active session')
    await this.currentSession.session.abort()
    this.logger.log('abort() completed')
  }

  async setModel(provider: string, modelId: string) {
    if (!this.currentSession) throw new Error('No active session')
    const model = this.modelRegistry.find(provider, modelId)
    if (!model) {
      this.logger.warn(`setModel: ${provider}/${modelId} — NOT FOUND`)
      throw new Error(`Model ${provider}/${modelId} not found`)
    }
    this.logger.log(`setModel: ${provider}/${modelId} → found`)
    await this.currentSession.session.setModel(model)
  }

  setThinkingLevel(level: string) {
    if (!this.currentSession) throw new Error('No active session')
    this.logger.log(`setThinkingLevel: ${level}`)
    this.currentSession.session.setThinkingLevel(level as any)
  }

  async getProviders() {
    const providersData = this.authStorage.getAll() || {}
    const allModels = this.modelRegistry.getAll()
    const availableModels = await this.modelRegistry.getAvailable()

    const providerMap = new Map<string, { name: string; models: any[]; availableModels: any[]; authStatus: string; credentialType?: string }>()

    for (const model of allModels) {
      const p = model.provider
      if (!providerMap.has(p)) {
        providerMap.set(p, { name: p, models: [], availableModels: [], authStatus: 'not_configured' })
      }
      providerMap.get(p)!.models.push(model)
    }

    for (const model of availableModels) {
      const p = model.provider
      if (providerMap.has(p)) {
        providerMap.get(p)!.availableModels.push(model)
      }
    }

    for (const [provider, info] of providerMap) {
      const cred = providersData[provider]
      if (cred) {
        info.authStatus = 'configured'
        info.credentialType = cred.type
      } else {
        const hasEnv = this.authStorage.hasAuth(provider)
        if (hasEnv) {
          info.authStatus = 'configured'
        }
      }
    }

    return Array.from(providerMap.entries()).map(([name, info]) => ({
      name,
      displayName: this.modelRegistry.getProviderDisplayName(name) || name,
      authStatus: info.authStatus,
      credentialType: info.credentialType,
      modelCount: info.models.length,
      availableModelCount: info.availableModels.length,
    }))
  }

  async getModels(availableOnly = false) {
    const models = availableOnly
      ? await this.modelRegistry.getAvailable()
      : this.modelRegistry.getAll()

    const defaultProvider = this.settingsManager.getDefaultProvider()
    const defaultModel = this.settingsManager.getDefaultModel()

    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      api: (m as any).api,
      baseUrl: (m as any).baseUrl,
      reasoning: m.reasoning,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      input: (m as any).input,
      cost: (m as any).cost,
      isDefault: m.provider === defaultProvider && m.id === defaultModel,
    }))
  }

  async setApiKey(provider: string, key: string, env?: Record<string, string>) {
    this.authStorage.set(provider, {
      type: 'api_key',
      key,
      env,
    })
    await this.modelRegistry.refresh()
  }

  async removeApiKey(provider: string) {
    this.authStorage.remove(provider)
    await this.modelRegistry.refresh()
  }

  async getAuthStatus(provider: string) {
    return {
      provider,
      configured: this.authStorage.hasAuth(provider),
      hasKey: this.authStorage.has(provider),
      hasEnvVar: this.authStorage.hasAuth(provider),
    }
  }

getEvents(): Observable<AgentSessionEvent> {
    return this.eventsSubject
  }
}
