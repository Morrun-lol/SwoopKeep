import { useEffect, useMemo, useState } from 'react'
import { saveRuntimeConfig, loadRuntimeConfig, isSupabaseConfigured, resetRuntimeConfigToDefaults } from '../lib/runtimeConfig'

export default function Config() {
  const initial = useMemo(() => loadRuntimeConfig(), [])
  const [supabaseUrl, setSupabaseUrl] = useState(initial.supabaseUrl || '')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initial.supabaseAnonKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(initial.apiBaseUrl || '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSupabaseConfigured()) {
      window.location.hash = '#/login'
    }
  }, [])

  const onSave = () => {
    setError('')
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setError('请填写 Supabase URL 与 Anon Key')
      return
    }
    saveRuntimeConfig({
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      apiBaseUrl: apiBaseUrl.trim(),
    })
    window.location.hash = '#/login'
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-gray-900">首次配置</h1>
        <p className="text-sm text-gray-600 mt-2">
          默认情况下会使用内置配置；如需自部署或调试，再在这里覆盖。
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supabase URL</label>
            <input
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="https://xxxx.supabase.co"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supabase Anon Key</label>
            <textarea
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-28"
              placeholder="eyJhbGciOi..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI API Base URL（可选）</label>
            <input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="https://xxxx.trycloudflare.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">不填会尝试用当前域名推断 :3001。</p>
          </div>
        </div>

        {error ? <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div> : null}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              resetRuntimeConfigToDefaults()
              window.location.reload()
            }}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            恢复默认配置
          </button>
          <button
            onClick={onSave}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            保存并重启
          </button>
        </div>
      </div>
    </div>
  )
}
