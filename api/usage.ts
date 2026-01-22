type UsageKey = `${string}:${string}`

type UsageBucket = {
  count: number
  errorCount: number
  totalMs: number
  lastAt: number
}

const buckets = new Map<UsageKey, UsageBucket>()

export function recordUsage(args: { provider: string; endpoint: string; ok: boolean; ms: number }): void {
  const key = `${args.provider}:${args.endpoint}` as UsageKey
  const now = Date.now()
  const existing = buckets.get(key) || { count: 0, errorCount: 0, totalMs: 0, lastAt: 0 }
  existing.count += 1
  if (!args.ok) existing.errorCount += 1
  existing.totalMs += Number.isFinite(args.ms) ? args.ms : 0
  existing.lastAt = now
  buckets.set(key, existing)
}

export function getUsageSnapshot(): Array<{ provider: string; endpoint: string; count: number; errorCount: number; avgMs: number; lastAt: number }> {
  const snapshot: Array<{ provider: string; endpoint: string; count: number; errorCount: number; avgMs: number; lastAt: number }> = []

  for (const [key, value] of buckets.entries()) {
    const [provider, endpoint] = key.split(':')
    snapshot.push({
      provider,
      endpoint,
      count: value.count,
      errorCount: value.errorCount,
      avgMs: value.count ? Math.round(value.totalMs / value.count) : 0,
      lastAt: value.lastAt,
    })
  }

  snapshot.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
  return snapshot
}

