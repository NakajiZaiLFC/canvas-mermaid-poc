import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { findDiagrams, reconcileBlocks } from './document'

const parse = (doc: string) => findDiagrams(EditorState.create({ doc, extensions: [markdown()] }))
describe('Markdown diagram boundaries', () => {
  it('finds multiple fenced diagrams without consuming adjacent prose', () => {
    const doc = '# 日本語\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n後の文\n\n~~~mermaid\nsequenceDiagram\n A->>B: Hello\n~~~'
    const blocks = parse(doc)
    expect(blocks.map(b => b.source)).toEqual(['flowchart LR\n A-->B', 'sequenceDiagram\n A->>B: Hello'])
    expect(doc.slice(blocks[0].from, blocks[0].to)).toBe('```mermaid\nflowchart LR\n A-->B\n```')
  })
  it('leaves ordinary code fences intact and accepts unfinished mermaid source', () => {
    expect(parse('```js\nconst a = 1\n```')).toEqual([])
    expect(parse('```mermaid\nflowchart LR\n A-->')).toMatchObject([{ source: 'flowchart LR\n A-->', closed: false }])
  })
  it('keeps identical diagram identities separate and mapped across insertion', () => {
    const state = EditorState.create({ doc: '```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\nflowchart LR\nA-->B\n```', extensions: [markdown()] })
    const old = reconcileBlocks([], findDiagrams(state))
    expect(old[0].id).not.toBe(old[1].id)
    const tr = state.update({ changes: { from: 0, insert: 'Intro\n\n' } })
    const next = reconcileBlocks(old, findDiagrams(tr.state), tr.changes)
    expect(next.map(b => b.id)).toEqual(old.map(b => b.id))
  })
  it('does not transfer a deleted diagram identity to an identical surviving diagram', () => {
    const state = EditorState.create({ doc: '```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\nflowchart LR\nA-->B\n```', extensions: [markdown()] })
    const old = reconcileBlocks([], findDiagrams(state))
    const tr = state.update({ changes: { from: 0, to: old[1].from } })
    const next = reconcileBlocks(old, findDiagrams(tr.state), tr.changes)
    expect(next.map(b => b.id)).toEqual([old[1].id])
  })
})
