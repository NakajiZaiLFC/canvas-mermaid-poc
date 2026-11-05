import { expect, test } from '@playwright/test'

// Only this model boundary is simulated. Real local-model success is a separate manual gate.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { LanguageModel: {
      availability: async () => 'available',
      create: async () => ({
        promptStreaming: () => new ReadableStream({ start(controller) {
          setTimeout(() => { controller.enqueue(JSON.stringify({ code: 'flowchart LR\n User[利用者] --> Web\n Web --> API\n API --> DB' })); controller.close() }, 300)
        } }), destroy() {},
      }),
    } })
  })
})

test('D harness: validated AI candidate requires approval, inserts and undoes as one edit', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await page.getByLabel('AIへの指示').fill('利用者からWeb、API、DBへ保存する図')
  await page.getByRole('button', { name: '候補を作る', exact: true }).click()
  await expect(page.getByRole('button', { name: 'この候補を適用' })).toBeVisible()
  await expect(page.locator('.diagram svg')).toHaveCount(1)
  await page.getByRole('button', { name: 'この候補を適用' }).click()
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.diagram svg')).toHaveCount(1)
})

test('E harness: refuses a repair if the target changed while AI was running', async ({ page }) => {
  await page.goto('./')
  await page.locator('.diagram').click()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'この図をAIで修復' }).click()
  await page.getByRole('button', { name: '修復候補を作る', exact: true }).click()
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.insertText('changed ')
  await expect(page.getByRole('button', { name: 'この候補を適用' })).toBeVisible()
  await page.getByRole('button', { name: 'この候補を適用' }).click()
  await expect(page.getByRole('status').filter({ hasText: '対象の図が変更' })).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText('changed')
})

test('E harness: approved repair replaces only the target and can be undone', async ({ page }) => {
  await page.goto('./')
  await page.locator('.diagram').click()
  await page.keyboard.insertText('broken ')
  await expect(page.locator('.diagram-error')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'この図をAIで修復' }).click()
  await page.getByRole('button', { name: '修復候補を作る', exact: true }).click()
  await expect(page.locator('.code-diff')).toContainText('broken')
  await expect(page.locator('.diagram-error')).toBeVisible()
  await page.getByRole('button', { name: 'この候補を適用' }).click()
  await expect(page.locator('.diagram-error')).toBeHidden()
  await expect(page.locator('.diagram svg')).toContainText('DB')
  await expect(page.locator('.cm-content')).toContainText('ここにあるものは、すべて編集できるサンプルです。')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.diagram-error')).toBeVisible()
})

test('cancelled AI cannot apply a late response and ordinary editing continues', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await page.getByLabel('AIへの指示').fill('図を作る')
  await page.getByRole('button', { name: '候補を作る', exact: true }).click()
  await page.getByRole('button', { name: '中止する' }).click()
  await expect(page.getByRole('status').filter({ hasText: '中止しました' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'この候補を適用' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.insertText('編集は続けられる')
  await expect(page.locator('.cm-content')).toContainText('編集は続けられる')
})

test('unsupported local AI explains the limitation without disabling the editor', async ({ page }) => {
  await page.addInitScript(() => { Object.assign(window, { LanguageModel: undefined }) })
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'AIで図を作る' }).click()
  await expect(page.locator('.ai-unavailable')).toContainText('この端末では')
  await page.getByRole('button', { name: 'AIを閉じる' }).click()
  await page.keyboard.insertText('引き続き編集')
  await expect(page.locator('.cm-content')).toContainText('引き続き編集')
})

test('repair of a deleted diagram never applies to an identical surviving diagram', async ({ page }) => {
  await page.goto('./')
  const editor = page.getByRole('textbox', { name: 'ドキュメント' })
  await editor.focus(); await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText('```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\nflowchart LR\nA-->B\n```\n')
  await page.keyboard.press('ControlOrMeta+End')
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  await page.locator('.diagram').first().click()
  await page.keyboard.press('ControlOrMeta+Shift+p')
  await page.getByRole('button', { name: 'この図をAIで修復' }).click()
  await page.getByRole('button', { name: '修復候補を作る', exact: true }).click()
  await expect(page.getByRole('button', { name: 'この候補を適用' })).toBeVisible()
  await editor.focus(); await page.keyboard.press('ControlOrMeta+Home')
  for (let i = 0; i < '```mermaid\nflowchart LR\nA-->B\n```\n\n'.length; i++) await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Backspace')
  await expect(page.locator('.diagram svg')).toHaveCount(1)
  await page.getByRole('button', { name: 'この候補を適用' }).click()
  await expect(page.getByRole('status').filter({ hasText: '対象の図が変更または削除' })).toBeVisible()
  await expect(page.locator('.diagram svg')).not.toContainText('DB')
})
