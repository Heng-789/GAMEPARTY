/**
 * PostgreSQL Adapter Layer
 * Adapter สำหรับเปลี่ยนจาก Firebase ไป PostgreSQL API
 * รองรับ gradual migration (ยังใช้ Firebase เป็น fallback ได้)
 */

import * as postgresqlApi from './postgresql-api';
import { getWebSocket } from './postgresql-websocket';

// Configuration
const USE_POSTGRESQL = import.meta.env.VITE_USE_POSTGRESQL !== 'false'; // default: true
const FALLBACK_TO_FIREBASE = import.meta.env.VITE_FALLBACK_FIREBASE === 'true'; // default: false

// ==================== Users ====================

export async function getUserData(userId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getUserData(userId);
    } catch (error) {
      console.error('PostgreSQL getUserData error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { getUserData: firebaseGetUserData } = await import('./users-firestore');
        return await firebaseGetUserData(userId, { preferFirestore: true, fallbackRTDB: true });
      }
      throw error;
    }
  } else {
    const { getUserData: firebaseGetUserData } = await import('./users-firestore');
    return await firebaseGetUserData(userId, { preferFirestore: true, fallbackRTDB: true });
  }
}

export async function updateUserData(userId: string, data: any) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateUserData(userId, data);
    } catch (error) {
      console.error('PostgreSQL updateUserData error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { writeUserData } = await import('./users-firestore');
        return await writeUserData(userId, data, { preferFirestore: true });
      }
      throw error;
    }
  } else {
    const { writeUserData } = await import('./users-firestore');
    return await writeUserData(userId, data, { preferFirestore: true });
  }
}

export async function addUserCoins(userId: string, amount: number, allowNegative = false) {
  if (USE_POSTGRESQL) {
    try {
      const result = await postgresqlApi.addUserCoins(userId, amount, allowNegative);
      return { success: result.success, newBalance: result.newBalance, error: result.error };
    } catch (error) {
      console.error('PostgreSQL addUserCoins error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { addUserHcoinWithTransaction } = await import('./users-firestore');
        return await addUserHcoinWithTransaction(userId, amount, { preferFirestore: true, allowNegative });
      }
      throw error;
    }
  } else {
    const { addUserHcoinWithTransaction } = await import('./users-firestore');
    return await addUserHcoinWithTransaction(userId, amount, { preferFirestore: true, allowNegative });
  }
}

// Admin: Get all users
export async function getAllUsers(page = 1, limit = 100, search = '') {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getAllUsers(page, limit, search);
    } catch (error) {
      console.error('PostgreSQL getAllUsers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const usersRef = ref(db, 'USERS_EXTRA');
        const snapshot = await get(usersRef);
        const users = snapshot.exists() ? snapshot.val() : {};
        const userList = Object.entries(users).map(([userId, data]: [string, any]) => ({
          userId,
          password: data.password,
          hcoin: 0,
          status: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        return {
          users: userList.slice((page - 1) * limit, page * limit),
          total: userList.length,
          page,
          limit,
        };
      }
      throw error;
    }
  } else {
    // Firebase implementation
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const usersRef = ref(db, 'USERS_EXTRA');
    const snapshot = await get(usersRef);
    const users = snapshot.exists() ? snapshot.val() : {};
    const userList = Object.entries(users).map(([userId, data]: [string, any]) => ({
      userId,
      password: data.password,
      hcoin: 0,
      status: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    return {
      users: userList.slice((page - 1) * limit, page * limit),
      total: userList.length,
      page,
      limit,
    };
  }
}

// Admin: Get top users by hcoin
export async function getTopUsers(limit = 100) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getTopUsers(limit);
    } catch (error) {
      console.error('PostgreSQL getTopUsers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { getTopUsersByHcoin } = await import('./users-firestore');
        return await getTopUsersByHcoin(limit);
      }
      throw error;
    }
  } else {
    const { getTopUsersByHcoin } = await import('./users-firestore');
    return await getTopUsersByHcoin(limit);
  }
}

// Admin: Search users
export async function searchUsers(searchTerm: string, limit = 100) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.searchUsers(searchTerm, limit);
    } catch (error) {
      console.error('PostgreSQL searchUsers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { searchUsersByUsername } = await import('./users-firestore');
        return await searchUsersByUsername(searchTerm, limit);
      }
      throw error;
    }
  } else {
    const { searchUsersByUsername } = await import('./users-firestore');
    return await searchUsersByUsername(searchTerm, limit);
  }
}

