export type RuntimeConfig = {
  supabaseUrl?: string
  supabaseAnonKey?: string
  apiBaseUrl?: string
}

const STORAGE_KEY = 'trae_runtime_config'

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

  return {
    supabaseUrl: (stored.supabaseUrl || envUrl || '').trim() || undefined,
    supabaseAnonKey: (stored.supabaseAnonKey || envKey || '').trim() || undefined,
    apiBaseUrl: (stored.apiBaseUrl || envApi || '').trim() || undefined,
  }
}

export const saveRuntimeConfig = (patch: RuntimeConfig): void => {
  const current = loadRuntimeConfig()
  const merged: RuntimeConfig = {
    supabaseUrl: patch.supabaseUrl ?? current.supabaseUrl,
    supabaseAnonKey: patch.supabaseAnonKey ?? current.supabaseAnonKey,
    apiBaseUrl: patch.apiBaseUrl ?? current.apiBaseUrl,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
}

export const clearRuntimeConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}

export const isSupabaseConfigured = (): boolean => {
  const cfg = loadRuntimeConfig()
  return !!(cfg.supabaseUrl && cfg.supabaseAnonKey)
}

export const getApiBaseUrlFromRuntimeConfig = (): string => {
  const cfg = loadRuntimeConfig()
  return (cfg.apiBaseUrl || '').trim()
}

