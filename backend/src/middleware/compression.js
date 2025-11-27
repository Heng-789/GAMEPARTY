/**
 * HTTP Response Compression Middleware
 * 
 * Reduces outbound bandwidth by compressing JSON and text responses.
 * Uses gzip and brotli compression where supported.
 * 
 * Configuration via environment variables:
 * - ENABLE_COMPRESSION: Enable/disable compression (default: true)
 * - COMPRESSION_THRESHOLD: Minimum response size to compress in bytes (default: 1024)
 * - COMPRESSION_LEVEL: Compression level 1-9 (default: 6)
 */

import compression from 'compression';

const ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION !== 'false';
const COMPRESSION_THRESHOLD = parseInt(process.env.COMPRESSION_THRESHOLD) || 1024; // 1KB
const COMPRESSION_LEVEL = parseInt(process.env.COMPRESSION_LEVEL) || 6;

// Filter function to exclude already-compressed types
const shouldCompress = (req, res) => {
  // Don't compress if compression is disabled
  if (!ENABLE_COMPRESSION) {
    return false;
  }

  // Don't compress if client doesn't support compression
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Use compression filter to exclude already-compressed types
  return compression.filter(req, res);
};

/**
 * Compression middleware
 * Compresses responses larger than threshold
 */
export const compressionMiddleware = compression({
  filter: shouldCompress,
  threshold: COMPRESSION_THRESHOLD,
  level: COMPRESSION_LEVEL,
  // Only compress text-based content types
  // Images, videos, etc. are already compressed
});

