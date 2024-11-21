// src/App.tsx
import { useState, useEffect } from 'react';
import { WidgetApi, MatrixCapabilities, ITransport, IWidgetApiRequestData, IWidgetApiResponseData, IWidgetApiAcknowledgeResponseData, IWidgetApiRequest, IWidgetApiResponse } from 'matrix-widget-api';
import * as sdk from "matrix-js-sdk";

class CustomTransport implements ITransport {
  private timeoutMs = 60000; // 60 second timeout
  public ready = false;
  private messageQueue: Array<{ action: string; data: any }> = [];

  constructor(
    private baseTransport: ITransport,
    public readonly widgetId: string,
    public readonly strictOriginCheck: boolean,
    public readonly targetOrigin: string,
    public timeoutSeconds: number
  ) {
    this.setupMessageHandler();
  }

  private setupMessageHandler() {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.targetOrigin) {
        console.warn(`Received message from unexpected origin: ${event.origin}`);
        return;
      }
      console.log('Received message:', event.data);
      if (event.data?.api === 'fromWidget') {
        this.emit('message', event.data);
      }
    });
  }

  async send<T extends IWidgetApiRequestData, R extends IWidgetApiResponseData = IWidgetApiAcknowledgeResponseData>(action: string, data: T): Promise<R> {
    if (!this.ready) {
      console.log('Waiting for transport to be ready...');
      await this.waitForReady();
    }
    
    try {
      console.log(`Sending to chat client: ${this.targetOrigin}`, action, data);
      return await Promise.race([
        this.baseTransport.send<T, R>(action, data),
        new Promise<R>((_, reject) => 
          setTimeout(() => reject(new Error(`Transport send timeout for action: ${action}`)), this.timeoutMs)
        )
      ]);
    } catch (error) {
      console.error('Transport send error:', error);
      throw error;
    }
  }

  reply<T extends IWidgetApiResponseData>(request: IWidgetApiRequest, responseData: T): void {
    try {
      console.log(`Replying to chat client: ${this.targetOrigin}`, request, responseData);
      this.baseTransport.reply(request, responseData);
    } catch (error) {
      console.error('Transport reply error:', error);
    }
  }

  private async waitForReady(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30;
    const interval = 1000;

    while (!this.ready && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
      this.ready = window.parent !== window;
      attempts++;
      console.log(`Wait attempt ${attempts}/${maxAttempts}, ready: ${this.ready}`);
    }

    if (!this.ready) {
      throw new Error('Transport failed to initialize after maximum attempts');
    }

    console.log('Transport is ready');
  }

  start(): void {
    console.log('Starting transport');
    this.baseTransport.start();
    
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg.action, msg.data).catch(console.error);
      }
    }
  }

  stop(): void {
    console.log('Stopping transport');
    this.baseTransport.stop();
  }

  async sendComplete<T extends IWidgetApiRequestData, R extends IWidgetApiResponse>(action: string, data: T): Promise<R> {
    console.log('Sending complete action:', action, 'with data:', data);
    return this.baseTransport.sendComplete(action, data);
  }

  // Implement remaining ITransport methods
  on<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.on(eventName, listener);
    return this;
  }

  once<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.once(eventName, listener);
    return this;
  }

  off<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.off(eventName, listener);
    return this;
  }

  removeAllListeners(eventName?: string | symbol): this {
    this.baseTransport.removeAllListeners(eventName);
    return this;
  }

  addListener<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.addListener(eventName, listener);
    return this;
  }

  removeListener<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.removeListener(eventName, listener);
    return this;
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.baseTransport.emit(eventName, ...args);
  }

  setMaxListeners(n: number): this {
    this.baseTransport.setMaxListeners(n);
    return this;
  }

  getMaxListeners(): number {
    return this.baseTransport.getMaxListeners();
  }

  listeners(eventName: string | symbol): Function[] {
    return this.baseTransport.listeners(eventName);
  }

  rawListeners(eventName: string | symbol): Function[] {
    return this.baseTransport.rawListeners(eventName);
  }

  listenerCount(eventName: string | symbol): number {
    return this.baseTransport.listenerCount(eventName);
  }

  prependListener<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.prependListener(eventName, listener);
    return this;
  }

  prependOnceListener<K extends keyof ITransport>(eventName: K, listener: (...args: any[]) => void): this {
    this.baseTransport.prependOnceListener(eventName, listener);
    return this;
  }

  eventNames(): (string | symbol)[] {
    return this.baseTransport.eventNames();
  }
}