// Admin: Delete user
export async function deleteUser(userId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.deleteUser(userId);
    } catch (error) {
      console.error('PostgreSQL deleteUser error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, remove } = await import('firebase/database');
        await remove(ref(db, `USERS_EXTRA/${userId}`));
        return { success: true, userId };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, remove } = await import('firebase/database');
    await remove(ref(db, `USERS_EXTRA/${userId}`));
    return { success: true, userId };
  }
}

// Admin: Bulk update users
export async function bulkUpdateUsers(users: Array<{ userId: string; password?: string; hcoin?: number; status?: string }>) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.bulkUpdateUsers(users);
    } catch (error) {
      console.error('PostgreSQL bulkUpdateUsers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const updates: Record<string, any> = {};
        for (const user of users) {
          if (user.userId) {
            updates[`USERS_EXTRA/${user.userId}`] = {
              password: user.password || '',
            };
          }
        }
        await update(ref(db), updates);
        return { success: true, count: users.length, users: [] };
      }
      throw error;
    }
  } else {
    // Firebase implementation
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const updates: Record<string, any> = {};
    for (const user of users) {
      if (user.userId) {
        updates[`USERS_EXTRA/${user.userId}`] = {
          password: user.password || '',
        };
      }
    }
    await update(ref(db), updates);
    return { success: true, count: users.length, users: [] };
  }
}

// ==================== Games ====================

export async function getGameData(gameId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getGameData(gameId);
    } catch (error) {
      console.error('PostgreSQL getGameData error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { getGameData: firebaseGetGameData } = await import('./firebase-optimized');
        return await firebaseGetGameData(gameId);
      }
      throw error;
    }
  } else {
    const { getGameData: firebaseGetGameData } = await import('./firebase-optimized');
    return await firebaseGetGameData(gameId);
  }
}

export async function getGamesList() {
  if (USE_POSTGRESQL) {
    try {
      const games = await postgresqlApi.getGamesList();
      // ✅ Return games from PostgreSQL (empty array if no games)
      console.log('📊 PostgreSQL games:', games?.length || 0);
      return games || [];
    } catch (error) {
      console.error('PostgreSQL getGamesList error:', error);
      if (FALLBACK_TO_FIREBASE) {
        console.warn('⚠️ Falling back to Firebase for games list (error occurred)');
        const { getGamesList: firebaseGetGamesList } = await import('./firebase-optimized');
        return await firebaseGetGamesList() || [];
      }
      // ✅ Return empty array if fallback is disabled
      console.warn('⚠️ PostgreSQL error, returning empty games list (fallback disabled)');
      return [];
    }
  } else {
    const { getGamesList: firebaseGetGamesList } = await import('./firebase-optimized');
    return await firebaseGetGamesList();
  }
}

export async function createGame(gameData: any) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.createGame(gameData);
    } catch (error) {
      console.error('PostgreSQL createGame error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, set } = await import('firebase/database');
        const gameRef = ref(db, `games/${gameData.gameId || gameData.id}`);
        await set(gameRef, gameData);
        return gameData;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, set } = await import('firebase/database');
    const gameRef = ref(db, `games/${gameData.gameId || gameData.id}`);
    await set(gameRef, gameData);
    return gameData;
  }
}

export async function updateGame(gameId: string, gameData: any) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateGame(gameId, gameData);
    } catch (error) {
      console.error('PostgreSQL updateGame error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const gameRef = ref(db, `games/${gameId}`);
        await update(gameRef, gameData);
        return gameData;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const gameRef = ref(db, `games/${gameId}`);
    await update(gameRef, gameData);
    return gameData;
  }
}

export async function deleteGame(gameId: string) {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL deleteGame error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, remove } = await import('firebase/database');
        // Delete related data
        try { await remove(ref(db, `answers/${gameId}`)) } catch {}
        try { await remove(ref(db, `answersIndex/${gameId}`)) } catch {}
        await remove(ref(db, `games/${gameId}`));
        return;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, remove } = await import('firebase/database');
    // Delete related data
    try { await remove(ref(db, `answers/${gameId}`)) } catch {}
    try { await remove(ref(db, `answersIndex/${gameId}`)) } catch {}
    await remove(ref(db, `games/${gameId}`));
  }
}

