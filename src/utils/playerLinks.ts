// src/utils/playerLinks.ts
// Utility helpers for constructing player-facing URLs consistently across themes/modes.

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Resolve the base origin that should be used for player-facing links.
 * Priority:
 *   1. VITE_PLAYER_ORIGIN (explicit override)
 *   2. Localhost with VITE_PORT (ensure fixed port during development)
 *   3. VITE_DOMAIN (fallback to current protocol + configured domain)
 *   4. window.location.origin (final fallback)
 */
export function getPlayerOrigin(): string {
  const envOrigin = (import.meta.env.VITE_PLAYER_ORIGIN as string | undefined)?.trim()
  if (envOrigin) {
    return trimTrailingSlash(envOrigin)
  }

  if (isBrowser()) {
    const { hostname, protocol } = window.location
    const portEnv = (import.meta.env.VITE_PORT as string | undefined)?.trim()
    // ช่วง develop: บังคับใช้พอร์ตจาก env แม้ตัวแอปอาจรันบนพอร์ตสำรอง
    if (isLocalhostHost(hostname) && portEnv) {
      return `${protocol}//localhost:${portEnv}`
    }

    const domainEnv = (import.meta.env.VITE_DOMAIN as string | undefined)?.trim()
    if (domainEnv) {
      if (/^https?:\/\//i.test(domainEnv)) {
        return trimTrailingSlash(domainEnv)
      }
      return `${protocol}//${domainEnv}`
    }

    return window.location.origin
  }

  const domainEnv = (import.meta.env.VITE_DOMAIN as string | undefined)?.trim()
  if (domainEnv) {
    if (/^https?:\/\//i.test(domainEnv)) {
      return trimTrailingSlash(domainEnv)
    }
    return `https://${domainEnv}`
  }

  return 'http://localhost:5173'
}

export function getPlayerPath(gameId: string): string {
  return `/play/${encodeURIComponent(gameId)}`
}

export function getPlayerLink(gameId: string): string {
  return `${getPlayerOrigin()}${getPlayerPath(gameId)}`
}

export function getHostPath(gameId: string): string {
  return `/host/${encodeURIComponent(gameId)}`
}

export function getHostLink(gameId: string): string {
  return `${getPlayerOrigin()}${getHostPath(gameId)}`
}

