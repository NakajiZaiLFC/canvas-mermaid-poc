import { expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import type { EditorView } from '@codemirror/view'
import { livePreview } from './preview'
import { DiagramRenderer } from '../diagrams/renderer'

it('initial recovery belongs only to the restored identity and not a replacement at the same position', () => {
  const doc = '```mermaid\nbroken\n```'
  const renderer = new DiagramRenderer(async () => { throw new Error('invalid') })
  const requests = vi.spyOn(renderer, 'request')
  const preview = livePreview(renderer, [{ from: 0, source: 'broken', lastValidSource: 'old-good' }])
  let state = EditorState.create({ doc, extensions: [markdown(), preview.field] })
  // Exercise the real synchronization plugin with a state-only view.
  const view = { get state() { return state } } as EditorView
  const plugin = (preview.extensions[1] as unknown as { create(view: EditorView): { update(update: { view: EditorView; docChanged: boolean; transactions: [] }): void } }).create(view)
  const initial = state.field(preview.field).blocks[0].id
  state = state.update({ changes: { from: 0, to: state.doc.length, insert: '' } }).state
  plugin.update({ view, docChanged: true, transactions: [] })
  state = state.update({ changes: { from: 0, insert: doc } }).state
  plugin.update({ view, docChanged: true, transactions: [] })
  const next = state.field(preview.field).blocks[0].id
  expect(next).not.toBe(initial)
  expect(requests.mock.calls.at(-1)?.[2]).toBeUndefined()
  renderer.destroy()
})
