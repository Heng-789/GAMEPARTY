/**
 * Socket.io Client สำหรับ Real-time Communication
 * แทนที่ WebSocket (ws) เดิมด้วย Socket.io เพื่อรองรับ features มากขึ้น
 */

import { io, Socket } from 'socket.io-client';
import { useTheme } from '../contexts/ThemeContext';

let socketInstance: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Get Socket.io URL from API URL
 */
function getSocketIOUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  
  // Convert http:// to ws:// and https:// to wss://
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }
  
  // Default to ws://localhost:3000
  return 'ws://localhost:3000';
}

/**
 * Initialize Socket.io connection
 */
export function initSocketIO(theme: string = 'heng36'): Socket {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  const url = getSocketIOUrl();
  console.log(`[Socket.io] Connecting to ${url}...`);

  socketInstance = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 20000,
    forceNew: false,
  });

  socketInstance.on('connect', () => {
    console.log('✅ Socket.io connected:', socketInstance?.id);
    reconnectAttempts = 0;
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('❌ Socket.io disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected, reconnect manually
      socketInstance?.connect();
    }
  });

  socketInstance.on('connect_error', (error) => {
    reconnectAttempts++;
    console.error('❌ Socket.io connection error:', error.message);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached');
    }
  });

  socketInstance.on('reconnect', (attemptNumber) => {
    console.log(`✅ Socket.io reconnected after ${attemptNumber} attempts`);
    reconnectAttempts = 0;
  });

  socketInstance.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[Socket.io] Reconnection attempt ${attemptNumber}/${MAX_RECONNECT_ATTEMPTS}`);
  });

  socketInstance.on('reconnect_failed', () => {
    console.error('❌ Socket.io reconnection failed');
  });

  return socketInstance;
}

/**
 * Get Socket.io instance
 */
export function getSocketIO(): Socket | null {
  if (!socketInstance) {
    const theme = 'heng36'; // Default theme, will be updated by hooks
    initSocketIO(theme);
  }
  return socketInstance;
}

/**
 * Disconnect Socket.io
 */
export function disconnectSocketIO() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Subscribe to user updates
 */
export function subscribeUser(socket: Socket, userId: string, theme: string) {
  socket.emit('subscribe:user', { userId, theme });
}

/**
 * Subscribe to game updates
 */
export function subscribeGame(socket: Socket, gameId: string, theme: string) {
  socket.emit('subscribe:game', { gameId, theme });
}

/**
 * Subscribe to checkin updates
 */
export function subscribeCheckin(socket: Socket, gameId: string, userId: string, theme: string) {
  socket.emit('subscribe:checkin', { gameId, userId, theme });
}

/**
 * Subscribe to answer updates
 */
export function subscribeAnswers(socket: Socket, gameId: string, theme: string) {
  socket.emit('subscribe:answers', { gameId, theme });
}

/**
 * Subscribe to bingo updates
 */
export function subscribeBingo(socket: Socket, gameId: string, theme: string) {
  socket.emit('subscribe:bingo', { gameId, theme });
}

/**
 * Subscribe to chat updates
 */
export function subscribeChat(socket: Socket, gameId: string, theme: string) {
  socket.emit('subscribe:chat', { gameId, theme });
}

