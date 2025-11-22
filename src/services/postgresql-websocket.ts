/**
 * PostgreSQL WebSocket Client
 * WebSocket client สำหรับ real-time updates จาก backend
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export type WebSocketEventType =
  | 'presence:join'
  | 'presence:leave'
  | 'presence:update'
  | 'bingo:card:update'
  | 'bingo:game:state'
  | 'presence:updated'
  | 'bingo:card:updated'
  | 'bingo:game:state:updated';

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

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
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
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        this.reconnect();
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
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
      console.warn('WebSocket not connected, message not sent:', message);
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsInstance: PostgreSQLWebSocket | null = null;

export function getWebSocket(): PostgreSQLWebSocket {
  if (!wsInstance) {
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

