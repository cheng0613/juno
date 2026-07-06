import { Logger } from '@nestjs/common'
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { PiService } from './pi.service.js'

interface ExtensionUIRequest {
  type: string
  id: string
  method: string
  title?: string
  message?: string
  options?: string[]
  placeholder?: string
  prefill?: string
  timeout?: number
  [key: string]: unknown
}

interface ExtensionUIResponse {
  type: string
  id: string
  value?: string
  confirmed?: boolean
  cancelled?: boolean
}

interface PendingUIRequest {
  id: string
  resolve: (value: any) => void
  timer?: NodeJS.Timeout
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  },
})
export class PiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(PiGateway.name)
  private clients = new Map<string, Socket>()
  private pendingUIRequests = new Map<string, PendingUIRequest>()
  private eventsSubscribed = false

  constructor(private readonly piService: PiService) {}

  afterInit() {
    this.logger.log('Gateway initialized')
    this.ensureEventSubscription()
  }

  private ensureEventSubscription() {
    if (this.eventsSubscribed) return
    const events = this.piService.getEvents()
    if (!events) {
      this.logger.warn('Events not available yet, will retry on client connect')
      return
    }
    this.eventsSubscribed = true
    this.logger.log('Events subscription attached')
    events.subscribe((event) => {
      this.logger.log(`Event received: ${event.type}`)
      this.broadcast(event as any)

      const extEvent = event as unknown as ExtensionUIRequest
      if (extEvent.type === 'extension_ui_request') {
        this.logger.log(`Extension UI request: ${extEvent.method}`)
        this.broadcast({
          type: 'extension_ui_request',
          id: extEvent.id,
          method: extEvent.method,
          title: extEvent.title,
          message: extEvent.message,
          options: extEvent.options,
          placeholder: extEvent.placeholder,
          prefill: extEvent.prefill,
          timeout: extEvent.timeout,
          notifyType: extEvent.notifyType,
          statusKey: extEvent.statusKey,
          statusText: extEvent.statusText,
          widgetKey: extEvent.widgetKey,
          widgetLines: extEvent.widgetLines,
          widgetPlacement: extEvent.widgetPlacement,
          text: extEvent.text,
        })
      }
    })
  }

  handleConnection(client: Socket) {
    this.clients.set(client.id, client)
    this.logger.log(`Client connected: ${client.id} (total: ${this.clients.size})`)
    this.ensureEventSubscription()
    this.sendState(client)
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id)
    this.logger.log(`Client disconnected: ${client.id} (total: ${this.clients.size})`)
  }

  private sendState(client: Socket) {
    client.emit('state', {
      ready: this.piService.ready,
    })
  }

  private broadcast(event: any) {
    for (const client of this.clients.values()) {
      client.emit('event', event)
    }
  }

  @SubscribeMessage('prompt')
  async handlePrompt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message?: string; images?: any[]; streamingBehavior?: 'steer' | 'followUp' },
  ) {
    this.logger.log(`[WS] prompt received: "${data.message?.slice(0, 60)}" ready=${this.piService.ready}`)
    try {
      if (!this.piService.ready) {
        this.logger.warn('Service not ready, rejecting prompt')
        client.emit('error', { message: 'Service not ready' })
        return
      }
      if (data.message) {
        await this.piService.prompt(data.message, data.images, data.streamingBehavior)
        this.logger.log('[WS] prompt completed successfully')
      }
    } catch (err: any) {
      this.logger.error(`[WS] prompt error: ${err.message}`)
      client.emit('error', { message: err.message })
    }
  }

  @SubscribeMessage('abort')
  async handleAbort(@ConnectedSocket() client: Socket) {
    try {
      await this.piService.abort()
    } catch (err: any) {
      client.emit('error', { message: err.message })
    }
  }

  @SubscribeMessage('set_model')
  async handleSetModel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { provider: string; modelId: string },
  ) {
    this.logger.log(`[WS] set_model: ${data.provider}/${data.modelId}`)
    try {
      await this.piService.setModel(data.provider, data.modelId)
      client.emit('response', { command: 'set_model', success: true })
    } catch (err: any) {
      client.emit('response', { command: 'set_model', success: false, error: err.message })
    }
  }

  @SubscribeMessage('set_thinking_level')
  async handleSetThinkingLevel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { level: string },
  ) {
    try {
      this.piService.setThinkingLevel(data.level)
      client.emit('response', { command: 'set_thinking_level', success: true })
    } catch (err: any) {
      client.emit('response', { command: 'set_thinking_level', success: false, error: err.message })
    }
  }

  @SubscribeMessage('new_session')
  async handleNewSession(@ConnectedSocket() client: Socket) {
    this.logger.log('[WS] new_session')
    try {
      await this.piService.createNewSession()
      this.ensureEventSubscription()
      client.emit('response', { command: 'new_session', success: true })
    } catch (err: any) {
      client.emit('response', { command: 'new_session', success: false, error: err.message })
    }
  }

  @SubscribeMessage('extension_ui_response')
  async handleExtensionUIResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ExtensionUIResponse,
  ) {
    const pending = this.pendingUIRequests.get(data.id)
    if (pending) {
      clearTimeout(pending.timer)
      pending.resolve(data)
      this.pendingUIRequests.delete(data.id)
    }
  }
}