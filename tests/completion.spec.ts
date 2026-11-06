import { expect, test, type Page } from '@playwright/test'

async function replace(page: Page, text: string) {
  const editor = page.getByRole('textbox', { name: 'ドキュメント' })
  await editor.focus(); await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(text)
  return editor
}

test('slash search inserts a diagram in place; snippet fields, undo and prose stay editable', async ({ page }) => {
  await page.goto('./')
  const editor = await replace(page, '')
  await page.keyboard.type('/flow')
  await expect(page.getByRole('option').first()).toContainText('フロー図')
  await page.keyboard.press('Tab')
  await expect(page.locator('.diagram svg')).toBeVisible()
  await expect(editor).toBeFocused()
  await page.keyboard.insertText('利用者')
  await page.keyboard.press('Tab')
  await page.keyboard.insertText('API')
  await expect(page.locator('.diagram svg')).toContainText('利用者')
  // Dismiss the snippet before leaving the figure.
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await page.keyboard.insertText('図の下で説明')
  await expect(editor).toContainText('図の下で説明')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).not.toContainText('図の下で説明')
})

test('ghost suffix is not document data; Tab accepts and Undo removes the suggestion', async ({ page }) => {
  await page.goto('./')
  await replace(page, '```mermaid\nflo')
  await expect(page.locator('.completion-ghost')).toContainText('wchart')
  await page.keyboard.press('ControlOrMeta+Shift+P')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Markdownを書き出す' }).click()
  const stream = await (await download).createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString()).toBe('```mermaid\nflo')
  await page.keyboard.type('w')
  await expect(page.locator('.completion-ghost')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator('.diagram svg')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.mermaid-source')).toContainText(['```mermaid', 'flow'])
})

test('Enter keeps a literal trigger; Escape closes candidates and composition suppresses suggestions', async ({ page }) => {
  await page.goto('./')
  const editor = await replace(page, '')
  await page.keyboard.type('/hea')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(editor).toContainText('/hea')
  await expect(page.locator('.md-h1')).toHaveCount(0)
  await page.keyboard.type('/flow')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden()
  await page.keyboard.type('c')
  await editor.dispatchEvent('compositionstart')
  await expect(page.locator('.completion-ghost')).toBeHidden()
  await expect(page.getByRole('listbox')).toBeHidden()
  await editor.dispatchEvent('compositionend')
  await page.keyboard.insertText('日本語')
  await expect(editor).toContainText('日本語')
})
