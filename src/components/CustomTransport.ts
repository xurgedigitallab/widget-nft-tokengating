// src/components/CustomTransport.ts
import { ITransport, IWidgetApiRequestData, IWidgetApiResponse, IWidgetApiResponseData, IWidgetApiAcknowledgeResponseData } from 'matrix-widget-api'
import { EventEmitter } from 'events'

interface PendingRequest {
  resolve: (response: any) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

export class CustomTransport extends EventEmitter implements ITransport {
  private readonly pendingRequests: Map<string, PendingRequest> = new Map()
  private readonly baseTransport: ITransport
  public readonly timeoutSeconds: number
  public readonly widgetId: string
  public readonly strictOriginCheck: boolean
  public readonly targetOrigin: string
  public ready: boolean = false
  private messageHandler: ((event: MessageEvent) => void) | null = null

  constructor(
    baseTransport: ITransport,
    widgetId: string,
    strictOriginCheck: boolean,
    allowedOrigin: string,
    timeoutSeconds: number = 60
  ) {
    super()
    this.baseTransport = baseTransport
    this.widgetId = widgetId
    this.strictOriginCheck = strictOriginCheck
    this.targetOrigin = allowedOrigin
    this.timeoutSeconds = timeoutSeconds
    this.setupMessageHandler()
  }

  private setupMessageHandler() {
    this.messageHandler = (event: MessageEvent) => {
      if (this.strictOriginCheck && event.origin !== this.targetOrigin) {
        console.warn(`Received message from unexpected origin: ${event.origin}, expected: ${this.targetOrigin}`)
        return
      }

      console.log('Received message:', event.data)

      try {
        const data = event.data
        if (!data || typeof data !== 'object') return

        if (data.api === 'fromWidget' || data.api === 'toWidget') {
          if (data.widgetId === this.widgetId) {
            if (data.action === 'capabilities') {
              // Handle capability request
              this.emit('capabilities', data)
            } else {
              const request = this.pendingRequests.get(data.requestId)
              if (request) {
                clearTimeout(request.timeoutId)
                this.pendingRequests.delete(data.requestId)
                if (data.error) {
                  request.reject(new Error(data.error.message || 'Unknown error'))
                } else {
                  request.resolve(data.response || data)
                }
              }
            }
            this.emit('message', data)
          }
        }
      } catch (error) {
        console.error('Error handling message:', error)
      }
    }

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
    }

    window.addEventListener('message', this.messageHandler)
  }

  private getExponentialTimeout(): number {
    const baseTimeout = 5000
    const maxTimeout = this.timeoutSeconds * 1000
    const timeout = Math.min(baseTimeout * Math.pow(2, this.pendingRequests.size), maxTimeout)
    console.log(`Current timeout for request: ${timeout}ms`)
    return timeout
  }

  async send<T extends IWidgetApiRequestData, R extends IWidgetApiResponseData = IWidgetApiAcknowledgeResponseData>(action: string, data: T): Promise<R> {
    console.log(`Sending request for action: ${action}`, data)
    try {
      return await new Promise<R>((resolve, reject) => {
        const requestId = `widgetapi-${Date.now()}-${Math.random()}`
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request timed out for action: ${action}`))
        }, this.getExponentialTimeout())

        this.pendingRequests.set(requestId, { resolve, reject, timeoutId })

        const message = {
          api: 'fromWidget',
          widgetId: this.widgetId,
          requestId,
          action,
          data
        }

        window.parent.postMessage(message, this.targetOrigin)
      })
    } catch (error) {
      console.error(`Transport send error for action ${action}:`, error)
      throw error
    }
  }

  private async waitForReady(maxAttempts: number = 30, interval: number = 1000): Promise<void> {
    let attempts = 0
    while (!this.ready && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval))
      this.ready = window.parent !== window
      attempts++
      console.log(`Wait attempt ${attempts}/${maxAttempts}, ready: ${this.ready}`)
    }

    if (!this.ready) {
      throw new Error('Transport failed to initialize after maximum attempts')
    }
  }

  start(): void {
    console.log('Starting transport')
    this.baseTransport.start()
    this.ready = true
    this.emit('ready')
    // Notify the parent window that the widget is ready
    window.parent.postMessage({ api: 'fromWidget', widgetId: this.widgetId, action: 'widgetReady' }, this.targetOrigin)
  }

  stop(): void {
    console.log('Stopping transport')
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
    this.baseTransport.stop()
    this.ready = false
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeoutId)
    }
    this.pendingRequests.clear()
  }

  reply(request: any, response: any): void {
    this.baseTransport.reply(request, response)
  }

  sendComplete<T extends IWidgetApiRequestData, R extends IWidgetApiResponse>(action: string, data: T): Promise<R> {
    return this.baseTransport.sendComplete(action, data) as Promise<R>
  }

  // Implement additional methods from EventEmitter
  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.addListener(event, listener)
  }

  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener)
  }

  setMaxListeners(n: number): this {
    return super.setMaxListeners(n)
  }

  getMaxListeners(): number {
    return super.getMaxListeners()
  }

  listeners(event: string | symbol): Function[] {
    return super.listeners(event)
  }

  rawListeners(event: string | symbol): Function[] {
    return super.rawListeners(event)
  }

  listenerCount(event: string | symbol): number {
    return super.listenerCount(event)
  }

  prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependListener(event, listener)
  }

  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependOnceListener(event, listener)
  }

  eventNames(): (string | symbol)[] {
    return super.eventNames()
  }
}