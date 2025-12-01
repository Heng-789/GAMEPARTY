/**
 * PostgreSQL Adapter Layer
 * PostgreSQL only - no Firebase fallback
 */

import * as postgresqlApi from './postgresql-api';
import { getWebSocket } from './postgresql-websocket';

// Configuration - PostgreSQL only, no Firebase fallback
const USE_POSTGRESQL = true; // Always use PostgreSQL

// ==================== Users ====================

export async function getUserData(userId: string) {
  return await postgresqlApi.getUserData(userId);
}

export async function updateUserData(userId: string, data: any) {
  return await postgresqlApi.updateUserData(userId, data);
}

export async function addUserCoins(userId: string, amount: number, allowNegative = false) {
  const result = await postgresqlApi.addUserCoins(userId, amount, allowNegative);
  return { success: result.success, newBalance: result.newBalance, error: result.error };
}

// Admin: Get all users
export async function getAllUsers(page = 1, limit = 100, search = '') {
  return await postgresqlApi.getAllUsers(page, limit, search);
}

// Admin: Get top users by hcoin
export async function getTopUsers(limit = 100) {
  return await postgresqlApi.getTopUsers(limit);
}

// Admin: Search users
export async function searchUsers(searchTerm: string, limit = 100) {
  return await postgresqlApi.searchUsers(searchTerm, limit);
}

// Admin: Delete user
export async function deleteUser(userId: string) {
  return await postgresqlApi.deleteUser(userId);
}

// Admin: Bulk update users
export async function bulkUpdateUsers(users: Array<{ userId: string; password?: string; hcoin?: number; status?: string }>) {
  return await postgresqlApi.bulkUpdateUsers(users);
}

// ==================== Games ====================

export async function getGameData(gameId: string, fullData = false) {
  return await postgresqlApi.getGameData(gameId, fullData);
}

export async function getGamesList() {
  const games = await postgresqlApi.getGamesList();
  return games || [];
}

export async function createGame(gameData: any) {
  return await postgresqlApi.createGame(gameData);
}

export async function updateGame(gameId: string, gameData: any) {
  return await postgresqlApi.updateGame(gameId, gameData);
}

export async function deleteGame(gameId: string) {
  // ✅ ดึงข้อมูลเกมก่อนลบเพื่อหา image URLs
  let gameData: any = null;
  try {
    gameData = await postgresqlApi.getGameData(gameId);
  } catch (error) {
    console.warn('Could not fetch game data before deletion:', error);
  }

  // ✅ ลบรูปภาพจาก Supabase Storage (ถ้ามี)
  if (gameData) {
    const { deleteImageFromStorage } = await import('./image-upload');
    const imagesToDelete: string[] = [];

    // รวบรวม URL รูปภาพทั้งหมดที่ต้องลบ
    if (gameData.puzzle?.imageDataUrl) {
      imagesToDelete.push(gameData.puzzle.imageDataUrl);
    }
    if (gameData.numberPick?.imageDataUrl) {
      imagesToDelete.push(gameData.numberPick.imageDataUrl);
    }
    if (gameData.football?.imageDataUrl) {
      imagesToDelete.push(gameData.football.imageDataUrl);
    }
    if (gameData.loyKrathong?.image) {
      imagesToDelete.push(gameData.loyKrathong.image);
    }
    if (gameData.bingo?.image) {
      imagesToDelete.push(gameData.bingo.image);
    }
    if (gameData.checkin?.imageDataUrl) {
      imagesToDelete.push(gameData.checkin.imageDataUrl);
    }
    if (gameData.announce?.imageDataUrl) {
      imagesToDelete.push(gameData.announce.imageDataUrl);
    }
    if (gameData.trickOrTreat?.ghostImage) {
      imagesToDelete.push(gameData.trickOrTreat.ghostImage);
    }

    // ลบรูปภาพทั้งหมด (ไม่ต้องรอให้สำเร็จ - ลบแบบ non-blocking)
    if (imagesToDelete.length > 0) {
      Promise.all(
        imagesToDelete.map(async (imageUrl) => {
          try {
            await deleteImageFromStorage(imageUrl);
          } catch (error) {
            console.error(`Error deleting image ${imageUrl}:`, error);
            // ไม่ throw error - ให้ลบเกมต่อได้แม้รูปภาพลบไม่สำเร็จ
          }
        })
      ).catch((error) => {
        console.error('Error deleting images:', error);
        // ไม่ throw error - ให้ลบเกมต่อได้แม้รูปภาพลบไม่สำเร็จ
      });
    }
  }

  // ✅ ลบเกมจาก PostgreSQL
  return await postgresqlApi.deleteGame(gameId);
}

