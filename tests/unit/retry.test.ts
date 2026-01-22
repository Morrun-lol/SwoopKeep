import { describe, expect, it } from 'vitest'
import { retryAsync } from '../../src/renderer/lib/retry'

describe('retryAsync', () => {
  it('retries and eventually succeeds', async () => {
    let n = 0
    const res = await retryAsync(
      async () => {
        n += 1
        if (n < 3) throw new Error('boom')
        return 'ok'
      },
      { retries: 3, minDelayMs: 0, jitterMs: 0 },
    )

    expect(res).toBe('ok')
    expect(n).toBe(3)
  })
})

