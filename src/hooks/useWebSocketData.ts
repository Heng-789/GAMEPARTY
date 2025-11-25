/**
 * WebSocket Hooks for Real-time Data
 * Hooks สำหรับรับข้อมูล real-time ผ่าน WebSocket แทน polling
 */

import { useState, useEffect, useRef } from 'react';
import { getWebSocket, WebSocketCallback } from '../services/postgresql-websocket';
import { useTheme } from '../contexts/ThemeContext';
import * as postgresqlAdapter from '../services/postgresql-adapter';

// ==================== User Data Hook ====================

export function useWebSocketUserData(userId: string | null) {
  const [data, setData] = useState<{ hcoin?: number; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const wsRef = useRef<ReturnType<typeof getWebSocket> | null>(null);
  const callbackRef = useRef<WebSocketCallback | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    const ws = getWebSocket();
    wsRef.current = ws;

    // Subscribe to user updates
    ws.subscribeUser(userId, themeName);

    // Set up listener
    const callback: WebSocketCallback = (payload) => {
      if (payload.userId === userId) {
        setData({
          hcoin: payload.hcoin,
          status: payload.status,
        });
        setLoading(false);
      }
    };

    callbackRef.current = callback;
    ws.onUserUpdated(callback);

    // Initial load (fallback to API if WebSocket not ready)
    const loadInitialData = async () => {
      if (!ws.isConnected()) {
        // Fallback to API
        try {
          const userData = await postgresqlAdapter.getUserData(userId);
          if (userData) {
            setData({
              hcoin: userData.hcoin,
              status: userData.status,
            });
          }
        } catch (error) {
          console.error('Error loading initial user data:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      if (wsRef.current && callbackRef.current) {
        wsRef.current.removeEventListener('user:updated', callbackRef.current);
      }
    };
  }, [userId, themeName]);

  return { data, loading };
}

// ==================== Checkin Data Hook ====================

export function useWebSocketCheckinData(gameId: string | null, userId: string | null) {
  const [data, setData] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const wsRef = useRef<ReturnType<typeof getWebSocket> | null>(null);
  const callbackRef = useRef<WebSocketCallback | null>(null);

  useEffect(() => {
    if (!gameId || !userId) {
      setData({});
      setLoading(false);
      return;
    }

    const ws = getWebSocket();
    wsRef.current = ws;

    // Subscribe to checkin updates
    ws.subscribeCheckin(gameId, userId, themeName);

    // Set up listener
    const callback: WebSocketCallback = (payload) => {
      if (payload.gameId === gameId && payload.userId === userId) {
        setData(payload.checkins || {});
        setLoading(false);
      }
    };

    callbackRef.current = callback;
    ws.onCheckinUpdated(callback);

    // Initial load (fallback to API if WebSocket not ready)
    const loadInitialData = async () => {
      if (!ws.isConnected()) {
        // Fallback to API
        try {
          const checkins = await postgresqlAdapter.getCheckins(gameId, userId, 30);
          setData(checkins || {});
        } catch (error) {
          console.error('Error loading initial checkin data:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      if (wsRef.current && callbackRef.current) {
        wsRef.current.removeEventListener('checkin:updated', callbackRef.current);
      }
    };
  }, [gameId, userId, themeName]);

  return { data, loading };
}

// ==================== Game Data Hook ====================

export function useWebSocketGameData(gameId: string | null) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const wsRef = useRef<ReturnType<typeof getWebSocket> | null>(null);
  const callbackRef = useRef<WebSocketCallback | null>(null);

  useEffect(() => {
    if (!gameId) {
      setData(null);
      setLoading(false);
      return;
    }

    const ws = getWebSocket();
    wsRef.current = ws;

    // Subscribe to game updates
    ws.subscribeGame(gameId, themeName);

    // Set up listener
    const callback: WebSocketCallback = (payload) => {
      if (payload.gameId === gameId) {
        setData(payload.gameData);
        setLoading(false);
      }
    };

    callbackRef.current = callback;
    ws.onGameUpdated(callback);

    // Initial load (fallback to API if WebSocket not ready)
    const loadInitialData = async () => {
      if (!ws.isConnected()) {
        // Fallback to API
        try {
          const gameData = await postgresqlAdapter.getGameData(gameId);
          setData(gameData);
        } catch (error) {
          console.error('Error loading initial game data:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      if (wsRef.current && callbackRef.current) {
        wsRef.current.removeEventListener('game:updated', callbackRef.current);
      }
    };
  }, [gameId, themeName]);

  return { data, loading };
}

// ==================== Answers Data Hook ====================

export function useWebSocketAnswers(gameId: string | null, limit: number = 100) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const wsRef = useRef<ReturnType<typeof getWebSocket> | null>(null);
  const callbackRef = useRef<WebSocketCallback | null>(null);

  useEffect(() => {
    if (!gameId) {
      setData([]);
      setLoading(false);
      return;
    }

    const ws = getWebSocket();
    wsRef.current = ws;

    // Subscribe to answer updates (with limit)
    ws.subscribeAnswers(gameId, themeName, limit);

    // Set up listener
    const callback: WebSocketCallback = (payload) => {
      if (payload.gameId === gameId) {
        setData((prev) => {
          // Merge new answers with existing ones, avoiding duplicates
          const existingIds = new Set(prev.map((a) => a.id));
          const newAnswers = Array.isArray(payload.answers)
            ? payload.answers.filter((a: any) => !existingIds.has(a.id))
            : [];
          return [...newAnswers, ...prev].slice(0, limit);
        });
        setLoading(false);
      }
    };

    callbackRef.current = callback;
    ws.onAnswerUpdated(callback);

    // Initial load (fallback to API if WebSocket not ready after timeout)
    // ✅ Only load once when WebSocket is not connected, then wait for WebSocket updates
    const loadInitialData = async () => {
      // ✅ Wait for WebSocket to connect (with timeout)
      const maxWaitTime = 2000; // 2 seconds
      const startTime = Date.now();
      
      const waitForConnection = () => {
        return new Promise<boolean>((resolve) => {
          if (ws.isConnected()) {
            resolve(true);
            return;
          }
          
          const checkInterval = setInterval(() => {
            if (ws.isConnected()) {
              clearInterval(checkInterval);
              resolve(true);
            } else if (Date.now() - startTime > maxWaitTime) {
              clearInterval(checkInterval);
              resolve(false); // Timeout
            }
          }, 100);
        });
      };
      
      try {
        const connected = await waitForConnection();
        if (connected) {
          // WebSocket connected - data will come via WebSocket
          setLoading(false);
        } else {
          // Timeout - fallback to API (only once)
          try {
            const answers = await postgresqlAdapter.getAnswers(gameId, limit);
            setData(answers || []);
          } catch (error) {
            console.error('Error loading initial answer data:', error);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error waiting for WebSocket connection:', error);
        setLoading(false);
      }
    };
    
    loadInitialData();

    return () => {
      if (wsRef.current && callbackRef.current) {
        wsRef.current.removeEventListener('answer:updated', callbackRef.current);
      }
    };
  }, [gameId, limit, themeName]);

  return { data, loading };
}