export async function claimCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL claimCode error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase transaction (would need to be implemented)
        throw new Error('Firebase fallback for claimCode not implemented');
      }
      throw error;
    }
  } else {
    // Firebase implementation would go here
    throw new Error('Firebase claimCode not implemented in adapter');
  }
}

// Claim big prize code (for LoyKrathong game)
export async function claimBigPrizeCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL claimBigPrizeCode error:', error);
      throw error;
    }
  } else {
    throw new Error('Firebase claimBigPrizeCode not implemented in adapter');
  }
}

// Claim daily reward code (for Checkin game)
export async function claimDailyRewardCode(gameId: string, userId: string, dayIndex: number): Promise<'ALREADY' | 'EMPTY' | string | null> {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL claimDailyRewardCode error:', error);
      throw error;
    }
  } else {
    throw new Error('Firebase claimDailyRewardCode not implemented in adapter');
  }
}

// Claim complete reward code (for Checkin game)
export async function claimCompleteRewardCode(gameId: string, userId: string): Promise<'ALREADY' | 'EMPTY' | string | null> {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL claimCompleteRewardCode error:', error);
      throw error;
    }
  } else {
    throw new Error('Firebase claimCompleteRewardCode not implemented in adapter');
  }
}

// Claim coupon code (for Checkin game)
export async function claimCouponCode(gameId: string, userId: string, itemIndex: number): Promise<'ALREADY' | 'EMPTY' | string | null> {
  if (USE_POSTGRESQL) {
    try {
      const result = await postgresqlApi.claimCouponCode(gameId, userId, itemIndex);
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
    } catch (error) {
      console.error('PostgreSQL claimCouponCode error:', error);
      throw error;
    }
  } else {
    throw new Error('Firebase claimCouponCode not implemented in adapter');
  }
}

export async function getServerTime(): Promise<number> {
  if (USE_POSTGRESQL) {
    try {
      const result = await postgresqlApi.getServerTime();
      return result.serverTime;
    } catch (error) {
      console.error('PostgreSQL getServerTime error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback: use client time (not secure, but works)
        return Date.now();
      }
      throw error;
    }
  } else {
    // Firebase: would use serverTimestamp
    return Date.now();
  }
}

// ==================== Checkins ====================

export async function getCheckinStatus(gameId: string, userId: string, dayIndex: number) {
  if (USE_POSTGRESQL) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL getCheckinStatus error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firestore
        const { getCheckinStatus: firestoreGetCheckinStatus } = await import('./checkin-firestore');
        return await firestoreGetCheckinStatus(gameId, userId, dayIndex);
      }
      throw error;
    }
  } else {
    const { getCheckinStatus: firestoreGetCheckinStatus } = await import('./checkin-firestore');
    return await firestoreGetCheckinStatus(gameId, userId, dayIndex);
  }
}

export async function checkin(gameId: string, userId: string, dayIndex: number, serverDate: string, uniqueKey: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.checkin(gameId, userId, dayIndex, serverDate, uniqueKey);
    } catch (error) {
      console.error('PostgreSQL checkin error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase RTDB
        const { db } = await import('./firebase');
        const { ref, set } = await import('firebase/database');
        const checkinRef = ref(db, `checkins/${gameId}/${userId}/${dayIndex}`);
        await set(checkinRef, {
          checked: true,
          date: serverDate,
          ts: Date.now(),
          key: uniqueKey,
        });
        return { success: true };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, set } = await import('firebase/database');
    const checkinRef = ref(db, `checkins/${gameId}/${userId}/${dayIndex}`);
    await set(checkinRef, {
      checked: true,
      date: serverDate,
      ts: Date.now(),
      key: uniqueKey,
    });
    return { success: true };
  }
}

export async function getCheckins(gameId: string, userId: string, maxDays = 30) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getCheckins(gameId, userId, maxDays);
    } catch (error) {
      console.error('PostgreSQL getCheckins error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const checkinRef = ref(db, `checkins/${gameId}/${userId}`);
        const snapshot = await get(checkinRef);
        return snapshot.exists() ? snapshot.val() : {};
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const checkinRef = ref(db, `checkins/${gameId}/${userId}`);
    const snapshot = await get(checkinRef);
    return snapshot.exists() ? snapshot.val() : {};
  }
}

