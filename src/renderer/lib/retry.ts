export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const retryAsync = async <T,>(
  fn: () => Promise<T>,
  opts?: {
    retries?: number
    minDelayMs?: number
    maxDelayMs?: number
    factor?: number
    jitterMs?: number
  },
): Promise<T> => {
  const retries = Math.max(0, Number(opts?.retries ?? 3))
  const minDelayMs = Math.max(0, Number(opts?.minDelayMs ?? 300))
  const maxDelayMs = Math.max(minDelayMs, Number(opts?.maxDelayMs ?? 8000))
  const factor = Math.max(1, Number(opts?.factor ?? 2))
  const jitterMs = Math.max(0, Number(opts?.jitterMs ?? 150))

  let lastErr: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      if (attempt >= retries) break

      const base = minDelayMs * Math.pow(factor, attempt)
      const delay = Math.min(maxDelayMs, base + (jitterMs ? Math.floor(Math.random() * jitterMs) : 0))
      if (delay > 0) await sleep(delay)
    }
  }

  throw lastErr
}

