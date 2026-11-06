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

test('visible command menu searches Japanese intent, inserts a template and supports Undo', async ({ page }) => {
  await page.goto('./')
  const editor = await replace(page, '前の説明')
  await page.getByRole('button', { name: '挿入・操作を開く' }).click()
  const search = page.getByRole('textbox', { name: '挿入・操作を検索' })
  await expect(search).toBeFocused()
  await search.fill('分岐')
  await page.getByRole('button', { name: /条件分岐の図/ }).click()
  await expect(page.locator('.diagram svg')).toContainText('はい')
  await expect(editor).toContainText('前の説明')
  await expect(editor).toBeFocused()
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.diagram svg')).toHaveCount(0)
  await expect(editor).toHaveText('前の説明')
})

test('keyboard palette does not accept an IME confirmation Enter', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('textbox', { name: 'ドキュメント' }).focus()
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('textbox', { name: '挿入・操作を検索' })
  await search.fill('データベース')
  await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true })
  await expect(search).toBeVisible()
  await search.press('Enter')
  await expect(search).toBeHidden()
  await expect(page.locator('.diagram svg')).toHaveCount(2)
})

test('all diagram templates insert valid Mermaid through the actual snippet engine', async ({ page }) => {
  const { templates } = await import('../src/editor/assistance')
  await page.goto('./')
  for (const item of templates.filter(item => item.group === '図')) {
    await replace(page, '')
    await page.getByRole('button', { name: '挿入・操作を開く' }).click()
    await page.getByRole('textbox', { name: '挿入・操作を検索' }).fill(item.title)
    await page.getByRole('button', { name: new RegExp('^' + item.title) }).click()
    await expect(page.locator('.diagram[data-state="ready"] svg'), item.id).toBeVisible()
    await expect(page.locator('.diagram-error:not([hidden])'), item.id).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
})

test('sequence snippet updates repeated participant fields together', async ({ page }) => {
  await page.goto('./')
  await replace(page, '```mermaid\nsequenceDiagram\n')
  await page.keyboard.type('alt')
  await expect(page.getByRole('option').first()).toContainText('alt')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.insertText('Server')
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+Shift+P')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Markdownを書き出す' }).click()
  const stream = await (await download).createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  const markdown = Buffer.concat(chunks).toString()
  expect(markdown.match(/Server-->>User/g)).toHaveLength(2)
  expect(markdown).not.toContain('API-->>User')
})

for (const [name, source, line] of [
  ['closed ordinary fence', '前の説明\n\n```js\nconsole.log(1)\n```\n\n後の説明', 3],
  ['unclosed Mermaid fence', '前の説明\n\n```mermaid\nflowchart LR\nA-->B', 4],
  ['indented code', '前の説明\n\n    console.log(1)\n\n後の説明', 2],
] as const) {
  test(`menu inserts a root diagram outside ${name}`, async ({ page }) => {
    await page.goto('./')
    await replace(page, source)
    await page.keyboard.press('ControlOrMeta+Home')
    for (let i = 0; i < line; i++) await page.keyboard.press('ArrowDown')
    await page.getByRole('button', { name: '挿入・操作を開く' }).click()
    await page.getByRole('textbox', { name: '挿入・操作を検索' }).fill('条件分岐')
    await page.getByRole('button', { name: /条件分岐の図/ }).click()
    await expect(page.locator('.diagram[data-state="ready"] svg').last()).toContainText('はい')
    await expect(page.locator('.diagram-error:not([hidden])')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('前の説明')
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+z')
    await page.keyboard.press('ControlOrMeta+Shift+P')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Markdownを書き出す' }).click()
    const stream = await (await download).createReadStream()
    const chunks = []
    for await (const chunk of stream!) chunks.push(chunk)
    expect(Buffer.concat(chunks).toString()).toBe(source)
  })
}

test('Japanese diagram intent and every contextual snippet produce valid editable figures', async ({ page }) => {
  const { diagramSnippets } = await import('../src/editor/assistance')
  await page.goto('./')
  for (const [kind, snippets] of Object.entries(diagramSnippets)) {
    for (const item of snippets) {
      await replace(page, '```mermaid\n' + (kind === 'flow' ? 'flowchart LR\nA-->B\n' : 'sequenceDiagram\nUser->>API: 依頼\n'))
      await page.keyboard.insertText(item.label === 'loop' ? '繰り返し' : item.label)
      await expect(page.getByRole('option').first(), item.label).toContainText(item.label)
      await page.keyboard.press('Tab')
      await expect(page.locator('.diagram[data-state="ready"] svg'), item.label).toBeVisible()
      await expect(page.locator('.diagram-error:not([hidden])'), item.label).toHaveCount(0)
      await page.keyboard.press('Escape')
    }
  }
})
