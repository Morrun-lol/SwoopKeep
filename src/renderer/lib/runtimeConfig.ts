export type RuntimeConfig = {
  supabaseUrl?: string
  supabaseAnonKey?: string
  apiBaseUrl?: string
}

const STORAGE_KEY = 'trae_runtime_config'

const DEFAULTS: RuntimeConfig = {
  supabaseUrl: 'https://rzzvbzwcxglqahuyazqh.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6enZiendjeGdscWFodXlhenFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzExOTAsImV4cCI6MjA4Mzk0NzE5MH0.gK7UyLmsDvR8B_tZi_G40nLDfib5RTQQ1pJON9R5p4g',
  apiBaseUrl: 'http://112.124.48.175',
}

export const loadRuntimeConfig = (): RuntimeConfig => {
  let stored: RuntimeConfig = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch {
  }

  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const envApi = (import.meta.env.VITE_API_BASE_URL || '').trim()

  const api = (stored.apiBaseUrl || envApi || DEFAULTS.apiBaseUrl || '').trim() || undefined

  return {
    supabaseUrl: (stored.supabaseUrl || envUrl || DEFAULTS.supabaseUrl || '').trim() || undefined,
    supabaseAnonKey: (stored.supabaseAnonKey || envKey || DEFAULTS.supabaseAnonKey || '').trim() || undefined,
    apiBaseUrl: api,
  }
}

export const saveRuntimeConfig = (patch: RuntimeConfig): void => {
  const current = loadRuntimeConfig()
  const merged: RuntimeConfig = { ...current }

  if ('supabaseUrl' in patch) {
    const v = (patch.supabaseUrl || '').trim()
    merged.supabaseUrl = v || undefined
  }
  if ('supabaseAnonKey' in patch) {
    const v = (patch.supabaseAnonKey || '').trim()
    merged.supabaseAnonKey = v || undefined
  }
  if ('apiBaseUrl' in patch) {
    const v = (patch.apiBaseUrl || '').trim()
    merged.apiBaseUrl = v || undefined
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
}

export const clearRuntimeConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}

export const resetRuntimeConfigToDefaults = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULTS }))
}

export const isSupabaseConfigured = (): boolean => {
  const cfg = loadRuntimeConfig()
  return !!(cfg.supabaseUrl && cfg.supabaseAnonKey)
}

export const getApiBaseUrlFromRuntimeConfig = (): string => {
  const cfg = loadRuntimeConfig()
  return (cfg.apiBaseUrl || '').trim()
}
