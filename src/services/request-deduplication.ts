/**
 * Request Deduplication Service
 * ป้องกันการเรียก API ซ้ำซ้อนเมื่อหลาย components เรียกพร้อมกัน
 */

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate requests - ถ้ามี request เดียวกันอยู่แล้ว ให้ใช้ request เดิม
 * @param key Unique key for the request
 * @param requestFn Function that returns a Promise
 * @returns Promise with the result
 */
export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // ถ้ามี request อยู่แล้ว ให้ใช้ request เดิม
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  // สร้าง request ใหม่
  const promise = requestFn().finally(() => {
    // ลบ request ออกจาก pending เมื่อเสร็จ (สำเร็จหรือล้มเหลว)
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear all pending requests (ใช้เมื่อต้องการ reset)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get number of pending requests (สำหรับ monitoring)
 */
export function getPendingRequestsCount(): number {
  return pendingRequests.size;
}

