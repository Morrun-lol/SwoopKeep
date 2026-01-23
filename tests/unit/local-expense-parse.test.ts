import { describe, expect, it } from 'vitest'
import { localParseExpense } from '../../src/renderer/lib/localExpenseParse'

describe('localParseExpense', () => {
  it('extracts amount from common Chinese sentence', () => {
    const result = localParseExpense('测试数据：今天在超市买水果花了35.5元')
    expect(result.provider).toBe('local')
    expect(result.expenses).toHaveLength(1)
    expect(result.expenses[0].amount).toBeCloseTo(35.5)
    expect(result.expenses[0].expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('picks category/sub_category from hierarchy when keyword matches', () => {
    const ctx = {
      hierarchy: [
        { project: '日常开支', category: '餐饮', sub_category: '午餐' },
        { project: '日常开支', category: '购物', sub_category: '水果' },
      ],
    }
    const result = localParseExpense('在超市买水果花了20元', ctx)
    expect(result.expenses[0].category).toBe('购物')
    expect(result.expenses[0].sub_category).toBe('水果')
  })
})

