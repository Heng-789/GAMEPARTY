/**
 * PostgreSQL API Service
 * Service layer สำหรับเรียก API จาก backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * ดึง theme ปัจจุบันจาก Vite mode หรือ hostname
 */
function getCurrentTheme(): string {
  const viteMode = import.meta.env.MODE;
  if (viteMode === 'jeed24') return 'jeed24';
  if (viteMode === 'max56') return 'max56';
  if (viteMode === 'heng36') return 'heng36';
  
  // Fallback to hostname detection
  const hostname = window.location.hostname;
  if (hostname.includes('jeed24')) return 'jeed24';
  if (hostname.includes('max56')) return 'max56';
  if (hostname.includes('heng36')) return 'heng36';
  
  return 'heng36'; // default
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const theme = getCurrentTheme();
  
  // ✅ แก้ไข double slash: ลบ trailing slash จาก API_BASE_URL และ leading slash จาก endpoint
  const baseUrl = API_BASE_URL.replace(/\/$/, ''); // ลบ trailing slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`; // เพิ่ม leading slash ถ้าไม่มี
  const url = `${baseUrl}${cleanEndpoint}`;
  
  // เพิ่ม theme ใน query string ถ้ายังไม่มี
  const urlWithTheme = url.includes('?') 
    ? `${url}&theme=${theme}`
    : `${url}?theme=${theme}`;
  
  try {
    const response = await fetch(urlWithTheme, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Theme': theme, // ส่ง theme ใน header ด้วย
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(error.error || 'Request failed', response.status);
    }

    return response.json();
  } catch (error) {
    // Handle network errors (backend server not running)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(
        `ไม่สามารถเชื่อมต่อกับ backend server (${API_BASE_URL}). กรุณาตรวจสอบว่า backend server รันอยู่หรือไม่`,
        0
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// ==================== Users ====================

export interface UserData {
  userId: string;
  password?: string;
  hcoin: number;
  status?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    return await apiRequest<UserData>(`/api/users/${userId}`);
  } catch (error) {
    // ✅ 404 = User not found (ไม่ใช่ error - แค่ user ยังไม่มีใน database)
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    // ✅ Log error แต่ไม่ throw (เพื่อไม่ให้ component crash)
    console.warn(`[getUserData] Error fetching user ${userId}:`, error instanceof ApiError ? error.message : error);
    return null;
  }
}

export async function updateUserData(
  userId: string,
  data: Partial<UserData>
): Promise<UserData> {
  return apiRequest<UserData>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function addUserCoins(
  userId: string,
  amount: number,
  allowNegative = false
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return apiRequest(`/api/users/${userId}/coins`, {
    method: 'POST',
    body: JSON.stringify({ amount, allowNegative }),
  });
}

export async function getTopUsers(limit = 100): Promise<UserData[]> {
  return apiRequest<UserData[]>(`/api/users/top?limit=${limit}`);
}

export async function searchUsers(searchTerm: string, limit = 100): Promise<UserData[]> {
  return apiRequest<UserData[]>(`/api/users/search/${encodeURIComponent(searchTerm)}?limit=${limit}`);
}

// Admin: Get all users (with pagination)
export interface GetAllUsersResponse {
  users: UserData[];
  total: number;
  page: number;
  limit: number;
}

export async function getAllUsers(
  page = 1,
  limit = 100,
  search = ''
): Promise<GetAllUsersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  return apiRequest<GetAllUsersResponse>(`/api/users?${params.toString()}`);
}

// Admin: Delete user
export async function deleteUser(userId: string): Promise<{ success: boolean; userId: string }> {
  return apiRequest<{ success: boolean; userId: string }>(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}

// Admin: Bulk create/update users
export interface BulkUser {
  userId: string;
  password?: string;
  hcoin?: number;
  status?: string;
}

export interface BulkUsersResponse {
  success: boolean;
  count: number;
  users: UserData[];
}

export async function bulkUpdateUsers(users: BulkUser[]): Promise<BulkUsersResponse> {
  return apiRequest<BulkUsersResponse>(`/api/users/bulk`, {
    method: 'POST',
    body: JSON.stringify({ users }),
  });
}

// ==================== Games ====================

export interface GameData {
  id: string;
  name: string;
  type: string;
  unlocked?: boolean;
  locked?: boolean;
  userAccessType?: string;
  selectedUsers?: string[];
  createdAt?: string | number;
  updatedAt?: string | number;
  [key: string]: any; // Game-specific data
}

export async function getGamesList(): Promise<GameData[]> {
  return apiRequest<GameData[]>('/api/games');
}

export async function getGameData(gameId: string, fullData = false): Promise<GameData | null> {
  try {
    // ✅ ถ้า fullData = true ให้ส่ง query parameter ?full=true เพื่อบังคับให้ backend ส่ง full data แทน snapshot
    const url = fullData ? `/api/games/${gameId}?full=true` : `/api/games/${gameId}`;
    const result = await apiRequest<GameData | GameData[]>(url);
    // ✅ แก้ไข: ถ้า backend return array ให้เอาตัวแรก
    if (Array.isArray(result)) {
      return result.length > 0 ? result[0] : null;
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createGame(gameData: Partial<GameData>): Promise<GameData> {
  return apiRequest<GameData>('/api/games', {
    method: 'POST',
    body: JSON.stringify(gameData),
  });
}

export async function updateGame(
  gameId: string,
  gameData: Partial<GameData>
): Promise<GameData> {
  return apiRequest<GameData>(`/api/games/${gameId}`, {
    method: 'PUT',
    body: JSON.stringify(gameData),
  });
}

export async function deleteGame(gameId: string): Promise<void> {
  return apiRequest<void>(`/api/games/${gameId}`, {
    method: 'DELETE',
  });
}

export async function claimCode(
  gameId: string,
  userId: string
): Promise<{ status: 'SUCCESS' | 'ALREADY' | 'EMPTY'; code?: string; index?: number }> {
  return apiRequest(`/api/games/${gameId}/claim-code`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// Claim big prize code (for LoyKrathong game)
export async function claimBigPrizeCode(
  gameId: string,
  userId: string
): Promise<{ status: 'SUCCESS' | 'ALREADY' | 'EMPTY'; code?: string; index?: number }> {
  return apiRequest(`/api/games/${gameId}/claim-code/big-prize`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// Claim daily reward code (for Checkin game)
export async function claimDailyRewardCode(
  gameId: string,
  userId: string,
  dayIndex: number
): Promise<{ status: 'SUCCESS' | 'ALREADY' | 'EMPTY'; code?: string; index?: number }> {
  return apiRequest(`/api/games/${gameId}/claim-code/daily-reward/${dayIndex}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// Claim complete reward code (for Checkin game)
export async function claimCompleteRewardCode(
  gameId: string,
  userId: string
): Promise<{ status: 'SUCCESS' | 'ALREADY' | 'EMPTY'; code?: string; index?: number }> {
  return apiRequest(`/api/games/${gameId}/claim-code/complete-reward`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// Claim coupon code (for Checkin game)
export async function claimCouponCode(
  gameId: string,
  userId: string,
  itemIndex: number
): Promise<{ status: 'SUCCESS' | 'ALREADY' | 'EMPTY'; code?: string; index?: number }> {
  return apiRequest(`/api/games/${gameId}/claim-code/coupon/${itemIndex}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function getServerTime(): Promise<{ serverTime: number; serverDate: string }> {
  return apiRequest('/api/utils/server-time');
}

// ==================== Checkins ====================

export interface CheckinData {
  checked: boolean;
  date: string;
  key?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export async function getCheckins(
  gameId: string,
  userId: string,
  maxDays = 30
): Promise<Record<number, CheckinData>> {
  return apiRequest<Record<number, CheckinData>>(
    `/api/checkins/${gameId}/${userId}?maxDays=${maxDays}`
  );
}

// Admin: Get all checkins for a game
export async function getAllCheckins(
  gameId: string,
  maxDays = 365
): Promise<Record<string, Record<number, CheckinData>>> {
  return apiRequest<Record<string, Record<number, CheckinData>>>(
    `/api/checkins/${gameId}?maxDays=${maxDays}`
  );
}

export async function checkin(
  gameId: string,
  userId: string,
  dayIndex: number,
  serverDate: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }> {
  return apiRequest(`/api/checkins/${gameId}/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ dayIndex, serverDate, uniqueKey }),
  });
}

export async function claimCompleteReward(
  gameId: string,
  userId: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }> {
  return apiRequest(`/api/checkins/${gameId}/${userId}/rewards/complete`, {
    method: 'POST',
    body: JSON.stringify({ uniqueKey }),
  });
}

export async function getCompleteRewardStatus(
  gameId: string,
  userId: string
): Promise<{ claimed: boolean; key?: string; createdAt?: string; updatedAt?: string }> {
  return apiRequest(`/api/checkins/${gameId}/${userId}/rewards/complete`);
}

// ==================== Answers ====================

export interface AnswerData {
  id: string;
  gameId: string;
  userId: string;
  answer: string;
  correct?: boolean;
  code?: string;
  ts: number;
  createdAt?: string;
  // Additional properties for specific game types
  isBigPrize?: boolean;
  user?: string;
  username?: string;
  name?: string;
  value?: string;
  text?: string;
  won?: boolean;
}

export async function getAnswers(gameId: string, limit = 50): Promise<AnswerData[]> {
  return apiRequest<AnswerData[]>(`/api/answers/${gameId}?limit=${limit}`);
}

export async function submitAnswer(
  gameId: string,
  userId: string,
  answer: string,
  correct?: boolean,
  code?: string,
  extraData?: { [key: string]: any }
): Promise<AnswerData> {
  // ✅ รวม extraData เข้าไปใน body (action, itemIndex, price, balanceBefore, balanceAfter, etc.)
  const body: any = { userId, answer, correct, code };
  if (extraData) {
    Object.assign(body, extraData);
  }
  return apiRequest<AnswerData>(`/api/answers/${gameId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Admin: Update answer
export async function updateAnswer(
  gameId: string,
  answerId: string,
  data: { answer?: string; correct?: boolean; code?: string }
): Promise<AnswerData> {
  return apiRequest<AnswerData>(`/api/answers/${gameId}/${answerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Admin: Delete answer
export async function deleteAnswer(
  gameId: string,
  answerId: string
): Promise<{ success: boolean; answerId: string }> {
  return apiRequest<{ success: boolean; answerId: string }>(`/api/answers/${gameId}/${answerId}`, {
    method: 'DELETE',
  });
}

// ==================== Presence ====================

export interface UserPresence {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
  joinedAt: number;
  isInRoom: boolean;
  roomId: string;
  gameId: string;
}

export async function getRoomPresence(
  gameId: string,
  roomId: string,
  maxUsers = 100
): Promise<Record<string, UserPresence>> {
  return apiRequest<Record<string, UserPresence>>(
    `/api/presence/${gameId}/${roomId}?maxUsers=${maxUsers}`
  );
}

export async function updatePresence(
  gameId: string,
  roomId: string,
  userId: string,
  username: string,
  status?: 'online' | 'away' | 'offline'
): Promise<{ success: boolean }> {
  return apiRequest(`/api/presence/${gameId}/${roomId}`, {
    method: 'POST',
    body: JSON.stringify({ userId, username, status }),
  });
}

export async function removePresence(
  gameId: string,
  roomId: string,
  userId: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/presence/${gameId}/${roomId}/${userId}`, {
    method: 'DELETE',
  });
}

// ==================== Bingo ====================

export interface BingoCard {
  id: string;
  numbers: number[][];
  userId: string;
  checkedNumbers?: boolean[][];
  isBingo?: boolean;
  createdAt: number;
}

export interface BingoPlayer {
  userId: string;
  username: string;
  credit: number;
  joinedAt: number;
  isReady: boolean;
}

export interface BingoGameState {
  gameId: string;
  gamePhase: 'waiting' | 'countdown' | 'playing' | 'finished';
  drawnNumbers: number[];
  currentNumber?: number | null;
  gameStarted: boolean;
  readyCountdown?: number | null;
  readyCountdownEnd?: number | null;
  readyPlayers: Record<string, boolean>;
  autoDrawInterval?: number | null;
  updatedAt?: number;
  // Additional properties for game state
  lastDrawTime?: number;
  randomSeed?: number;
  status?: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner?: string;
  winnerCardId?: string;
}

export async function getBingoCards(
  gameId: string,
  userId?: string
): Promise<BingoCard[]> {
  const url = userId
    ? `/api/bingo/${gameId}/cards?userId=${userId}`
    : `/api/bingo/${gameId}/cards`;
  return apiRequest<BingoCard[]>(url);
}

export async function createBingoCard(
  gameId: string,
  userId: string,
  numbers: number[][]
): Promise<BingoCard> {
  return apiRequest<BingoCard>(`/api/bingo/${gameId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ userId, numbers }),
  });
}

export async function updateBingoCard(
  gameId: string,
  cardId: string,
  checkedNumbers?: boolean[][],
  isBingo?: boolean
): Promise<BingoCard> {
  return apiRequest<BingoCard>(`/api/bingo/${gameId}/cards/${cardId}`, {
    method: 'PUT',
    body: JSON.stringify({ checkedNumbers, isBingo }),
  });
}

export async function getBingoPlayers(gameId: string): Promise<BingoPlayer[]> {
  return apiRequest<BingoPlayer[]>(`/api/bingo/${gameId}/players`);
}

export async function joinBingoGame(
  gameId: string,
  userId: string,
  username: string,
  credit = 0
): Promise<BingoPlayer> {
  return apiRequest<BingoPlayer>(`/api/bingo/${gameId}/players`, {
    method: 'POST',
    body: JSON.stringify({ userId, username, credit }),
  });
}

export async function updateBingoPlayerReady(
  gameId: string,
  userId: string,
  isReady: boolean
): Promise<BingoPlayer> {
  return apiRequest<BingoPlayer>(`/api/bingo/${gameId}/players/${userId}/ready`, {
    method: 'PUT',
    body: JSON.stringify({ isReady }),
  });
}

export async function getBingoGameState(gameId: string): Promise<BingoGameState> {
  return apiRequest<BingoGameState>(`/api/bingo/${gameId}/state`);
}

export async function updateBingoGameState(
  gameId: string,
  state: Partial<BingoGameState>
): Promise<BingoGameState> {
  return apiRequest<BingoGameState>(`/api/bingo/${gameId}/state`, {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

// ==================== Coins ====================

export interface CoinTransaction {
  id: number;
  userId: string;
  amount: number;
  reason: string;
  uniqueKey: string;
  createdAt: string;
}

export async function addCoinsTransaction(
  userId: string,
  amount: number,
  reason: string,
  uniqueKey: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return apiRequest(`/api/coins/transactions`, {
    method: 'POST',
    body: JSON.stringify({ userId, amount, reason, uniqueKey }),
  });
}

export async function getCoinTransactions(
  userId: string,
  limit = 100
): Promise<CoinTransaction[]> {
  return apiRequest<CoinTransaction[]>(
    `/api/coins/transactions/${userId}?limit=${limit}`
  );
}

// ==================== Chat ====================

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

export async function getChatMessages(
  gameId: string,
  limit = 50
): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/api/chat/${gameId}?limit=${limit}`);
}

export async function sendChatMessage(
  gameId: string,
  username: string,
  message: string
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/api/chat/${gameId}`, {
    method: 'POST',
    body: JSON.stringify({ username, message }),
  });
}

// ==================== Theme Settings ====================

export interface ThemeSettings {
  theme: string;
  settings: Record<string, string>;
}

export async function getThemeSettings(themeName: string): Promise<ThemeSettings> {
  return apiRequest<ThemeSettings>(`/api/theme-settings/${themeName}`);
}

export async function saveThemeSettings(
  themeName: string,
  settings: Record<string, string>
): Promise<{ success: boolean; message: string; theme: string; settings: Record<string, string> }> {
  return apiRequest(`/api/theme-settings/${themeName}`, {
    method: 'POST',
    body: JSON.stringify({ settings }),
  });
}

export async function deleteThemeSetting(
  themeName: string,
  key: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/theme-settings/${themeName}/${key}`, {
    method: 'DELETE',
  });
}

