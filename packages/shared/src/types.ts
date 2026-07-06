export interface ProviderInfo {
  name: string
  displayName: string
  authStatus: 'configured' | 'not_configured' | 'oauth'
  credentialType?: 'api_key' | 'oauth'
  modelCount: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  api: string
  baseUrl: string
  reasoning: boolean
  contextWindow: number
  maxTokens: number
  input: string[]
  cost: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
  }
  isCustom?: boolean
  isDefault?: boolean
}

export interface AuthStatus {
  provider: string
  configured: boolean
  type?: 'api_key' | 'oauth'
  hasKey: boolean
  hasEnvVar: boolean
}

export interface SetApiKeyRequest {
  key: string
  env?: Record<string, string>
}

export interface CustomModelRequest {
  provider: string
  providerName?: string
  baseUrl?: string
  api?: string
  models: {
    id: string
    name?: string
    reasoning?: boolean
    contextWindow?: number
    maxTokens?: number
    input?: string[]
    cost?: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
    }
  }[]
}

export interface CustomProviderRequest {
  name: string
  displayName?: string
  baseUrl: string
  api: string
  apiKey?: string
  models?: CustomModelRequest['models']
}

export interface PiSettings {
  defaultProvider?: string
  defaultModel?: string
  defaultThinkingLevel?: ThinkingLevel
  enabledModels?: string[]
  autoCompaction?: boolean
  autoRetry?: boolean
  steeringMode?: 'all' | 'one-at-a-time'
  followUpMode?: 'all' | 'one-at-a-time'
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export interface WsCommand {
  id?: string
  type: 'prompt' | 'abort' | 'steer' | 'follow_up' | 'new_session' | 'get_state' | 'get_messages' | 'set_model' | 'set_thinking_level' | 'extension_ui_response' | 'bash'
  message?: string
  images?: ImageContent[]
  streamingBehavior?: 'steer' | 'followUp'
  provider?: string
  modelId?: string
  level?: ThinkingLevel
  id?: string
  value?: string
  confirmed?: boolean
  cancelled?: boolean
  command?: string
}

export interface ImageContent {
  type: 'image'
  data: string
  mimeType: string
}

export interface WsEvent {
  type: string
  [key: string]: unknown
}

export interface MessageUpdateEvent extends WsEvent {
  type: 'message_update'
  message: unknown
  assistantMessageEvent: {
    type: 'text_delta' | 'text_start' | 'text_end' | 'thinking_delta' | 'thinking_start' | 'thinking_end' | 'toolcall_start' | 'toolcall_delta' | 'toolcall_end' | 'start' | 'done' | 'error'
    contentIndex?: number
    delta?: string
    content?: string
    partial?: unknown
  }
}

export interface ToolExecutionEvent extends WsEvent {
  type: 'tool_execution_start' | 'tool_execution_update' | 'tool_execution_end'
  toolCallId: string
  toolName: string
  args?: Record<string, unknown>
  partialResult?: {
    content: { type: string; text: string }[]
    details?: Record<string, unknown>
  }
  result?: {
    content: { type: string; text: string }[]
    details?: Record<string, unknown>
  }
  isError?: boolean
}

export interface AgentLifecycleEvent extends WsEvent {
  type: 'agent_start' | 'agent_end' | 'turn_start' | 'turn_end'
  messages?: unknown[]
  message?: unknown
  toolResults?: unknown[]
}

export interface ExtensionUIRequest {
  type: 'extension_ui_request'
  id: string
  method: 'select' | 'confirm' | 'input' | 'editor' | 'notify' | 'setStatus' | 'setWidget' | 'setTitle' | 'set_editor_text'
  title?: string
  message?: string
  options?: string[]
  placeholder?: string
  prefill?: string
  timeout?: number
  statusKey?: string
  statusText?: string
  widgetKey?: string
  widgetLines?: string[]
  widgetPlacement?: string
  text?: string
  notifyType?: 'info' | 'warning' | 'error'
}

export interface ExtensionUIResponse {
  type: 'extension_ui_response'
  id: string
  value?: string
  confirmed?: boolean
  cancelled?: boolean
}

export interface SessionState {
  model: Record<string, unknown> | null
  thinkingLevel: string
  isStreaming: boolean
  isCompacting: boolean
  sessionId: string
  sessionName?: string
  messageCount: number
  pendingMessageCount: number
  steeringMode: string
  followUpMode: string
  autoCompactionEnabled: boolean
}

export interface ProviderTestResult {
  success: boolean
  latencyMs?: number
  modelCount?: number
  error?: string
}