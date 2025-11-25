/**
 * PostgreSQL WebSocket Client
 * WebSocket client สำหรับ real-time updates จาก backend
 */

// ✅ Derive WebSocket URL from API URL
const getWebSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  // Convert http:// to ws:// and https:// to wss://
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }
  // Fallback to explicit WS URL or default
  return import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
};

const WS_URL = getWebSocketUrl();

export type WebSocketEventType =
  | 'presence:join'
  | 'presence:leave'
  | 'presence:update'
  | 'bingo:card:update'
  | 'bingo:game:state'
  | 'user:subscribe'
  | 'checkin:subscribe'
  | 'game:subscribe'
  | 'answer:subscribe'
  | 'presence:updated'
  | 'bingo:card:updated'
  | 'bingo:game:state:updated'
  | 'user:updated'
  | 'checkin:updated'
  | 'game:updated'
  | 'answer:updated';

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: any;
  success?: boolean;
  error?: string;
}

export type WebSocketCallback = (data: any) => void;

class PostgreSQLWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<WebSocketEventType, Set<WebSocketCallback>> = new Map();
  private isConnecting = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true; // Flag to control reconnection
  private messageQueue: WebSocketMessage[] = []; // Queue for messages sent before connection

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    // ✅ Don't reconnect if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('WebSocket: Max reconnection attempts reached, not connecting');
      return;
    }

    this.isConnecting = true;

    try {
      console.log(`[WebSocket] Connecting to ${WS_URL}...`);
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to', WS_URL);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // ✅ Send queued messages when connected
        if (this.messageQueue.length > 0) {
          console.log(`[WebSocket] Sending ${this.messageQueue.length} queued message(s)`);
          this.messageQueue.forEach((message) => {
            this.send(message);
          });
          this.messageQueue = [];
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        console.error('[WebSocket] URL:', WS_URL);
        this.isConnecting = false;
        // Don't reconnect immediately on error - let onclose handle it
      };

      this.ws.onclose = (event) => {
        const reason = event.code === 1000 ? 'Normal closure' : `Code ${event.code}`;
        const wasClean = event.wasClean;
        console.log(`❌ WebSocket disconnected: ${reason} (clean: ${wasClean})`);
        console.log(`[WebSocket] URL: ${WS_URL}`);
        this.isConnecting = false;
        this.ws = null;
        
        // ✅ Only reconnect if:
        // 1. Not a normal closure (code 1000)
        // 2. Should reconnect flag is true
        // 3. Not max attempts reached
        if (!wasClean && event.code !== 1000 && this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[WebSocket] Max reconnection attempts reached, giving up');
          console.error('[WebSocket] Please check if backend server is running at:', WS_URL);
        } else if (wasClean || event.code === 1000) {
          console.log('[WebSocket] Normal closure, not reconnecting');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Error creating WebSocket connection:', error);
      console.error('[WebSocket] URL:', WS_URL);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    // ✅ Clear any existing reconnect timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached, not reconnecting');
      return;
    }

    if (!this.shouldReconnect) {
      console.log('[WebSocket] Reconnection disabled, not reconnecting');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      // ✅ Double-check before connecting
      if (this.shouldReconnect && this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
      }
    }, delay);
  }

  private handleMessage(message: WebSocketMessage) {
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(message.payload);
        } catch (error) {
          console.error('Error in WebSocket callback:', error);
        }
      });
    }
  }

  private send(message: WebSocketMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // ✅ Queue message if not connected (will be sent when connected)
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.messageQueue.push(message);
        return;
      }
      // ✅ If not connecting, log warning (may be disconnected)
      console.warn('[WebSocket] Not connected, message queued:', message.type);
      this.messageQueue.push(message);
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  // ==================== Presence ====================

  joinPresence(
    gameId: string,
    roomId: string,
    userId: string,
    username: string
  ) {
    this.send({
      type: 'presence:join',
      payload: { gameId, roomId, userId, username },
    });
  }

  leavePresence(gameId: string, roomId: string, userId: string) {
    this.send({
      type: 'presence:leave',
      payload: { gameId, roomId, userId },
    });
  }

  updatePresence(
    gameId: string,
    roomId: string,
    userId: string,
    status: 'online' | 'away' | 'offline'
  ) {
    this.send({
      type: 'presence:update',
      payload: { gameId, roomId, userId, status },
    });
  }

  onPresenceUpdated(callback: WebSocketCallback) {
    this.addEventListener('presence:updated', callback);
  }

  // ==================== Bingo ====================

  updateBingoCard(
    gameId: string,
    userId: string,
    cardId: string,
    checkedNumbers: boolean[][]
  ) {
    this.send({
      type: 'bingo:card:update',
      payload: { gameId, userId, cardId, checkedNumbers },
    });
  }

  onBingoCardUpdated(callback: WebSocketCallback) {
    this.addEventListener('bingo:card:updated', callback);
  }

  getBingoGameState(gameId: string) {
    this.send({
      type: 'bingo:game:state',
      payload: { gameId, action: 'get' },
    });
  }

  updateBingoGameState(gameId: string, data: any) {
    this.send({
      type: 'bingo:game:state',
      payload: { gameId, action: 'update', data },
    });
  }

  onBingoGameStateUpdated(callback: WebSocketCallback) {
    this.addEventListener('bingo:game:state:updated', callback);
  }

  // ==================== User Data ====================

  subscribeUser(userId: string, theme?: string) {
    this.send({
      type: 'user:subscribe',
      payload: { userId, theme },
    });
  }

  onUserUpdated(callback: WebSocketCallback) {
    this.addEventListener('user:updated', callback);
  }

  // ==================== Checkin Data ====================

  subscribeCheckin(gameId: string, userId: string, theme?: string) {
    this.send({
      type: 'checkin:subscribe',
      payload: { gameId, userId, theme },
    });
  }

  onCheckinUpdated(callback: WebSocketCallback) {
    this.addEventListener('checkin:updated', callback);
  }

  // ==================== Game Data ====================

  subscribeGame(gameId: string, theme?: string) {
    this.send({
      type: 'game:subscribe',
      payload: { gameId, theme },
    });
  }

  onGameUpdated(callback: WebSocketCallback) {
    this.addEventListener('game:updated', callback);
  }

  // ==================== Answers Data ====================

  subscribeAnswers(gameId: string, theme?: string, limit?: number) {
    this.send({
      type: 'answer:subscribe',
      payload: { gameId, theme, limit },
    });
  }

  onAnswerUpdated(callback: WebSocketCallback) {
    this.addEventListener('answer:updated', callback);
  }

  // ==================== Event Listeners ====================

  addEventListener(type: WebSocketEventType, callback: WebSocketCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  removeEventListener(type: WebSocketEventType, callback: WebSocketCallback) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  disconnect() {
    // ✅ Disable reconnection
    this.shouldReconnect = false;
    
    // ✅ Clear reconnect timeout if exists
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect'); // Normal closure
      this.ws = null;
    }
    this.listeners.clear();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsInstance: PostgreSQLWebSocket | null = null;

export function getWebSocket(): PostgreSQLWebSocket {
  if (!wsInstance) {
    if (import.meta.env.DEV) {
      console.log('[WebSocket] Creating new WebSocket instance');
    }
    wsInstance = new PostgreSQLWebSocket();
  }
  return wsInstance;
}

export function disconnectWebSocket() {
  if (wsInstance) {
    wsInstance.disconnect();
    wsInstance = null;
  }
}