// Admin: Get all checkins for a game
export async function getAllCheckins(gameId: string, maxDays = 365) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getAllCheckins(gameId, maxDays);
    } catch (error) {
      console.error('PostgreSQL getAllCheckins error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const checkinsRef = ref(db, `checkins/${gameId}`);
        const snapshot = await get(checkinsRef);
        return snapshot.exists() ? snapshot.val() : {};
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const checkinsRef = ref(db, `checkins/${gameId}`);
    const snapshot = await get(checkinsRef);
    return snapshot.exists() ? snapshot.val() : {};
  }
}

export async function getCompleteRewardStatus(gameId: string, userId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getCompleteRewardStatus(gameId, userId);
    } catch (error) {
      console.error('PostgreSQL getCompleteRewardStatus error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { getCompleteRewardStatus: firestoreGetCompleteRewardStatus } = await import('./checkin-firestore');
        return await firestoreGetCompleteRewardStatus(gameId, userId);
      }
      throw error;
    }
  } else {
    const { getCompleteRewardStatus: firestoreGetCompleteRewardStatus } = await import('./checkin-firestore');
    return await firestoreGetCompleteRewardStatus(gameId, userId);
  }
}

export async function claimCompleteReward(gameId: string, userId: string, uniqueKey: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.claimCompleteReward(gameId, userId, uniqueKey);
    } catch (error) {
      console.error('PostgreSQL claimCompleteReward error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { claimCompleteRewardWithFirestore } = await import('./checkin-firestore');
        return await claimCompleteRewardWithFirestore(gameId, userId, uniqueKey);
      }
      throw error;
    }
  } else {
    const { claimCompleteRewardWithFirestore } = await import('./checkin-firestore');
    return await claimCompleteRewardWithFirestore(gameId, userId, uniqueKey);
  }
}

// ==================== Answers ====================

export async function getAnswers(gameId: string, limit = 50) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getAnswers(gameId, limit);
    } catch (error) {
      console.error('PostgreSQL getAnswers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { getAnswers: firebaseGetAnswers } = await import('./firebase-optimized');
        return await firebaseGetAnswers(gameId, limit);
      }
      throw error;
    }
  } else {
    const { getAnswers: firebaseGetAnswers } = await import('./firebase-optimized');
    return await firebaseGetAnswers(gameId, limit);
  }
}

// Admin: Update answer
export async function updateAnswer(
  gameId: string,
  answerId: string,
  data: { answer?: string; correct?: boolean; code?: string }
) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateAnswer(gameId, answerId, data);
    } catch (error) {
      console.error('PostgreSQL updateAnswer error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const answerRef = ref(db, `answers/${gameId}/${answerId}`);
        const updates: Record<string, any> = {};
        if (data.answer !== undefined) updates.answer = data.answer;
        if (data.correct !== undefined) updates.correct = data.correct;
        if (data.code !== undefined) updates.code = data.code;
        await update(answerRef, updates);
        return {
          id: answerId,
          gameId,
          userId: '',
          answer: data.answer || '',
          correct: data.correct || false,
          code: data.code || null,
          ts: Date.now(),
        };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const answerRef = ref(db, `answers/${gameId}/${answerId}`);
    const updates: Record<string, any> = {};
    if (data.answer !== undefined) updates.answer = data.answer;
    if (data.correct !== undefined) updates.correct = data.correct;
    if (data.code !== undefined) updates.code = data.code;
    await update(answerRef, updates);
    return {
      id: answerId,
      gameId,
      userId: '',
      answer: data.answer || '',
      correct: data.correct || false,
      code: data.code || null,
      ts: Date.now(),
    };
  }
}

// Admin: Delete answer
export async function deleteAnswer(gameId: string, answerId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.deleteAnswer(gameId, answerId);
    } catch (error) {
      console.error('PostgreSQL deleteAnswer error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, remove } = await import('firebase/database');
        await remove(ref(db, `answers/${gameId}/${answerId}`));
        return { success: true, answerId };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, remove } = await import('firebase/database');
    await remove(ref(db, `answers/${gameId}/${answerId}`));
    return { success: true, answerId };
  }
}

