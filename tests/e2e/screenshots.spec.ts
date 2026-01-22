import { test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const outDir = path.resolve(process.cwd(), '.trae', 'documents', 'ui-screenshots', 'after')

test('capture ui screenshots', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true })

  await page.setViewportSize({ width: 428, height: 926 })

  const shots: Array<{ name: string; url: string }> = [
    { name: 'statistics.png', url: '/#/statistics' },
    { name: 'settings.png', url: '/#/settings' },
    { name: 'budget-config.png', url: '/#/budget-config' },
  ]

  for (const s of shots) {
    await page.goto(s.url)
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(outDir, s.name), fullPage: true })
  }
})

