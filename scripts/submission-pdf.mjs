import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

const browser = await chromium.launch(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {})
try {
  const page = await browser.newPage()
  await page.setContent(await readFile('docs/submission.html', 'utf8'), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await mkdir('output/pdf', { recursive: true })
  await page.pdf({ path: 'output/pdf/canvas-submission-draft.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true })
} finally { await browser.close() }