export async function submitAnswer(
  gameId: string, 
  userId: string, 
  answer: string, 
  correct?: boolean, 
  code?: string
) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.submitAnswer(gameId, userId, answer, correct, code);
    } catch (error) {
      console.error('PostgreSQL submitAnswer error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, push, set } = await import('firebase/database');
        const ts = Date.now();
        const answersRef = ref(db, `answers/${gameId}/${ts}`);
        await set(answersRef, {
          user: userId,
          answer,
          correct,
          code,
          ts
        });
        // Also update answersIndex
        if (correct) {
          await set(ref(db, `answersIndex/${gameId}/${userId}`), {
            user: userId,
            answer,
            correct,
            code,
            ts
          });
        }
        return { id: String(ts), userId, answer, correct, code, ts };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, push, set } = await import('firebase/database');
    const ts = Date.now();
    const answersRef = ref(db, `answers/${gameId}/${ts}`);
    await set(answersRef, {
      user: userId,
      answer,
      correct,
      code,
      ts
    });
    // Also update answersIndex
    if (correct) {
      await set(ref(db, `answersIndex/${gameId}/${userId}`), {
        user: userId,
        answer,
        correct,
        code,
        ts
      });
    }
    return { id: String(ts), userId, answer, correct, code, ts };
  }
}

// ==================== Presence ====================

export function getPresenceWebSocket() {
  if (USE_POSTGRESQL) {
    return getWebSocket();
  } else {
    // Return Firebase presence functions
    return {
      joinPresence: async (gameId: string, roomId: string, userId: string, username: string) => {
        const { initializeUserPresence } = await import('./realtime-presence');
        return await initializeUserPresence(gameId, roomId, userId, username);
      },
      leavePresence: async (gameId: string, roomId: string, userId: string) => {
        const { removeUserPresence } = await import('./realtime-presence');
        return await removeUserPresence(gameId, '', userId);
      },
      updatePresence: async (gameId: string, roomId: string, userId: string, status: string) => {
        const { updateUserStatus } = await import('./realtime-presence');
        return await updateUserStatus(gameId, roomId, userId, status as any);
      },
      onPresenceUpdated: (callback: any) => {
        // Firebase presence listener
        const { listenToRoomPresence } = require('./realtime-presence');
        // Return unsubscribe function
        return () => {};
      }
    };
  }
}

// ==================== Bingo ====================

export async function getBingoCards(gameId: string, userId?: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getBingoCards(gameId, userId);
    } catch (error) {
      console.error('PostgreSQL getBingoCards error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const cardsRef = ref(db, `games/${gameId}/bingo/cards`);
        const snapshot = await get(cardsRef);
        if (!snapshot.exists()) return [];
        const cards = snapshot.val();
        return Object.entries(cards).map(([id, card]: [string, any]) => ({
          id,
          ...card
        }));
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const cardsRef = ref(db, `games/${gameId}/bingo/cards`);
    const snapshot = await get(cardsRef);
    if (!snapshot.exists()) return [];
    const cards = snapshot.val();
    return Object.entries(cards).map(([id, card]: [string, any]) => ({
      id,
      ...card
    }));
  }
}

export async function createBingoCard(gameId: string, userId: string, numbers: number[][]) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.createBingoCard(gameId, userId, numbers);
    } catch (error) {
      console.error('PostgreSQL createBingoCard error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, push, set } = await import('firebase/database');
        const cardsRef = ref(db, `games/${gameId}/bingo/cards`);
        const newCardRef = push(cardsRef);
        const cardData = {
          numbers,
          userId,
          createdAt: Date.now(),
          checkedNumbers: Array(5).fill(null).map(() => Array(5).fill(false))
        };
        await set(newCardRef, cardData);
        return { id: newCardRef.key, ...cardData };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, push, set } = await import('firebase/database');
    const cardsRef = ref(db, `games/${gameId}/bingo/cards`);
    const newCardRef = push(cardsRef);
    const cardData = {
      numbers,
      userId,
      createdAt: Date.now(),
      checkedNumbers: Array(5).fill(null).map(() => Array(5).fill(false))
    };
    await set(newCardRef, cardData);
    return { id: newCardRef.key, ...cardData };
  }
}

