import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATEGORY,
  DEFAULT_HIERARCHY_ROW,
  DEFAULT_PROJECT,
  DEFAULT_SUB_CATEGORY,
  buildHierarchyLookup,
  coerceHierarchyTriple,
  ensureDefaultHierarchy,
} from '../../src/renderer/lib/expenseHierarchy'

describe('expenseHierarchy', () => {
  it('ensures default hierarchy row exists', () => {
    const rows = ensureDefaultHierarchy([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(DEFAULT_HIERARCHY_ROW)
  })

  it('coerces unknown triple to defaults', () => {
    const rows = ensureDefaultHierarchy([
      { project: '日常开支', category: '购物', sub_category: '食品' },
    ])
    const lookup = buildHierarchyLookup(rows)
    const out = coerceHierarchyTriple(
      { project: '不存在', category: '不存在', sub_category: '不存在' },
      lookup,
    )
    expect(out).toEqual({
      project: DEFAULT_PROJECT,
      category: DEFAULT_CATEGORY,
      sub_category: DEFAULT_SUB_CATEGORY,
    })
  })

  it('keeps exact allowed triple', () => {
    const rows = ensureDefaultHierarchy([
      { project: '日常开支', category: '购物', sub_category: '食品' },
    ])
    const lookup = buildHierarchyLookup(rows)
    const out = coerceHierarchyTriple(
      { project: '日常开支', category: '购物', sub_category: '食品' },
      lookup,
    )
    expect(out).toEqual({ project: '日常开支', category: '购物', sub_category: '食品' })
  })
})

