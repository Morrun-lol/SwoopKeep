import { describe, expect, it } from 'vitest'
import { buildHierarchyLookup, coerceHierarchyTriple, ensureDefaultHierarchy } from '../../src/renderer/lib/expenseHierarchy'

describe('semantic performance', () => {
  it('coerceHierarchyTriple stays fast with large label set', () => {
    const rows = [] as Array<{ project: string; category: string; sub_category: string }>
    for (let i = 0; i < 2000; i++) {
      rows.push({ project: '日常开支', category: `分类${Math.floor(i / 10)}`, sub_category: `子类${i}` })
    }
    const lookup = buildHierarchyLookup(ensureDefaultHierarchy(rows))
    const t0 = performance.now()
    for (let i = 0; i < 300; i++) {
      coerceHierarchyTriple({ project: '不存在', category: '不存在', sub_category: '不存在' }, lookup)
    }
    const dt = performance.now() - t0
    expect(dt).toBeLessThan(500)
  })
})