export async function updateBingoCard(gameId: string, cardId: string, checkedNumbers?: boolean[][], isBingo?: boolean) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateBingoCard(gameId, cardId, checkedNumbers, isBingo);
    } catch (error) {
      console.error('PostgreSQL updateBingoCard error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const cardRef = ref(db, `games/${gameId}/bingo/cards/${cardId}`);
        const updates: any = {};
        if (checkedNumbers !== undefined) updates.checkedNumbers = checkedNumbers;
        if (isBingo !== undefined) updates.isBingo = isBingo;
        await update(cardRef, updates);
        return { id: cardId, ...updates };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const cardRef = ref(db, `games/${gameId}/bingo/cards/${cardId}`);
    const updates: any = {};
    if (checkedNumbers !== undefined) updates.checkedNumbers = checkedNumbers;
    if (isBingo !== undefined) updates.isBingo = isBingo;
    await update(cardRef, updates);
    return { id: cardId, ...updates };
  }
}

export async function getBingoGameState(gameId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getBingoGameState(gameId);
    } catch (error) {
      console.error('PostgreSQL getBingoGameState error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const stateRef = ref(db, `games/${gameId}/bingo`);
        const snapshot = await get(stateRef);
        return snapshot.exists() ? snapshot.val() : null;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const stateRef = ref(db, `games/${gameId}/bingo`);
    const snapshot = await get(stateRef);
    return snapshot.exists() ? snapshot.val() : null;
  }
}

export async function getBingoPlayers(gameId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getBingoPlayers(gameId);
    } catch (error) {
      console.error('PostgreSQL getBingoPlayers error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const playersRef = ref(db, `games/${gameId}/bingo/players`);
        const snapshot = await get(playersRef);
        if (!snapshot.exists()) return [];
        const players = snapshot.val();
        return Object.entries(players).map(([userId, data]: [string, any]) => ({
          userId,
          ...data
        }));
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const playersRef = ref(db, `games/${gameId}/bingo/players`);
    const snapshot = await get(playersRef);
    if (!snapshot.exists()) return [];
    const players = snapshot.val();
    return Object.entries(players).map(([userId, data]: [string, any]) => ({
      userId,
      ...data
    }));
  }
}

export async function updateBingoGameState(gameId: string, state: any) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateBingoGameState(gameId, state);
    } catch (error) {
      console.error('PostgreSQL updateBingoGameState error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const stateRef = ref(db, `games/${gameId}/bingo/gameState`);
        await update(stateRef, state);
        return state;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const stateRef = ref(db, `games/${gameId}/bingo/gameState`);
    await update(stateRef, state);
    return state;
  }
}

export async function joinBingoGame(gameId: string, userId: string, username: string, credit = 0) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.joinBingoGame(gameId, userId, username, credit);
    } catch (error) {
      console.error('PostgreSQL joinBingoGame error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, set } = await import('firebase/database');
        const playerRef = ref(db, `games/${gameId}/bingo/players/${userId}`);
        const playerData = {
          userId,
          username,
          credit,
          joinedAt: Date.now(),
          isReady: false
        };
        await set(playerRef, playerData);
        return playerData;
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, set } = await import('firebase/database');
    const playerRef = ref(db, `games/${gameId}/bingo/players/${userId}`);
    const playerData = {
      userId,
      username,
      credit,
      joinedAt: Date.now(),
      isReady: false
    };
    await set(playerRef, playerData);
    return playerData;
  }
}

export async function updateBingoPlayerReady(gameId: string, userId: string, isReady: boolean) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updateBingoPlayerReady(gameId, userId, isReady);
    } catch (error) {
      console.error('PostgreSQL updateBingoPlayerReady error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, update } = await import('firebase/database');
        const playerRef = ref(db, `games/${gameId}/bingo/players/${userId}`);
        await update(playerRef, { isReady });
        return { userId, isReady };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, update } = await import('firebase/database');
    const playerRef = ref(db, `games/${gameId}/bingo/players/${userId}`);
    await update(playerRef, { isReady });
    return { userId, isReady };
  }
}

// ==================== Chat ====================

