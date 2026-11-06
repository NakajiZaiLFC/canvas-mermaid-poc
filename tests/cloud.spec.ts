import { expect, test } from '@playwright/test'

test.skip(!process.env.CLOUD_TEST, 'Requires a configured cloud endpoint; model boundary is simulated')

test('cloud AI works without a local model, discloses sending, and applies only an approved candidate', async ({ page }) => {
  const sent: string[] = []
  await page.addInitScript(() => Object.assign(window, { LanguageModel: undefined }))
  await page.route('**/ai', async route => {
    sent.push(route.request().postData() ?? '')
    await route.fulfill({ json: { code: 'flowchart LR\n 利用者-->Web\n Web-->API\n API-->DB' } })
  })
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.press('ControlOrMeta+Shift+P')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await expect(page.getByLabel('AIの実行場所')).toHaveValue('cloud')
  await expect(page.locator('.ai-disclosure')).toContainText('Cloudflare')
  expect(sent).toHaveLength(0)
  await page.getByLabel('AIへの指示').fill('利用者からWeb、API、DBへ')
  await page.getByRole('button', { name: '送信して候補を作る', exact: true }).click()
  await expect(page.getByRole('button', { name: 'この候補を適用' })).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(sent[0]).not.toContain('文字から、伝わる。')
  await expect(page.locator('.diagram svg')).toHaveCount(1)
  await page.getByRole('button', { name: 'この候補を適用' }).click()
  await expect(page.locator('.diagram svg')).toHaveCount(2)
})

test('a cloud limit preserves the editor and allows an explicit switch to local AI', async ({ page }) => {
  await page.route('**/ai', route => route.fulfill({ status: 429, json: { error: 'AIの利用上限に達しました。' } }))
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await page.getByLabel('AIへの指示').fill('図を作る')
  await page.getByRole('button', { name: '送信して候補を作る', exact: true }).click()
  await expect(page.locator('.ai-error')).toContainText('利用上限')
  await expect(page.locator('.diagram svg')).toBeVisible()
  await page.getByLabel('AIの実行場所').selectOption('local')
  await expect(page.locator('.ai-disclosure')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.insertText('入力を続ける')
  await expect(page.locator('.cm-content')).toContainText('入力を続ける')
})
