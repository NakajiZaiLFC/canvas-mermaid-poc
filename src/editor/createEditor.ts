import { EditorState, MapMode } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightSpecialChars } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, isolateHistory } from '@codemirror/commands'
import { snippet, startCompletion } from '@codemirror/autocomplete'
import type { Template } from './assistance'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { bracketMatching, syntaxTree } from '@codemirror/language'
import { DiagramRenderer } from '../diagrams/renderer'
import { renderMermaid } from '../diagrams/mermaid'
import { livePreview } from './preview'
import { inputAssistance } from './completion'
import type { DiagramRecovery, DocumentSnapshot } from '../persistence'

export interface AITarget { kind: 'generate' | 'repair'; anchor: number | null; id?: string; source?: string }

export function createEditor(parent: HTMLElement, initial: string, callbacks: {
  change: (markdown: string) => void
  commands: () => void
  help: () => void
  settled?: () => void
}, recovery: DiagramRecovery[] = []) {
  const renderer = new DiagramRenderer(renderMermaid, callbacks.settled)
  const preview = livePreview(renderer, recovery)
  const targets = new Set<AITarget>()
  const view = new EditorView({ parent, state: EditorState.create({ doc: initial, extensions: [
    markdown(), history(), EditorState.allowMultipleSelections.of(true), drawSelection(), highlightSpecialChars(), bracketMatching(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'ドキュメント', spellcheck: 'false', autocapitalize: 'off' }),
    ...preview.extensions, inputAssistance(),
    keymap.of([
      { key: 'Mod-Shift-p', run: () => { callbacks.commands(); return true } },
      { key: 'Mod-k', run: () => { callbacks.commands(); return true } },
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
    snapshot(): DocumentSnapshot {
      const blocks = view.state.field(preview.field).blocks
      return { markdown: view.state.doc.toString(), recovery: blocks.flatMap(b => {
        const result = renderer.get(b.id)
        const lastValidSource = result?.lastValidSource ?? result?.recoverySource
        return lastValidSource ? [{ from: b.from, source: b.source, lastValidSource }] : []
      }) }
    },
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
    complete() { view.focus(); startCompletion(view) },
    insertTemplate(item: Template) {
      view.dispatch({ annotations: isolateHistory.of('before') })
      const selection = view.state.selection.main
      const wrappers: Record<string, string> = { bold: '**', italic: '*', inline: '`' }
      const wrap = wrappers[item.id]
      if (wrap && !selection.empty) {
        const insert = wrap + view.state.sliceDoc(selection.from, selection.to) + wrap
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert }, selection: { anchor: selection.from + insert.length }, userEvent: 'input' })
      } else if (wrap) {
        snippet(item.source)(view, null, selection.head, selection.head)
      } else {
        const line = view.state.doc.lineAt(selection.head)
        let node = syntaxTree(view.state).resolveInner(selection.head, -1)
        while (node.parent && !['FencedCode', 'CodeBlock'].includes(node.name)) node = node.parent
        const inCode = ['FencedCode', 'CodeBlock'].includes(node.name)
        const at = inCode ? node.to : line.to
        let prefix = inCode || line.text.length ? '\n\n' : ''
        if (node.name === 'FencedCode' && node.getChildren('CodeMark').length < 2) {
          const fence = view.state.doc.lineAt(node.from).text.match(/^\s*(`{3,}|~{3,})/)?.[1]
          if (fence) prefix = `\n${fence}\n\n`
        }
        // Start a real blank line before applying the snippet, so indentation
        // from the preceding code line cannot turn the new block into code.
        if (prefix) view.dispatch({ changes: { from: at, insert: prefix }, userEvent: 'input.complete' })
        const start = at + prefix.length
        snippet(item.source + (start < view.state.doc.length ? '\n' : ''))(view, null, start, start)
      }
      view.dispatch({ annotations: isolateHistory.of('after') })
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
