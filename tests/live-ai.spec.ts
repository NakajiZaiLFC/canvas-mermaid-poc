import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test.skip(!process.env.LIVE_AI, 'Opt-in: sends synthetic example prompts to the real cloud model')
test('real cloud generation and repair validate, require approval, preserve prose and undo', async ({ page }) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(15_000)
  if (process.env.LIVE_STAGED) {
    // Serve this production build under the approved browser Origin; AI requests are real.
    await page.route('https://nakajizailfc.github.io/**', async route => {
      const pathname = new URL(route.request().url()).pathname
      const file = pathname === '/' ? 'index.html' : pathname.slice(1)
      const full = path.resolve('dist', file)
      if (!full.startsWith(path.resolve('dist') + path.sep)) return route.abort()
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'
      await route.fulfill({ body: await readFile(full), contentType })
    })
  }
  const responses: { status: number; body: string }[] = []
  page.on('response', async response => {
    if (response.url().endsWith('/ai') && response.request().method() === 'POST') responses.push({ status: response.status(), body: await response.text() })
  })
  await page.goto(process.env.LIVE_STAGED ? 'https://nakajizailfc.github.io/' : './')
  const editor = page.getByRole('textbox', { name: 'ドキュメント' })
  await editor.focus(); await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await page.getByLabel('AIへの指示').fill('利用者がWebにアクセスし、APIを経由してDBに保存する図。利用者、Web、API、DBの4ノードを順に接続する。')
  const start = Date.now()
  await page.getByRole('button', { name: '送信して候補を作る', exact: true }).click()
  const apply = page.getByRole('button', { name: 'この候補を適用' })
  await expect(apply).toBeVisible({ timeout: 100_000 })
  console.log('REAL_GENERATION', JSON.stringify({ ms: Date.now() - start, code: await page.locator('.candidate-code').textContent(), responses }))
  await expect(page.locator('.diagram svg')).toHaveCount(1)
  await apply.click()
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  await expect(editor).toContainText('ここにあるものは、すべて編集できるサンプルです。')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.diagram svg')).toHaveCount(1)
  // Each task may use two inference calls. Respect the live per-minute budget.
  await page.waitForTimeout(61_000)
  await page.locator('.diagram').click()
  await page.keyboard.insertText('broken ')
  await expect(page.locator('.diagram-error')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'この図をAIで修復' }).click()
  const repairStart = Date.now()
  await page.getByRole('button', { name: '送信して修復候補を作る', exact: true }).click()
  await expect(apply).toBeVisible({ timeout: 100_000 })
  console.log('REAL_REPAIR', JSON.stringify({ ms: Date.now() - repairStart, code: await page.locator('.candidate-code').textContent(), responses }))
  await expect(page.locator('.diagram-error')).toBeVisible()
  await apply.click()
  await expect(page.locator('.diagram-error')).toBeHidden()
  await expect(editor).toContainText('ここにあるものは、すべて編集できるサンプルです。')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.diagram-error')).toBeVisible()
})
