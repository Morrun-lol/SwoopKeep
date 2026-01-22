import { expect, test } from '@playwright/test'

test('voice page keeps safe distance from top', async ({ page }) => {
  await page.setViewportSize({ width: 428, height: 926 })
  await page.goto('/#/voice')
  const main = page.locator('main')
  await expect(main).toBeVisible()

  const paddingTop = await main.evaluate((el) => getComputedStyle(el).paddingTop)
  const px = Number(String(paddingTop).replace('px', ''))
  expect(px).toBeGreaterThanOrEqual(50)
})

test('settings upload rejects non-excel file', async ({ page }) => {
  await page.goto('/#/settings')
  const input = page.locator('input[type="file"]').first()
  await expect(input).toBeAttached()

  await input.setInputFiles({
    name: 'bad.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })

  await expect(page.getByText('请上传 Excel 文件')).toBeVisible()
})
