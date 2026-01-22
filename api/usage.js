const buckets = new Map()

function recordUsage({ provider, endpoint, ok, ms }) {
  const key = `${provider}:${endpoint}`
  const now = Date.now()
  const existing = buckets.get(key) || { count: 0, errorCount: 0, totalMs: 0, lastAt: 0 }
  existing.count += 1
  if (!ok) existing.errorCount += 1
  existing.totalMs += Number.isFinite(ms) ? ms : 0
  existing.lastAt = now
  buckets.set(key, existing)
}

function getUsageSnapshot() {
  const snapshot = []
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

module.exports = { recordUsage, getUsageSnapshot }