export async function getChatMessages(gameId: string, limit = 50) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getChatMessages(gameId, limit);
    } catch (error) {
      console.error('PostgreSQL getChatMessages error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, get, query, orderByChild, limitToLast } = await import('firebase/database');
        const chatRef = ref(db, `chat/${gameId}`);
        const chatQuery = query(chatRef, orderByChild('timestamp'), limitToLast(limit));
        const snapshot = await get(chatQuery);
        if (!snapshot.exists()) return [];
        const data = snapshot.val();
        return Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          username: msg.username || 'Unknown',
          message: msg.message || '',
          timestamp: msg.timestamp || Date.now(),
        })).sort((a, b) => a.timestamp - b.timestamp);
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get, query, orderByChild, limitToLast } = await import('firebase/database');
    const chatRef = ref(db, `chat/${gameId}`);
    const chatQuery = query(chatRef, orderByChild('timestamp'), limitToLast(limit));
    const snapshot = await get(chatQuery);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.entries(data).map(([id, msg]: [string, any]) => ({
      id,
      username: msg.username || 'Unknown',
      message: msg.message || '',
      timestamp: msg.timestamp || Date.now(),
    })).sort((a, b) => a.timestamp - b.timestamp);
  }
}

export async function sendChatMessage(gameId: string, username: string, message: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.sendChatMessage(gameId, username, message);
    } catch (error) {
      console.error('PostgreSQL sendChatMessage error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase
        const { db } = await import('./firebase');
        const { ref, push, set } = await import('firebase/database');
        const chatRef = ref(db, `chat/${gameId}`);
        const newMessageRef = push(chatRef);
        await set(newMessageRef, {
          username,
          message: message.trim(),
          timestamp: Date.now(),
        });
        return {
          id: newMessageRef.key || Date.now().toString(),
          username,
          message: message.trim(),
          timestamp: Date.now(),
        };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, push, set } = await import('firebase/database');
    const chatRef = ref(db, `chat/${gameId}`);
    const newMessageRef = push(chatRef);
    await set(newMessageRef, {
      username,
      message: message.trim(),
      timestamp: Date.now(),
    });
    return {
      id: newMessageRef.key || Date.now().toString(),
      username,
      message: message.trim(),
      timestamp: Date.now(),
    };
  }
}

// ==================== Presence ====================

export async function getRoomPresence(gameId: string, roomId: string, maxUsers = 100) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getRoomPresence(gameId, roomId, maxUsers);
    } catch (error) {
      console.error('PostgreSQL getRoomPresence error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, get } = await import('firebase/database');
        const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users`);
        const snapshot = await get(presenceRef);
        if (!snapshot.exists()) return {};
        return snapshot.val();
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, get } = await import('firebase/database');
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users`);
    const snapshot = await get(presenceRef);
    if (!snapshot.exists()) return {};
    return snapshot.val();
  }
}

export async function updatePresence(
  gameId: string,
  roomId: string,
  userId: string,
  username: string,
  status?: 'online' | 'away' | 'offline'
) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.updatePresence(gameId, roomId, userId, username, status);
    } catch (error) {
      console.error('PostgreSQL updatePresence error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, set, update } = await import('firebase/database');
        const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`);
        const presenceData: any = {
          userId,
          username,
          status: status || 'online',
          lastSeen: Date.now(),
          joinedAt: Date.now(),
          isInRoom: true,
          roomId,
          gameId
        };
        await set(presenceRef, presenceData);
        return { success: true };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, set } = await import('firebase/database');
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`);
    const presenceData: any = {
      userId,
      username,
      status: status || 'online',
      lastSeen: Date.now(),
      joinedAt: Date.now(),
      isInRoom: true,
      roomId,
      gameId
    };
    await set(presenceRef, presenceData);
    return { success: true };
  }
}

export async function removePresence(gameId: string, roomId: string, userId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.removePresence(gameId, roomId, userId);
    } catch (error) {
      console.error('PostgreSQL removePresence error:', error);
      if (FALLBACK_TO_FIREBASE) {
        const { db } = await import('./firebase');
        const { ref, remove } = await import('firebase/database');
        const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`);
        await remove(presenceRef);
        return { success: true };
      }
      throw error;
    }
  } else {
    const { db } = await import('./firebase');
    const { ref, remove } = await import('firebase/database');
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`);
    await remove(presenceRef);
    return { success: true };
  }
}

// Export configuration
export const config = {
  USE_POSTGRESQL,
  FALLBACK_TO_FIREBASE
};

