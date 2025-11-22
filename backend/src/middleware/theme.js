/**
 * Theme Middleware
 * กำหนด theme จาก request (query, header, หรือ body)
 */

export function getThemeFromRequest(req) {
  // 1. จาก query parameter
  if (req.query.theme) {
    return req.query.theme;
  }

  // 2. จาก header
  if (req.headers['x-theme']) {
    return req.headers['x-theme'];
  }

  // 3. จาก body
  if (req.body && req.body.theme) {
    return req.body.theme;
  }

  // 4. จาก subdomain หรือ hostname
  const hostname = req.headers.host || '';
  if (hostname.includes('max56')) return 'max56';
  if (hostname.includes('jeed24')) return 'jeed24';
  if (hostname.includes('heng36')) return 'heng36';

  // 5. Default
  return 'heng36';
}

export function themeMiddleware(req, res, next) {
  req.theme = getThemeFromRequest(req);
  next();
}

