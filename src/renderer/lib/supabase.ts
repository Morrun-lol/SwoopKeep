import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadRuntimeConfig } from './runtimeConfig'

let cached: SupabaseClient | null = null
let cachedKey = ''

export const getSupabase = (): SupabaseClient | null => {
  const cfg = loadRuntimeConfig()
  const url = (cfg.supabaseUrl || '').trim()
  const key = (cfg.supabaseAnonKey || '').trim()
  if (!url || !key) return null

  const nextKey = `${url}|${key}`
  if (cached && cachedKey === nextKey) return cached
  cachedKey = nextKey
  cached = createClient(url, key)
  return cached
}

export const supabase = getSupabase()
