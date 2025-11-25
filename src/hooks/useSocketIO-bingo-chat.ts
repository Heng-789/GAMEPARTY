/**
 * Socket.io Hooks สำหรับ Bingo และ Chat
 * แยกออกมาเพื่อให้ง่ายต่อการจัดการ
 */

import { useState, useEffect, useRef } from 'react';
import { getSocketIO, subscribeBingo, subscribeChat } from '../services/socket-io-client';
import { useTheme } from '../contexts/ThemeContext';
import * as postgresqlAdapter from '../services/postgresql-adapter';

// Types
export type Player = {
  userId: string;
  username: string;
  credit: number;
  joinedAt: number;
  isReady: boolean;
};

export type BingoCard = {
  id: string;
  numbers: number[][];
  userId: string;
  createdAt: number;
  isBingo?: boolean;
  checkedNumbers?: boolean[][];
};

export type ChatMessage = {
  id: string;
  username: string;
  message: string;
  timestamp: number;
};

// ==================== Bingo Hooks ====================

export function useSocketIOBingoPlayers(gameId: string | null) {
  const [data, setData] = useState<Player[]>([]);
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

    if (!subscribedRef.current) {
      subscribeBingo(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    const handlePlayersUpdate = (payload: { gameId: string; players?: Player[] }) => {
      if (payload.gameId === gameId && payload.players) {
        setData(payload.players);
        setLoading(false);
      }
    };

    socket.on('bingo:players', handlePlayersUpdate);

    // Initial load
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const players = await postgresqlAdapter.getBingoPlayers(gameId);
          if (players) {
            setData(players);
          }
        } catch (error) {
          console.error('Error loading initial bingo players:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('bingo:players', handlePlayersUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, themeName]);

  return { data, loading };
}

export function useSocketIOBingoCards(gameId: string | null, userId: string | null) {
  const [data, setData] = useState<BingoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme();
  const socketRef = useRef<ReturnType<typeof getSocketIO> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!gameId || !userId) {
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

    if (!subscribedRef.current) {
      subscribeBingo(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    const handleCardsUpdate = (payload: { gameId: string; cards?: BingoCard[] }) => {
      if (payload.gameId === gameId && payload.cards) {
        setData(payload.cards);
        setLoading(false);
      }
    };

    socket.on('bingo:cards', handleCardsUpdate);

    // Initial load
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const cards = await postgresqlAdapter.getBingoCards(gameId, userId);
          if (cards) {
            setData(cards);
          }
        } catch (error) {
          console.error('Error loading initial bingo cards:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('bingo:cards', handleCardsUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, userId, themeName]);

  return { data, loading };
}

export function useSocketIOBingoGameState(gameId: string | null) {
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

    if (!subscribedRef.current) {
      subscribeBingo(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    const handleGameStateUpdate = (payload: { gameId: string; gameState?: any }) => {
      if (payload.gameId === gameId && payload.gameState) {
        setData(payload.gameState);
        setLoading(false);
      }
    };

    socket.on('bingo:gameState', handleGameStateUpdate);

    // Initial load
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const gameState = await postgresqlAdapter.getBingoGameState(gameId);
          if (gameState) {
            setData(gameState);
          }
        } catch (error) {
          console.error('Error loading initial bingo game state:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('bingo:gameState', handleGameStateUpdate);
      subscribedRef.current = false;
    };
  }, [gameId, themeName]);

  return { data, loading };
}

// ==================== Chat Hook ====================

export function useSocketIOChat(gameId: string | null, maxMessages: number = 50) {
  const [data, setData] = useState<ChatMessage[]>([]);
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

    if (!subscribedRef.current) {
      subscribeChat(socket, gameId, themeName);
      subscribedRef.current = true;
    }

    const handleChatMessage = (payload: { gameId: string; message?: ChatMessage }) => {
      if (payload.gameId === gameId && payload.message) {
        setData(prev => {
          const newMessages = [payload.message!, ...prev];
          return newMessages.slice(0, maxMessages);
        });
        setLoading(false);
      }
    };

    socket.on('chat:message', handleChatMessage);

    // Initial load
    const loadInitialData = async () => {
      if (!socket.connected) {
        try {
          const messages = await postgresqlAdapter.getChatMessages(gameId, maxMessages);
          if (messages) {
            setData(messages);
          }
        } catch (error) {
          console.error('Error loading initial chat messages:', error);
        }
      }
      setLoading(false);
    };
    
    loadInitialData();

    return () => {
      socket.off('chat:message', handleChatMessage);
      subscribedRef.current = false;
    };
  }, [gameId, themeName, maxMessages]);

  return { data, loading };
}