export default function Component() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [widgetApi, setWidgetApi] = useState<WidgetApi | null>(null);

  const MATRIX_SERVER_URL = 'https://synapse.textrp.io';
  const CHAT_CLIENT_URL = 'https://app.textrp.io';

  const setupWidgetApi = async () => {
    try {
      setError(null);
      setIsVerifying(true);
      
      const urlParams = new URLSearchParams(window.location.search);
      const widgetId = urlParams.get('widgetId') || '';
      console.log('Setting up widget with ID:', widgetId);

      const api = new WidgetApi(widgetId, CHAT_CLIENT_URL);
      
      const customTransport = new CustomTransport(
        api.transport,
        widgetId,
        api.transport.strictOriginCheck,
        CHAT_CLIENT_URL,
        60
      );
      Object.defineProperty(api, 'transport', {
        value: customTransport,
        writable: false,
        configurable: true,
      });

      console.log('Starting WidgetApi registration...');
      await api.start();

      console.log('Requesting capabilities...');
      await api.requestCapabilities([
        MatrixCapabilities.RequiresClient,
        MatrixCapabilities.MSC2931Navigate,
        'org.matrix.msc3819.send_to_device',
        'm.room.power_levels',
        'm.room.name',
        'm.room.kick',
      ]);

      console.log('Requesting OpenID Connect token...');
      const response = await api.requestOpenIDConnectToken();
      if (!response?.access_token) {
        throw new Error('No access token received');
      }
      setAccessToken(response.access_token);

      setRoomId(decodeURIComponent(urlParams.get('roomId') || ''));
      setRoomName(decodeURIComponent(urlParams.get('roomName') || ''));
      setUserId(decodeURIComponent(urlParams.get('userId') || ''));
      setDisplayName(decodeURIComponent(urlParams.get('displayName') || ''));

      const client = sdk.createClient({
        baseUrl: MATRIX_SERVER_URL,
        accessToken: response.access_token,
        userId: decodeURIComponent(urlParams.get('userId') || ''),
      });

      await checkAdminStatus(decodeURIComponent(urlParams.get('roomId') || ''), client);
      setWidgetApi(api);
    } catch (error) {
      console.error('Widget API setup failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize widget');
      setIsAdmin(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const checkAdminStatus = async (roomId: string, client: sdk.MatrixClient) => {
    if (!roomId || !client) {
      setError('Missing room ID or Matrix client');
      return;
    }

    try {
      const powerLevels = await client.getStateEvent(roomId, 'm.room.power_levels', '');
      const userLevel = powerLevels.users?.[userId] || powerLevels.users_default || 0;
      const adminLevel = powerLevels.state_default || 50;

      setIsAdmin(userLevel >= adminLevel);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setError('Failed to check admin status');
    }
  };

  const performAdminAction = async (action: string, data: any) => {
    if (!widgetApi || !isAdmin || !accessToken) {
      setError('Not authorized to perform admin actions');
      return;
    }

    try {
      // Request a scoped token for the specific action
      const scopedToken = await widgetApi.requestOpenIDConnectToken();

      if (!scopedToken?.access_token) {
        throw new Error('Failed to obtain scoped token');
      }

      // Perform the admin action using the scoped token
      const client = sdk.createClient({
        baseUrl: MATRIX_SERVER_URL,
        accessToken: scopedToken.access_token,
        userId: userId,
      });

      switch (action) {
        case 'm.room.name':
          await client.setRoomName(roomId, data.name);
          break;
        case 'm.room.power_levels':
          await client.setPowerLevel(roomId, data.userId, data.powerLevel);
          break;
        case 'm.room.kick':
          await client.kick(roomId, data.userId, data.reason);
          break;
        default:
          throw new Error('Unsupported admin action');
      }

      console.log(`Admin action ${action} performed successfully`);
    } catch (error) {
      console.error('Error performing admin action:', error);
      setError('Failed to perform admin action');
    }
  };

  useEffect(() => {
    setupWidgetApi();
  }, []);

  return (
    <div className="min-h-screen bg-[#2d2d2d] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold">
          Welcome, {displayName || 'User'}!
        </h1>
        
        <div className="space-y-2">
          <p>
            <span className="font-bold">Room ID:</span> {roomId || 'Unknown'}
          </p>
          <p>
            <span className="font-bold">Room Name:</span> {roomName || 'Unknown'}
          </p>
        </div>

        <div className="space-y-4">
          {isVerifying ? (
            <p className="text-blue-400">
              Please verify your identity in the popup dialog...
            </p>
          ) : (
            <>
              <p className={isAdmin ? "text-green-500" : "text-red-500"}>
                {isAdmin 
                  ? "You have admin permissions in this room."
                  : "You do not have admin permissions in this room."}
              </p>

              {error && (
                <p className="text-red-500">
                  Error: {error}
                </p>
              )}

              {isAdmin && (
                <div className="space-y-2">
                  <button 
                    onClick={() => performAdminAction('m.room.name', { name: 'New Room Name' })}
                    className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    Change Room Name
                  </button>
                  <button 
                    onClick={() => performAdminAction('m.room.power_levels', { userId: '@someuser:example.com', powerLevel: 50 })}
                    className="w-full bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    Modify Power Levels
                  </button>
                  <button 
                    onClick={() => performAdminAction('m.room.kick', { userId: '@someuser:example.com', reason: 'Violation of rules' })}
                    className="w-full bg-[#F44336] hover:bg-[#E53935] text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    Kick Member
                  </button>
                </div>
              )}

              {!isAdmin && (
                <button 
                  onClick={setupWidgetApi}
                  className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 px-4 rounded transition-colors"
                >
                  Retry Authorization
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}