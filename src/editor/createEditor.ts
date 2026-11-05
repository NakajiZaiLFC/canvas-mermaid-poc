import { EditorState, MapMode } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightSpecialChars } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo } from '@codemirror/commands'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { bracketMatching } from '@codemirror/language'
import { DiagramRenderer } from '../diagrams/renderer'
import { renderMermaid } from '../diagrams/mermaid'
import { livePreview } from './preview'

export interface AITarget { kind: 'generate' | 'repair'; anchor: number | null; id?: string; source?: string }

export function createEditor(parent: HTMLElement, initial: string, callbacks: {
  change: (markdown: string) => void
  commands: () => void
  help: () => void
}) {
  const renderer = new DiagramRenderer(renderMermaid)
  const preview = livePreview(renderer)
  const targets = new Set<AITarget>()
  const view = new EditorView({ parent, state: EditorState.create({ doc: initial, extensions: [
    markdown(), history(), drawSelection(), highlightSpecialChars(), bracketMatching(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'ドキュメント', spellcheck: 'false', autocapitalize: 'off' }),
    ...preview.extensions,
    keymap.of([
      { key: 'Mod-Shift-p', run: () => { callbacks.commands(); return true } },
      { key: 'F1', run: () => { callbacks.help(); return true } },
      { key: 'Escape', run: preview.exit },
      { key: 'Mod-Shift-z', run: redo, preventDefault: true },
      ...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab,
    ]),
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return
      targets.forEach(target => {
        if (target.anchor === null) return
        let deleted = false
        update.changes.iterChangedRanges((from, to) => { if (to > from && from <= target.anchor! && to >= target.anchor!) deleted = true })
        target.anchor = deleted ? null : update.changes.mapPos(target.anchor, 1, MapMode.TrackDel)
      })
      callbacks.change(update.state.doc.toString())
    }),
  ] }) })
  view.focus()
  return {
    view, renderer,
    blocks: () => view.state.field(preview.field).blocks,
    selectedDiagram: () => view.state.field(preview.field).blocks.find(b => view.state.selection.main.head >= b.from && view.state.selection.main.head <= b.to),
    captureTarget(kind: 'generate' | 'repair'): AITarget {
      const block = view.state.field(preview.field).blocks.find(b => view.state.selection.main.head >= b.from && view.state.selection.main.head <= b.to)
      if (kind === 'repair' && !block) throw new Error('修復する図を先に選んでください。')
      const target: AITarget = { kind, anchor: block?.to ?? view.state.doc.lineAt(view.state.selection.main.to).to, id: block?.id, source: block?.source }
      targets.add(target)
      return target
    },
    releaseTarget(target: AITarget) { targets.delete(target) },
    applyCandidate(target: AITarget, code: string) {
      const fence = '`'.repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), m => m[0].length + 1)))
      const fenced = `${fence}mermaid\n${code}\n${fence}`
      let from: number, to: number, insert: string
      if (target.kind === 'repair') {
        const current = view.state.field(preview.field).blocks.find(b => b.id === target.id)
        if (!current || current.source !== target.source) throw new Error('対象の図が変更または削除されています。最新の図を選び、修復をやり直してください。')
        from = current.from; to = current.to; insert = fenced
      } else {
        if (target.anchor === null) throw new Error('挿入位置が削除されています。候補のコードをコピーし、挿入位置を選び直してください。')
        from = to = target.anchor; insert = `\n\n${fenced}\n\n`
      }
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: 'input', scrollIntoView: true })
      view.focus()
    },
    replace(markdown: string) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown.replace(/\r\n?/g, '\n') }, selection: { anchor: 0 }, userEvent: 'input' })
      view.focus()
    },
    insertDiagram() {
      const at = view.state.doc.lineAt(view.state.selection.main.to).to
      const text = '\n\n```mermaid\nflowchart LR\n  A[はじめ] --> B[つぎ]\n```\n\n'
      view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + 13 }, userEvent: 'input', scrollIntoView: true })
      view.focus()
    },
    destroy() { view.destroy(); renderer.destroy() },
  }
}
export type CanvasEditor = ReturnType<typeof createEditor>