export async function claimCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  const result = await postgresqlApi.claimCode(gameId, userId);
  if (result.status === 'SUCCESS' && result.code) {
    return result.code;
  }
  if (result.status === 'ALREADY') {
    return 'ALREADY';
  }
  if (result.status === 'EMPTY') {
    return 'EMPTY';
  }
  return null;
}

// Claim big prize code (for LoyKrathong game)
export async function claimBigPrizeCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  const result = await postgresqlApi.claimBigPrizeCode(gameId, userId);
  if (result.status === 'SUCCESS' && result.code) {
    return result.code;
  }
  if (result.status === 'ALREADY') {
    return 'ALREADY';
  }
  if (result.status === 'EMPTY') {
    return 'EMPTY';
  }
  return null;
}

// Claim daily reward code (for Checkin game)
export async function claimDailyRewardCode(gameId: string, userId: string, dayIndex: number): Promise<'ALREADY' | 'EMPTY' | string | null> {
  const result = await postgresqlApi.claimDailyRewardCode(gameId, userId, dayIndex);
  if (result.status === 'SUCCESS' && result.code) {
    return result.code;
  }
  if (result.status === 'ALREADY') {
    return 'ALREADY';
  }
  if (result.status === 'EMPTY') {
    return 'EMPTY';
  }
  return null;
}

// Claim complete reward code (for Checkin game)
export async function claimCompleteRewardCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  const result = await postgresqlApi.claimCompleteRewardCode(gameId, userId);
  if (result.status === 'SUCCESS' && result.code) {
    return result.code;
  }
  if (result.status === 'ALREADY') {
    return 'ALREADY';
  }
  if (result.status === 'EMPTY') {
    return 'EMPTY';
  }
  return null;
}

// Claim coupon code (for Checkin game)
export async function claimCouponCode(gameId: string, userId: string, itemIndex: number): Promise<'EMPTY' | string | null> {
  const result = await postgresqlApi.claimCouponCode(gameId, userId, itemIndex);
  if (result.status === 'SUCCESS' && result.code) {
    return result.code;
  }
  // ✅ ระบบใหม่: ไม่มี ALREADY แล้ว - user แลกได้หลายครั้ง
  if (result.status === 'EMPTY') {
    return 'EMPTY';
  }
  return null;
}

export async function getServerTime(): Promise<number> {
  const result = await postgresqlApi.getServerTime();
  return result.serverTime;
}

// ==================== Checkins ====================

export async function getCheckinStatus(gameId: string, userId: string, dayIndex: number) {
  const checkins = await postgresqlApi.getCheckins(gameId, userId, 30);
  const checkin = checkins[dayIndex];
  if (checkin && checkin.checked) {
    return {
      checked: true,
      date: checkin.date,
      key: checkin.key,
      ts: checkin.createdAt ? (typeof checkin.createdAt === 'string' ? new Date(checkin.createdAt).getTime() : checkin.createdAt) : Date.now(),
    };
  }
  return null;
}

export async function checkin(gameId: string, userId: string, dayIndex: number, serverDate: string, uniqueKey: string) {
  return await postgresqlApi.checkin(gameId, userId, dayIndex, serverDate, uniqueKey);
}

export async function getCheckins(gameId: string, userId: string, maxDays = 30) {
  return await postgresqlApi.getCheckins(gameId, userId, maxDays);
}

// Admin: Get all checkins for a game
export async function getAllCheckins(gameId: string, maxDays = 365) {
  return await postgresqlApi.getAllCheckins(gameId, maxDays);
}

export async function getCompleteRewardStatus(gameId: string, userId: string) {
  return await postgresqlApi.getCompleteRewardStatus(gameId, userId);
}

