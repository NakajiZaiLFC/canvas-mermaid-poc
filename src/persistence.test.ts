import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadDocument, saveDocument } from './persistence'

describe('local document persistence', () => {
  it('distinguishes missing document from intentionally empty content', async () => {
    expect(await loadDocument('empty-test')).toBeNull()
    await saveDocument('', 'empty-test')
    expect(await loadDocument('empty-test')).toBe('')
  })
  it('retains invalid Mermaid and unknown syntax exactly, latest save wins', async () => {
    const source = '# 日本語\n\n```mermaid\nflowchart LR\nA[broken\n```\n\n:::unknown\ntext\n:::'
    await Promise.all([saveDocument('old', 'roundtrip'), saveDocument(source, 'roundtrip')])
    expect(await loadDocument('roundtrip')).toBe(source)
  })
})
