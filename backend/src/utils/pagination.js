/**
 * Pagination Utilities
 * 
 * Provides cursor-based and offset-based pagination helpers
 */

/**
 * Cursor-based pagination
 * More efficient for large datasets, avoids offset performance issues
 */
export function createCursorPagination(items, limit, cursorField = 'id') {
  const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
  const cursor = items.length > 0 ? items[items.length - 1][cursorField] : null;
  const hasMore = items.length > limitNum;
  
  if (hasMore) {
    items = items.slice(0, limitNum);
  }
  
  return {
    items,
    cursor,
    hasMore,
    limit: limitNum,
  };
}

/**
 * Parse cursor from request
 */
export function parseCursor(req, defaultField = 'id') {
  const cursor = req.query.cursor || null;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const order = req.query.order || 'DESC'; // ASC or DESC
  
  return {
    cursor,
    limit,
    order: order.toUpperCase(),
    field: req.query.cursorField || defaultField,
  };
}

/**
 * Build cursor query (for PostgreSQL)
 */
export function buildCursorQuery(baseQuery, cursor, cursorField, order = 'DESC') {
  if (!cursor) {
    return {
      query: baseQuery,
      params: [],
    };
  }
  
  const operator = order === 'DESC' ? '<' : '>';
  const whereClause = `WHERE ${cursorField} ${operator} $1`;
  
  // Insert WHERE clause before ORDER BY or at the end
  const orderByIndex = baseQuery.toUpperCase().indexOf('ORDER BY');
  if (orderByIndex > -1) {
    const beforeOrder = baseQuery.substring(0, orderByIndex);
    const afterOrder = baseQuery.substring(orderByIndex);
    return {
      query: `${beforeOrder} ${whereClause} ${afterOrder}`,
      params: [cursor],
    };
  } else {
    return {
      query: `${baseQuery} ${whereClause}`,
      params: [cursor],
    };
  }
}

/**
 * Offset-based pagination (for backward compatibility)
 */
export function createOffsetPagination(items, page, limit, total) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const offset = (pageNum - 1) * limitNum;
  const totalPages = Math.ceil(total / limitNum);
  
  return {
    items: items.slice(offset, offset + limitNum),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    },
  };
}

/**
 * Parse pagination params from request
 */
export function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  
  return {
    page,
    limit,
    offset,
  };
}

