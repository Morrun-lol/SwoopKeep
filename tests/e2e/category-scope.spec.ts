import { expect, test } from '@playwright/test'

test('category selector only shows historical labels and no add button', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error
    window.electron = true
    // @ts-expect-error
    window.api = {
      getExpenseStructure: async () => [
        { project: '日常开支', category: '购物', sub_category: '食品' },
        { project: '日常开支', category: '交通', sub_category: '打车' },
      ],
      getAllMembers: async () => [],
      getAllFamilies: async () => [],
      parseExpense: async () => ({
        provider: 'deepseek',
        expenses: [
          {
            project: '幻觉项目',
            category: '新分类',
            sub_category: '新子类',
            amount: 35.5,
            expense_date: '2026-01-01',
            description: '测试',
          },
        ],
      }),
      checkNetworkStatus: async () => ({ baidu: true, google: false, googleApi: true, deepseek: true, baseUrl: '' }),
      addExpenseHierarchyItem: async () => false,
    }
  })

  await page.goto('/#/voice')

  await page.getByText('🔧 模拟测试').click()
  await expect(page.getByText('新分类')).toHaveCount(0)
  await expect(page.getByText('新子类')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '其他' }).first()).toBeVisible()

  await page.getByRole('button', { name: /日常开支/ }).first().click()
  await expect(page.getByText('新增项目')).toHaveCount(0)
  await expect(page.getByText('幻觉项目')).toHaveCount(0)
})