export async function claimCompleteReward(gameId: string, userId: string, uniqueKey: string) {
  return await postgresqlApi.claimCompleteReward(gameId, userId, uniqueKey);
}

// ==================== Answers ====================

export async function getAnswers(gameId: string, limit = 50) {
  return await postgresqlApi.getAnswers(gameId, limit);
}

// Admin: Update answer
export async function updateAnswer(
  gameId: string,
  answerId: string,
  data: { answer?: string; correct?: boolean; code?: string }
) {
  return await postgresqlApi.updateAnswer(gameId, answerId, data);
}

// Admin: Delete answer
export async function deleteAnswer(gameId: string, answerId: string) {
  return await postgresqlApi.deleteAnswer(gameId, answerId);
}

export async function submitAnswer(
  gameId: string, 
  userIdOrData: string | { userId: string; ts?: number; serverDate?: string; [key: string]: any }, 
  answer?: string, 
  correct?: boolean, 
  code?: string
) {
  // ✅ รองรับทั้งแบบเดิม (parameters แยก) และแบบใหม่ (object)
  if (typeof userIdOrData === 'object') {
    // แบบใหม่: ส่ง object ที่มี userId, answer, และ fields อื่นๆ
    const data = userIdOrData;
    const userId = data.userId || data.user;
    const answerText = data.answer || JSON.stringify(data); // ถ้าไม่มี answer ให้ stringify ทั้ง object
    const correctValue = data.correct;
    const codeValue = data.code;
    
    // ✅ ส่ง fields เพิ่มเติมไปที่ backend (action, itemIndex, price, etc.)
    return await postgresqlApi.submitAnswer(gameId, userId, answerText, correctValue, codeValue, data);
  } else {
    // แบบเดิม: parameters แยก
    return await postgresqlApi.submitAnswer(gameId, userIdOrData, answer || '', correct, code);
  }
}

// ==================== Presence ====================

export function getPresenceWebSocket() {
  return getWebSocket();
}

// ==================== Bingo ====================

export async function getBingoCards(gameId: string, userId?: string) {
  return await postgresqlApi.getBingoCards(gameId, userId);
}

export async function createBingoCard(gameId: string, userId: string, numbers: number[][]) {
  return await postgresqlApi.createBingoCard(gameId, userId, numbers);
}

export async function updateBingoCard(gameId: string, cardId: string, checkedNumbers?: boolean[][], isBingo?: boolean) {
  return await postgresqlApi.updateBingoCard(gameId, cardId, checkedNumbers, isBingo);
}

export async function getBingoGameState(gameId: string) {
  return await postgresqlApi.getBingoGameState(gameId);
}

export async function getBingoPlayers(gameId: string) {
  return await postgresqlApi.getBingoPlayers(gameId);
}

export async function updateBingoGameState(gameId: string, state: any) {
  return await postgresqlApi.updateBingoGameState(gameId, state);
}

export async function joinBingoGame(gameId: string, userId: string, username: string, credit = 0) {
  return await postgresqlApi.joinBingoGame(gameId, userId, username, credit);
}

export async function updateBingoPlayerReady(gameId: string, userId: string, isReady: boolean) {
  return await postgresqlApi.updateBingoPlayerReady(gameId, userId, isReady);
}

// ==================== Chat ====================

export async function getChatMessages(gameId: string, limit = 50) {
  return await postgresqlApi.getChatMessages(gameId, limit);
}

export async function sendChatMessage(gameId: string, username: string, message: string) {
  return await postgresqlApi.sendChatMessage(gameId, username, message);
}

// ==================== Presence ====================

export async function getRoomPresence(gameId: string, roomId: string, maxUsers = 100) {
  return await postgresqlApi.getRoomPresence(gameId, roomId, maxUsers);
}

export async function updatePresence(
  gameId: string,
  roomId: string,
  userId: string,
  username: string,
  status?: 'online' | 'away' | 'offline'
) {
  return await postgresqlApi.updatePresence(gameId, roomId, userId, username, status);
}

export async function removePresence(gameId: string, roomId: string, userId: string) {
  return await postgresqlApi.removePresence(gameId, roomId, userId);
}

// Export configuration
export const config = {
  USE_POSTGRESQL: true,
  FALLBACK_TO_FIREBASE: false
};

