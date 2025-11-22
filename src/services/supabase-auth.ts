import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Get current theme from Vite mode
const getCurrentTheme = (): 'heng36' | 'max56' | 'jeed24' => {
  const viteMode = import.meta.env.MODE
  if (viteMode === 'jeed24') return 'jeed24'
  if (viteMode === 'max56') return 'max56'
  if (viteMode === 'heng36') return 'heng36'
  
  // Fallback to hostname detection
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  if (hostname.includes('jeed24')) return 'jeed24'
  if (hostname.includes('max56')) return 'max56'
  if (hostname.includes('heng36')) return 'heng36'
  
  return 'heng36' // default
}

// Supabase Configuration for each theme
// Note: Vite loads .env.{mode} files automatically
// Make sure you have .env.heng36, .env.max56, .env.jeed24 files in the root directory
const supabaseConfigs = {
  heng36: {
    url: import.meta.env.VITE_SUPABASE_URL_HENG36 || 'https://ipflzfxezdzbmoqglknu.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_HENG36 || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ',
  },
  max56: {
    url: import.meta.env.VITE_SUPABASE_URL_MAX56 || 'https://aunfaslgmxxdeemvtexn.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_MAX56 || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk',
  },
  jeed24: {
    url: import.meta.env.VITE_SUPABASE_URL_JEED24 || 'https://pyrtleftkrjxvwlbvfma.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_JEED24 || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js',
  },
}

// Get current theme
export const currentTheme = getCurrentTheme()

// Get Supabase config for current theme
const getSupabaseConfig = () => {
  return supabaseConfigs[currentTheme]
}

// Create Supabase client singleton
let supabaseClient: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    const config = getSupabaseConfig()
    
    // Check if config is valid
    if (!config.url) {
      throw new Error(
        `Supabase URL missing for theme: ${currentTheme}. ` +
        `Please set VITE_SUPABASE_URL_${currentTheme.toUpperCase()} in your .env.${currentTheme} file.`
      )
    }
    
    if (!config.anonKey) {
      throw new Error(
        `Supabase anon key missing for theme: ${currentTheme}. ` +
        `Please set VITE_SUPABASE_ANON_KEY_${currentTheme.toUpperCase()} in your .env.${currentTheme} file.`
      )
    }
    
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabaseClient
}

// Export auth helpers
export const supabase = getSupabaseClient()

// Re-export auth functions for convenience
export const signInWithPassword = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password })
}

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const getSession = async () => {
  return await supabase.auth.getSession()
}

export const getUser = async () => {
  return await supabase.auth.getUser()
}

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback)
}

