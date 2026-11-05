import { expect, test, type Page } from '@playwright/test'

test('F: resizing and diagram edits do not raise browser errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const errors: string[] = []
    Object.assign(window, { browserErrors: errors })
    window.addEventListener('error', e => errors.push(e.message))
  })
  await page.goto('./')
  await expect(page.locator('.diagram svg')).toBeVisible()
  for (const width of [1366, 900, 1920]) {
    await page.setViewportSize({ width, height: 1080 })
    await page.locator('.diagram').click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
  await page.screenshot({ path: 'test-results/canvas-desktop.png', fullPage: true })
  expect(errors).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { browserErrors: string[] }).browserErrors)).toEqual([])
})

async function replaceDocument(page: Page, text: string) {
  const editor = page.getByRole('textbox', { name: 'ドキュメント' })
  await editor.focus()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(text)
  await page.keyboard.press('ControlOrMeta+Home')
}

test('A/G: text and diagrams share one editable canvas, persist and export without loss', async ({ page }) => {
  await page.goto('./')
  const source = '# 私たちの構成\n\n**説明文**と`code`\n\n```mermaid\nflowchart LR\n Web --> API\n API --> DB\n```\n\n図の下の文章\n\n```mermaid\nsequenceDiagram\n User->>API: 日本語の依頼\n API-->>User: 完了\n```\n'
  await replaceDocument(page, source)
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  await expect(page.locator('.cm-content')).toContainText('図の下の文章')
  await page.waitForTimeout(400)
  await page.reload()
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  await page.keyboard.press('ControlOrMeta+Shift+p')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Markdownを書き出す' }).click()
  const file = await download
  const stream = await file.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString()).toBe(source)
})

test('B/C: diagram errors retain last good image and repair without losing text focus', async ({ page }) => {
  await page.goto('./')
  await replaceDocument(page, '前の文\n\n```mermaid\nflowchart LR\n Web --> API\n API --> DB\n```\n\n後の文')
  const figure = page.locator('.diagram').first()
  await expect(figure.locator('svg')).toBeVisible()
  await figure.click()
  await page.keyboard.press('Home')
  // Diagram click places the caret at the first source line.
  await page.keyboard.insertText('broken syntax ')
  await expect(figure.locator('.diagram-error')).toBeVisible()
  await expect(figure.locator('svg')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'ドキュメント' })).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(figure.locator('.diagram-error')).toBeHidden()
  await expect(figure.locator('svg')).toContainText('Web')
})

test('empty saved document is not replaced by the sample', async ({ page }) => {
  await page.goto('./')
  await replaceDocument(page, '')
  await page.waitForTimeout(400)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'ドキュメント' })).toHaveText('')
})

test('composition in prose does not reveal or move unrelated diagram sources', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.diagram svg')).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'ドキュメント' })
  await editor.focus()
  const before = await page.locator('.diagram').boundingBox()
  await editor.dispatchEvent('compositionstart', { data: '' })
  await expect(page.locator('.mermaid-source')).toHaveCount(0)
  expect((await page.locator('.diagram').boundingBox())?.y).toBe(before?.y)
  await editor.dispatchEvent('compositionend', { data: '日本語' })
})

for (const platform of ['native', 'Linux x86_64', 'Win32']) {
  test(`keyboard-only creation, prose after diagram, undo and redo (${platform})`, async ({ page }) => {
    if (platform !== 'native') await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { get: () => platform }), platform)
    const modifier = platform === 'native' ? 'ControlOrMeta' : 'Control'
    await page.goto('./')
    await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
    await page.keyboard.press(`${modifier}+a`)
    await page.keyboard.press('Backspace')
    await page.keyboard.type('# ')
    await page.keyboard.insertText('会議のメモ')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText('説明します。')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('```mermaid')
    await page.keyboard.press('Enter')
    await page.keyboard.type('flowchart LR')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Web-->API')
    await page.keyboard.press('Enter')
    await page.keyboard.type('```')
    await expect(page.locator('.diagram svg')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.insertText('図の下に説明を続けます。')
    await expect(page.locator('.cm-content')).toContainText('図の下に説明を続けます。')
    await expect(page.locator('.md-h1')).toContainText('会議のメモ')
    await page.keyboard.press(`${modifier}+z`)
    await expect(page.locator('.cm-content')).not.toContainText('図の下に説明を続けます。')
    // Uppercase Z models the actual key produced with Shift held. Lowercase z
    // creates Ctrl+z in Playwright, which CodeMirror correctly resolves as Undo.
    await page.keyboard.press(`${modifier}+Shift+Z`)
    await expect(page.locator('.cm-content')).toContainText('図の下に説明を続けます。')
  })
}

test('editing one figure preserves the other SVG identity and uses readable horizontal overflow', async ({ page }) => {
  await page.goto('./')
  await replaceDocument(page, 'Intro\n\n```mermaid\nflowchart LR\n A-->B\n```\n\nBetween\n\n```mermaid\nflowchart LR\n A[非常に長い日本語のラベルです]-->B[次の工程についての長い説明です]-->C[最後の長い日本語のラベルです]\n```\n')
  await expect(page.locator('.diagram svg')).toHaveCount(2)
  const second = await page.locator('.diagram svg').nth(1).getAttribute('id')
  await page.locator('.diagram').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(' X-->Y')
  await expect(page.locator('.diagram svg').first()).toContainText('X')
  expect(await page.locator('.diagram svg').nth(1).getAttribute('id')).toBe(second)
  await page.setViewportSize({ width: 400, height: 900 })
  await page.waitForTimeout(100)
  const sizes = await page.locator('.diagram svg').nth(1).evaluate(svg => ({ width: svg.getBoundingClientRect().width, viewWidth: (svg as SVGSVGElement).viewBox.baseVal.width, parent: svg.parentElement!.clientWidth }))
  expect(sizes.width / sizes.viewWidth).toBeGreaterThanOrEqual(0.79)
  expect(sizes.width).toBeGreaterThan(sizes.parent)
})

test('documented Ctrl+Shift+Z redo works with the Windows keymap', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'platform', { get: () => 'Win32' }))
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('Control+End')
  await page.keyboard.insertText('REDO_TARGET')
  await expect(page.locator('.cm-content')).toContainText('REDO_TARGET')
  await page.keyboard.press('Control+z')
  await expect(page.locator('.cm-content')).not.toContainText('REDO_TARGET')
  await page.keyboard.press('Control+Shift+Z')
  await expect(page.locator('.cm-content')).toContainText('REDO_TARGET')
})
