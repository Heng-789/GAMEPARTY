/**
 * Game Data Merge Utilities
 * Handles deep merging of game data with special handling for announce game
 */

/**
 * Deep merge two objects, with special handling for arrays and nested objects
 * @param {object} target - Target object to merge into
 * @param {object} source - Source object to merge from
 * @param {object} options - Merge options
 * @returns {object} Merged object
 */
export function deepMerge(target, source, options = {}) {
  const {
    preserveEmptyArrays = true, // Don't overwrite with empty arrays
    deepMergeArrays = false,    // Whether to deep merge array elements
    skipNull = false,           // Skip null values
    skipUndefined = false       // Skip undefined values
  } = options;

  if (!source || typeof source !== 'object') {
    return target;
  }

  if (!target || typeof target !== 'object') {
    return source;
  }

  const result = { ...target };

  for (const key in source) {
    if (!source.hasOwnProperty(key)) continue;

    const sourceValue = source[key];
    const targetValue = target[key];

    // Skip null/undefined if requested
    if (skipNull && sourceValue === null) continue;
    if (skipUndefined && sourceValue === undefined) continue;

    // Handle arrays
    if (Array.isArray(sourceValue)) {
      // If preserveEmptyArrays and source is empty, keep target
      if (preserveEmptyArrays && sourceValue.length === 0 && Array.isArray(targetValue) && targetValue.length > 0) {
        result[key] = targetValue;
        continue;
      }
      
      // If deepMergeArrays and both are arrays, merge elements
      if (deepMergeArrays && Array.isArray(targetValue)) {
        result[key] = [...targetValue, ...sourceValue];
      } else {
        result[key] = sourceValue;
      }
      continue;
    }

    // Handle objects (recursive merge)
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue, options);
      } else {
        result[key] = sourceValue;
      }
      continue;
    }

    // Primitive values
    result[key] = sourceValue;
  }

  return result;
}

/**
 * Merge announce game data with special rules
 * @param {object} existing - Existing announce data
 * @param {object} incoming - Incoming announce data
 * @returns {object} Merged announce data
 */
export function mergeAnnounceData(existing, incoming) {
  if (!incoming) {
    return existing;
  }

  if (!existing) {
    return incoming;
  }

  // ✅ Check if arrays are provided (even if empty, we should use them if explicitly provided)
  const hasUsers = 'users' in incoming;
  const hasUserBonuses = 'userBonuses' in incoming;
  const hasNewImageDataUrl = 'imageDataUrl' in incoming && 
                             incoming.imageDataUrl !== null && 
                             incoming.imageDataUrl !== undefined;
  const hasNewFileName = 'fileName' in incoming && 
                         incoming.fileName !== null && 
                         incoming.fileName !== undefined;

  return {
    ...existing,
    ...incoming,
    // Deep merge processedItems
    processedItems: {
      ...(existing.processedItems || {}),
      ...(incoming.processedItems || {})
    },
    // ✅ Use new values if provided (even if empty arrays)
    // This ensures that explicitly provided empty arrays are saved (not ignored)
    users: hasUsers ? (Array.isArray(incoming.users) ? incoming.users : existing.users) : existing.users,
    userBonuses: hasUserBonuses ? (Array.isArray(incoming.userBonuses) ? incoming.userBonuses : existing.userBonuses) : existing.userBonuses,
    imageDataUrl: hasNewImageDataUrl ? incoming.imageDataUrl : existing.imageDataUrl,
    fileName: hasNewFileName ? incoming.fileName : existing.fileName
  };
}

/**
 * Merge game data with special handling for different game types
 * @param {object} existing - Existing game data
 * @param {object} incoming - Incoming game data
 * @returns {object} Merged game data
 */
export function mergeGameData(existing, incoming) {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing;
  }

  if (!existing || Object.keys(existing).length === 0) {
    return incoming;
  }

  let merged = { ...existing };

  // Special handling for checkin
  if (incoming.checkin) {
    if (existing.checkin) {
      merged.checkin = {
        ...existing.checkin,
        ...incoming.checkin,
        rewardCodes: {
          ...(existing.checkin.rewardCodes || {}),
          ...(incoming.checkin.rewardCodes || {})
        },
        completeRewardCodes: incoming.checkin.completeRewardCodes || existing.checkin.completeRewardCodes,
        coupon: incoming.checkin.coupon ? {
          ...existing.checkin.coupon,
          ...incoming.checkin.coupon,
          items: incoming.checkin.coupon.items ? 
            incoming.checkin.coupon.items.map((item, index) => ({
              ...(existing.checkin.coupon?.items?.[index] || {}),
              ...item
            })) : 
            existing.checkin.coupon?.items
        } : existing.checkin.coupon
      };
    } else {
      merged.checkin = incoming.checkin;
    }
  }

  // Special handling for bingo
  if (incoming.bingo) {
    merged.bingo = existing.bingo ? deepMerge(existing.bingo, incoming.bingo) : incoming.bingo;
  }

  // Special handling for loyKrathong
  if (incoming.loyKrathong) {
    merged.loyKrathong = existing.loyKrathong ? deepMerge(existing.loyKrathong, incoming.loyKrathong) : incoming.loyKrathong;
  }

  // Special handling for announce (most important)
  if (incoming.announce) {
    merged.announce = mergeAnnounceData(existing.announce, incoming.announce);
  }

  // Merge other properties normally
  Object.keys(incoming).forEach(key => {
    if (!['checkin', 'bingo', 'loyKrathong', 'announce'].includes(key)) {
      if (incoming[key] && typeof incoming[key] === 'object' && !Array.isArray(incoming[key])) {
        merged[key] = existing[key] ? deepMerge(existing[key], incoming[key]) : incoming[key];
      } else {
        merged[key] = incoming[key];
      }
    }
  });

  return merged;
}

/**
 * Extract only changed fields between two objects
 * @param {object} existing - Existing object
 * @param {object} incoming - Incoming object
 * @returns {object} Object containing only changed fields
 */
export function extractChangedFields(existing, incoming) {
  if (!incoming || typeof incoming !== 'object') {
    return {};
  }

  if (!existing || typeof existing !== 'object') {
    return incoming;
  }

  const changes = {};

  for (const key in incoming) {
    if (!incoming.hasOwnProperty(key)) continue;

    const existingValue = existing[key];
    const incomingValue = incoming[key];

    // Skip if values are the same
    if (JSON.stringify(existingValue) === JSON.stringify(incomingValue)) {
      continue;
    }

    // For objects, recursively check for changes
    if (incomingValue && typeof incomingValue === 'object' && !Array.isArray(incomingValue)) {
      if (existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)) {
        const nestedChanges = extractChangedFields(existingValue, incomingValue);
        if (Object.keys(nestedChanges).length > 0) {
          changes[key] = nestedChanges;
        }
      } else {
        changes[key] = incomingValue;
      }
    } else {
      changes[key] = incomingValue;
    }
  }

  return changes;
}

