// src/utils/domainDetection.ts
import { ThemeName } from '../types/theme'

// Domain mapping configuration
const DOMAIN_MAP: Record<string, ThemeName> = {
  'heng36.party': 'heng36',
  'max56.party': 'max56',
  'localhost': 'heng36', // default สำหรับ development
  '127.0.0.1': 'heng36',
  '0.0.0.0': 'heng36',
}

// Subdomain mapping (สำหรับกรณีที่มี subdomain)
const SUBDOMAIN_MAP: Record<string, ThemeName> = {
  'www': 'heng36', // www.heng36.party -> heng36
  'admin': 'heng36', // admin.heng36.party -> heng36
  'api': 'heng36', // api.heng36.party -> heng36
}

/**
 * ดึงชื่อโดเมนปัจจุบัน
 */
export function getCurrentDomain(): string {
  return window.location.hostname
}

/**
 * ดึงชื่อโดเมนหลัก (ไม่รวม subdomain)
 */
export function getMainDomain(): string {
  const hostname = getCurrentDomain()
  const parts = hostname.split('.')
  
  // ถ้าเป็น localhost หรือ IP address
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname
  }
  
  // ถ้ามี subdomain ให้เอาเฉพาะ domain หลัก
  if (parts.length > 2) {
    return parts.slice(-2).join('.')
  }
  
  return hostname
}

/**
 * ดึง subdomain
 */
export function getSubdomain(): string | null {
  const hostname = getCurrentDomain()
  const parts = hostname.split('.')
  
  // ถ้าเป็น localhost หรือ IP address
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null
  }
  
  // ถ้ามี subdomain
  if (parts.length > 2) {
    return parts[0]
  }
  
  return null
}

/**
 * หา theme จากโดเมน
 */
export function detectThemeFromDomain(): ThemeName {
  const hostname = getCurrentDomain()
  const mainDomain = getMainDomain()
  const subdomain = getSubdomain()
  
  // ตรวจสอบ subdomain ก่อน
  if (subdomain && SUBDOMAIN_MAP[subdomain]) {
    return SUBDOMAIN_MAP[subdomain]
  }
  
  // ตรวจสอบ domain หลัก
  if (DOMAIN_MAP[mainDomain]) {
    return DOMAIN_MAP[mainDomain]
  }
  
  // ตรวจสอบ hostname เต็ม
  if (DOMAIN_MAP[hostname]) {
    return DOMAIN_MAP[hostname]
  }
  
  // Default theme
  return 'heng36'
}

/**
 * ตรวจสอบว่าโดเมนปัจจุบันเป็นโดเมนที่รองรับหรือไม่
 */
export function isSupportedDomain(): boolean {
  const hostname = getCurrentDomain()
  const mainDomain = getMainDomain()
  
  return !!(DOMAIN_MAP[hostname] || DOMAIN_MAP[mainDomain])
}

/**
 * ดึงรายการโดเมนที่รองรับ
 */
export function getSupportedDomains(): string[] {
  return Object.keys(DOMAIN_MAP).filter(domain => 
    domain !== 'localhost' && domain !== '127.0.0.1' && domain !== '0.0.0.0'
  )
}

/**
 * ฟังก์ชันสำหรับ debug domain detection
 */
export function debugDomainDetection() {
  const hostname = getCurrentDomain()
  const mainDomain = getMainDomain()
  const subdomain = getSubdomain()
  const theme = detectThemeFromDomain()
  const isSupported = isSupportedDomain()
  
  console.log('🔍 Domain Detection Debug:', {
    hostname,
    mainDomain,
    subdomain,
    detectedTheme: theme,
    isSupported,
    supportedDomains: getSupportedDomains(),
  })
  
  return {
    hostname,
    mainDomain,
    subdomain,
    theme,
    isSupported,
  }
}
