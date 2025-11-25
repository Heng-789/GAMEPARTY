/**
 * Socket.io Hooks สำหรับ Real-time Data
 * แทนที่ useWebSocketData เดิมด้วย Socket.io
 */

import { useState, useEffect, useRef } from 'react';
import { getSocketIO, subscribeUser, subscribeGame, subscribeCheckin, subscribeAnswers, subscribeBingo, subscribeChat } from '../services/socket-io-client';
import { useTheme } from '../contexts/ThemeContext';
import * as postgresqlAdapter from '../services/postgresql-adapter';

// ==================== User Data Hook ====================

export function useSocketIOUserData(userId: string | null) {
  const [data, setData] = useState<{ hcoin?: number; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const socketRef = useRef<ReturnType<typeof getSocketIO> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    const socket = getSocketIO();
    if (!socket) {
      setLoading(false);
      return;
    }

    socketRef.current = socket;

    // Subscribe if not already subscribed
    if (!subscribedRef.current) {
      subscribeUser(socket, userId, themeName);
      subscribedRef.current = true;
    }

    // Listen for user updates
    const handleUserUpdate = (payload: { userId: string; hcoin?: number; status?: string }) => {
      if (payload.userId === userId) {
        setData({
          hcoin: payload.hcoin,
          status: payload.status,
        });
        setLoading(false);
      }
    };

    socket.on('user:updated', handleUserUpdate);

    // Initial load (fallback to API if Socket.io not ready)
    const loadInitialData = async () => {
      // ✅ รอ socket เชื่อมต่อก่อน (ไม่เกิน 3 วินาที)
      const maxWaitTime = 3000; // 3 seconds
      const startTime = Date.now();
      
      while (!socket.connected && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // ✅ ถ้า socket ยังไม่เชื่อมต่อ ให้เรียก API fallback
      if (!socket.connected) {
        try {
          const userData = await postgresqlAdapter.getUserData(userId);
          if (userData) {
            setData({
              hcoin: userData.hcoin,
              status: userData.status,
            });
          }
          // ✅ ถ้า user ไม่มีใน database (404) → ไม่ต้อง log error (เป็นเรื่องปกติ)
        } catch (error) {
          // ✅ Log เฉพาะ error ที่ไม่ใช่ 404
          if (error instanceof Error && !error.message.includes('404')) {
            console.error('Error loading initial user data:', error);
          }
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('user:updated', handleUserUpdate);
      subscribedRef.current = false;
    };
  }, [userId, themeName]);

  return { data, loading };
}

// ==================== Game Data Hook ====================

export function useSocketIOGameData(gameId: string | null) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const socketRef = useRef<ReturnType<typeof getSocketIO> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!gameId) {
      setData(null);
      setLoading(false);
      return;
    }

    const socket = getSocketIO();
    if (!socket) {
      setLoading(false);
      return;
    }

    socketRef.current = socket;

    // Subscribe if not already subscribed
    if (!subscribedRef.current) {
      subscribeGame(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    // Listen for game updates
    const handleGameUpdate = (gameData: any) => {
      if (gameData === null) {
        // Game deleted
        setData(null);
        setLoading(false);
        return;
      }
      setData(gameData);
      setLoading(false);
    };

    socket.on('game:updated', handleGameUpdate);

    // Initial load (fallback to API if Socket.io not ready)
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const gameData = await postgresqlAdapter.getGameData(gameId);
          if (gameData) {
            setData({ ...gameData, id: gameId });
          }
        } catch (error) {
          console.error('Error loading initial game data:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('game:updated', handleGameUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, themeName]);

  return { data, loading };
}

// ==================== Checkin Data Hook ====================

export function useSocketIOCheckinData(gameId: string | null, userId: string | null) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const socketRef = useRef<ReturnType<typeof getSocketIO> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!gameId || !userId) {
      setData(null);
      setLoading(false);
      return;
    }

    const socket = getSocketIO();
    if (!socket) {
      setLoading(false);
      return;
    }

    socketRef.current = socket;

    // Subscribe if not already subscribed
    if (!subscribedRef.current) {
      subscribeCheckin(socket, gameId, userId, themeName);
      subscribedRef.current = true;
    }

    // Listen for checkin updates
    const handleCheckinUpdate = (payload: { gameId: string; userId: string; checkins?: any[] }) => {
      if (payload.gameId === gameId && payload.userId === userId) {
        setData(payload.checkins || []);
        setLoading(false);
      }
    };

    socket.on('checkin:updated', handleCheckinUpdate);

    // Initial load (fallback to API if Socket.io not ready)
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const checkinData = await postgresqlAdapter.getCheckins(gameId, userId, 30);
          if (checkinData) {
            setData(checkinData);
          }
        } catch (error) {
          console.error('Error loading initial checkin data:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('checkin:updated', handleCheckinUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, userId, themeName]);

  return { data, loading };
}

// ==================== Answers Data Hook ====================

export function useSocketIOAnswers(gameId: string | null, limit: number = 100) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const socketRef = useRef<ReturnType<typeof getSocketIO> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!gameId) {
      setData([]);
      setLoading(false);
      return;
    }

    const socket = getSocketIO();
    if (!socket) {
      setLoading(false);
      return;
    }

    socketRef.current = socket;

    // Subscribe if not already subscribed
    if (!subscribedRef.current) {
      subscribeAnswers(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    // Listen for answer updates
    const handleAnswerUpdate = (payload: { gameId: string; answers?: any[] }) => {
      if (payload.gameId === gameId) {
        if (payload.answers) {
          // If it's a full update (array), replace
          if (Array.isArray(payload.answers) && payload.answers.length > 1) {
            setData(payload.answers);
          } else {
            // If it's a single update, prepend to array
            if (payload.answers && Array.isArray(payload.answers) && payload.answers.length > 0) {
              setData(prev => [payload.answers![0], ...prev].slice(0, limit));
            }
          }
        }
        setLoading(false);
      }
    };

    socket.on('answer:updated', handleAnswerUpdate);

    // ✅ Backend จะส่งข้อมูลเริ่มต้นมาเมื่อ subscribe แล้ว (sendAnswerData)
    // ✅ ไม่ต้องเรียก API fallback - รอ socket เชื่อมต่อและ subscribe แล้ว backend จะส่งข้อมูลมาเอง
    const waitForSocketAndSubscribe = async () => {
      // รอ socket เชื่อมต่อก่อน (ไม่เกิน 5 วินาที)
      const maxWaitTime = 5000; // 5 seconds
      const startTime = Date.now();
      
      while (!socket.connected && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // ✅ ถ้า socket เชื่อมต่อแล้ว ให้ subscribe (backend จะส่งข้อมูลเริ่มต้นมาเอง)
      if (socket.connected && !subscribedRef.current) {
        subscribeAnswers(socket, gameId, themeName);
        subscribedRef.current = true;
      }
      
      // ✅ ไม่เรียก API - รอข้อมูลจาก socket แทน
      // ✅ ถ้า socket ยังไม่เชื่อมต่อหลังจากรอ 5 วินาที ให้ข้าม (component อาจถูก unmount แล้ว)
      if (!socket.connected) {
        console.warn(`[useSocketIOAnswers] Socket not connected after ${maxWaitTime}ms, will wait for connection. gameId: ${gameId}`);
      }
      
      setLoading(false);
    };
    
    waitForSocketAndSubscribe();

    return () => {
      socket.off('answer:updated', handleAnswerUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, themeName, limit]);

  return { data, loading };
}

