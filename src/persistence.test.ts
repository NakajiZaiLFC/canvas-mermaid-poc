import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DocumentSession } from './persistence'
import { openDB } from 'idb'

describe('local document persistence', () => {
  it('distinguishes missing document from intentionally empty content', async () => {
    const session = new DocumentSession('empty-test')
    expect(await session.load()).toBeNull()
    await session.save({ markdown: '', recovery: [] })
    expect((await new DocumentSession('empty-test').load())?.markdown).toBe('')
  })
  it('retains invalid Mermaid and unknown syntax exactly, latest save wins', async () => {
    const source = '# 日本語\n\n```mermaid\nflowchart LR\nA[broken\n```\n\n:::unknown\ntext\n:::'
    const session = new DocumentSession('roundtrip'); await session.load()
    await Promise.all([session.save({ markdown: 'old', recovery: [] }), session.save({ markdown: source, recovery: [] })])
    expect((await new DocumentSession('roundtrip').load())?.markdown).toBe(source)
  })
})

describe('versioned snapshots', () => {
  it('migrates legacy text and persists source-based diagram recovery', async () => {
    const db = await openDB('canvas-mermaid-v1', 1)
    await db.put('documents', { version: 1, markdown: 'legacy' }, 'migration'); db.close()
    const session = new DocumentSession('migration')
    expect(await session.load()).toEqual({ markdown: 'legacy', recovery: [] })
    const snapshot = { markdown: '```mermaid\nbroken\n```', recovery: [{ from: 0, source: 'broken', lastValidSource: 'flowchart LR\nA-->B' }] }
    await session.save(snapshot)
    expect(await new DocumentSession('migration').load()).toEqual(snapshot)
  })
  it('rejects stale saves atomically, including simultaneous first writes', async () => {
    const a = new DocumentSession('race'), b = new DocumentSession('race')
    await a.load(); await b.load()
    const outcomes = await Promise.allSettled([a.save({ markdown: 'A', recovery: [] }), b.save({ markdown: 'B', recovery: [] })])
    expect(outcomes.map(x => x.status)).toEqual(['fulfilled', 'rejected'])
    expect(await new DocumentSession('race').load()).toEqual({ markdown: 'A', recovery: [] })
  })
  it('preserves Markdown if optional recovery data is malformed and rejects unknown record versions', async () => {
    const db = await openDB('canvas-mermaid-v1', 1)
    await db.put('documents', { version: 2, revision: 'v', markdown: '# keep', recovery: [{ from: -1, source: 'x', lastValidSource: 42 }] }, 'malformed-recovery')
    expect(await new DocumentSession('malformed-recovery').load()).toEqual({ markdown: '# keep', recovery: [] })
    await db.put('documents', { version: 99, markdown: '# unknown' }, 'unknown')
    const session = new DocumentSession('unknown')
    await expect(session.load()).rejects.toThrow()
    await expect(session.save({ markdown: 'replacement', recovery: [] })).rejects.toThrow()
    expect((await db.get('documents', 'unknown')).markdown).toBe('# unknown')
    db.close()
  })
})
