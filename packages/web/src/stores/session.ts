import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createSocket, getSocket } from '@/api/socket'
import { api } from '@/api/httpClient'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

function getTauri() {
  return (window as any).__TAURI__
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = getTauri()
  if (tauri?.core) {
    return tauri.core.invoke(cmd, args)
  }
  throw new Error('Not in Tauri environment')
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  thinking?: string
  toolCalls?: ToolCallInfo[]
  isStreaming?: boolean
}

export interface ToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  isRunning?: boolean
  isError?: boolean
}

export const useSessionStore = defineStore('session', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const isConnected = ref(false)
  const sessionId = ref('')
  const currentModel = ref<string>('')
  const currentThinkingLevel = ref<string>('medium')
  const error = ref<string | null>(null)

  const lastMessage = computed(() => messages.value[messages.value.length - 1])

  function connect() {
    if (isTauri()) {
      const tauri = getTauri()
      if (tauri?.event) {
        tauri.event.listen('pi-event', (event: any) => {
          handleEvent(event.payload)
        })
        tauri.event.listen('pi-extension-ui', (event: any) => {
          handleEvent(event.payload)
        })
        // Verify pi process is alive
        tauriInvoke<any>('get_pi_state')
          .then((state) => {
            isConnected.value = true
            isStreaming.value = state.is_streaming || false
            sessionId.value = state.session_id || ''
          })
          .catch((err) => {
            console.error('[Tauri] pi process not responding:', err)
            isConnected.value = false
            error.value = 'Failed to connect to pi agent'
          })
      }
      return
    }

    const socket = createSocket()
    isConnected.value = true

    socket.on('event', (event: any) => {
      handleEvent(event)
    })

    socket.on('response', (resp: any) => {
      console.log('[WS response]', resp)
    })

    socket.on('error', (err: any) => {
      error.value = err.message
    })
  }

  function handleEvent(event: any) {
    switch (event.type) {
      case 'agent_start':
        isStreaming.value = true
        error.value = null
        break

      case 'agent_end':
        isStreaming.value = false
        break

      case 'turn_start':
        break

      case 'turn_end':
        break

      case 'message_start': {
        if (event.message?.role === 'user') break
        const msg: ChatMessage = {
          id: event.message?.id || crypto.randomUUID(),
          role: event.message?.role === 'user' ? 'user' : 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        }
        messages.value.push(msg)
        break
      }

      case 'message_update': {
        const delta = event.assistantMessageEvent
        if (!delta) break

        const last = lastMessage.value
        if (!last || !last.isStreaming) {
          const msg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          }
          messages.value.push(msg)
        }

        const target = lastMessage.value
        if (!target) break

        if (delta.type === 'text_delta' && delta.delta) {
          target.content += delta.delta
        } else if (delta.type === 'thinking_delta' && delta.delta) {
          target.thinking = (target.thinking || '') + delta.delta
        } else if (delta.type === 'text_end' && delta.content) {
          target.content = delta.content
        } else if (delta.type === 'thinking_end' && delta.content) {
          target.thinking = delta.content
        } else if (delta.type === 'toolcall_start') {
          if (!target.toolCalls) target.toolCalls = []
          const tc: ToolCallInfo = {
            id: delta.partial?.id || crypto.randomUUID(),
            name: delta.partial?.name || '',
            args: {},
            isRunning: true,
          }
          target.toolCalls.push(tc)
        } else if (delta.type === 'toolcall_delta' && delta.delta) {
          const lastTc = target.toolCalls?.[target.toolCalls.length - 1]
          if (lastTc) {
            try {
              lastTc.args = JSON.parse(delta.delta)
            } catch {
              lastTc.args = { partial: delta.delta }
            }
          }
        } else if (delta.type === 'toolcall_end') {
          const lastTc = target.toolCalls?.[target.toolCalls.length - 1]
          if (lastTc && delta.partial) {
            lastTc.id = delta.partial.id || lastTc.id
            lastTc.name = delta.partial.name || lastTc.name
            try {
              lastTc.args = JSON.parse(delta.partial.arguments || '{}')
            } catch {}
          }
        } else if (delta.type === 'done') {
          target.isStreaming = false
          if (event.message?.role) {
            target.role = event.message.role
          }
        } else if (delta.type === 'error') {
          target.isStreaming = false
          error.value = 'Assistant error occurred'
        }
        break
      }

      case 'message_end': {
        const last = lastMessage.value
        if (last) {
          last.isStreaming = false
        }
        break
      }

      case 'tool_execution_start': {
        const last = lastMessage.value
        if (last) {
          if (!last.toolCalls) last.toolCalls = []
          const existing = last.toolCalls.find((tc) => tc.id === event.toolCallId)
          if (!existing) {
            last.toolCalls.push({
              id: event.toolCallId,
              name: event.toolName,
              args: event.args || {},
              isRunning: true,
            })
          } else {
            existing.isRunning = true
          }
        }
        break
      }

      case 'tool_execution_update': {
        const last = lastMessage.value
        if (last?.toolCalls) {
          const tc = last.toolCalls.find((t) => t.id === event.toolCallId)
          if (tc && event.partialResult?.content) {
            tc.result = event.partialResult.content.map((c: any) => c.text).join('')
          }
        }
        break
      }

      case 'tool_execution_end': {
        const last = lastMessage.value
        if (last?.toolCalls) {
          const tc = last.toolCalls.find((t) => t.id === event.toolCallId)
          if (tc) {
            tc.isRunning = false
            tc.isError = event.isError
            if (event.result?.content) {
              tc.result = event.result.content.map((c: any) => c.text).join('')
            }
          }
        }
        break
      }

      case 'compaction_start':
      case 'compaction_end':
      case 'queue_update':
      case 'auto_retry_start':
      case 'auto_retry_end':
        break
    }
  }

  function sendPrompt(message: string, images?: { data: string; mimeType: string }[]) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message + (images?.length ? ` (${images.length} image(s))` : ''),
      timestamp: Date.now(),
    }
    messages.value.push(msg)

    if (isTauri()) {
      tauriInvoke('send_prompt', { message, images }).catch((err) => {
        console.error('[Tauri] send_prompt error:', err)
        error.value = err
      })
      return
    }

    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('prompt', { message, images })
    }
  }

  function abort() {
    if (isTauri()) {
      tauriInvoke('send_abort').catch(console.error)
      isStreaming.value = false
      return
    }
    const socket = getSocket()
    socket?.emit('abort')
    isStreaming.value = false
  }

  function setModel(provider: string, modelId: string) {
    if (isTauri()) {
      tauriInvoke('set_model', { provider, modelId }).catch(console.error)
      return
    }
    const socket = getSocket()
    socket?.emit('set_model', { provider, modelId })
  }

  function setThinkingLevel(level: string) {
    currentThinkingLevel.value = level
    if (isTauri()) {
      tauriInvoke('set_thinking_level', { level }).catch(console.error)
      return
    }
    const socket = getSocket()
    socket?.emit('set_thinking_level', { level })
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    isStreaming,
    isConnected,
    sessionId,
    currentModel,
    currentThinkingLevel,
    error,
    lastMessage,
    connect,
    sendPrompt,
    abort,
    setModel,
    setThinkingLevel,
    clearMessages,
  }
})