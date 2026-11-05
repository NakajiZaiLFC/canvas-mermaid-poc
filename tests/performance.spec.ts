import { test, expect } from '@playwright/test'

test('measure production diagram latency and record native AI availability', async ({ page }, testInfo) => {
  test.skip(!process.env.MEASURE, 'Opt-in production performance measurement')
  test.setTimeout(120_000)
  await page.goto('./')
  await expect(page.locator('.diagram svg')).toBeVisible()
  const initialMeasures = await page.evaluate(() => performance.getEntriesByName('canvas:diagram').map(e => e.duration))
  const availability = await page.evaluate(async () => {
    if (typeof LanguageModel === 'undefined') return { api: 'absent' }
    try { return { api: 'present', status: await LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }], expectedOutputs: [{ type: 'text', languages: ['en', 'ja'] }] }) } }
    catch (error) { return { api: 'present', error: String(error) } }
  })
  const cases = [
    { name: 'flowchart-10-nodes', source: 'flowchart LR\n N0[Start]\n' + Array.from({ length: 9 }, (_, i) => ` N${i}-->N${i + 1}`).join('\n'), line: (i: number) => ` N0[Start ${i}]` },
    { name: 'sequence-4-participants', source: 'sequenceDiagram\n participant A as User\n participant B as Web\n participant C as API\n participant D as DB\n A->>B: Request\n B->>C: Validate\n C->>D: Save\n D-->>A: Done', line: (i: number) => ` participant A as User ${i}` },
  ]
  const results = []
  for (const entry of cases) {
    const editor = page.getByRole('textbox', { name: 'ドキュメント' })
    await editor.focus(); await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.insertText(`測定\n\n\`\`\`mermaid\n${entry.source}\n\`\`\`\n`)
    await page.keyboard.press('ControlOrMeta+Home')
    const figure = page.locator('.diagram')
    await expect(figure).toHaveAttribute('data-state', 'ready')
    await expect(figure).toHaveAttribute('data-generation', /\d+/)
    await figure.click()
    await page.keyboard.press('ArrowDown')
    await expect(figure).toHaveAttribute('data-generation', /\d+/)
    await page.evaluate(() => performance.clearMeasures('canvas:diagram'))
    for (let i = 0; i < 30; i++) {
      const previous = await figure.getAttribute('data-generation')
      await page.keyboard.press('Home'); await page.keyboard.press('Shift+End')
      await page.keyboard.insertText(entry.line(i))
      await expect(figure).toHaveAttribute('data-state', 'ready')
      await expect.poll(() => figure.getAttribute('data-generation')).not.toBe(previous)
      await expect.poll(() => page.evaluate(() => performance.getEntriesByName('canvas:diagram').length)).toBe(i + 1)
    }
    const values = await page.evaluate(() => performance.getEntriesByName('canvas:diagram').map(e => e.duration))
    expect(values.length).toBe(30)
    const sorted = [...values].sort((a, b) => a - b)
    results.push({ name: entry.name, count: values.length, medianMs: sorted[14], p95Ms: sorted[28], maxMs: sorted[29], valuesMs: values })
  }
  const report = { browser: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), initialSampleMs: initialMeasures, nativeAI: availability, results }
  console.log(JSON.stringify(report, null, 2))
  await testInfo.attach('performance.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
})
