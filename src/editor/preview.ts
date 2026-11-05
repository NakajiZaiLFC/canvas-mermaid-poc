import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view'
import { findDiagrams, reconcileBlocks, type DiagramBlock } from './document'
import { DiagramRenderer } from '../diagrams/renderer'

const composing = StateEffect.define<boolean>()
const collapse = StateEffect.define<string>()
interface PreviewState { blocks: DiagramBlock[]; decorations: DecorationSet; composing: boolean; collapsed?: string }
const cleanup = new WeakMap<HTMLElement, () => void>()

class FigureWidget extends WidgetType {
  constructor(readonly id: string, readonly renderer: DiagramRenderer, readonly editing: boolean,
    readonly edit: (view: EditorView, id: string) => void) { super() }
  eq(other: FigureWidget) { return this.id === other.id && this.editing === other.editing }
  toDOM(view: EditorView) {
    const figure = document.createElement('figure')
    figure.className = 'diagram'
    figure.dataset.blockId = this.id
    figure.setAttribute('aria-label', '図を編集')
    figure.setAttribute('role', 'button')
    figure.tabIndex = 0
    const canvas = document.createElement('div')
    canvas.className = 'diagram-canvas'
    const status = document.createElement('div')
    status.className = 'diagram-status'
    const error = document.createElement('div')
    error.className = 'diagram-error'
    error.setAttribute('role', 'status')
    figure.append(canvas, status, error)
    const open = () => this.edit(view, this.id)
    figure.addEventListener('mousedown', e => { e.preventDefault(); open() })
    figure.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
    let lastSvg: string | undefined
    let lastGeneration = 0
    let frame = 0
    const resize = () => {
      const svg = canvas.querySelector('svg')
      if (!svg) return
      const box = svg.viewBox.baseVal
      if (!box.width || !box.height) return
      const scale = Math.max(0.8, Math.min(1, canvas.clientWidth / box.width))
      svg.style.width = `${box.width * scale}px`
      svg.style.height = `${box.height * scale}px`
      svg.style.maxWidth = 'none'
    }
    let resizeFrame = 0
    let previousWidth = -1
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width === undefined || width === previousWidth) return
      previousWidth = width
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => { resize(); view.requestMeasure() })
    })
    observer.observe(canvas)
    const update = () => {
      const result = this.renderer.get(this.id)
      if (!result) return
      figure.dataset.state = result.error ? 'error' : result.pending ? 'pending' : 'ready'
      if (result.svg && result.svg !== lastSvg) {
        canvas.innerHTML = result.svg
        lastSvg = result.svg
        resize()
        view.requestMeasure()
      }
      error.hidden = !result.error
      error.textContent = result.error ? `構文を確認してください · ${result.error.slice(0, 280)}` : ''
      status.hidden = Boolean(result.svg) || Boolean(result.error)
      status.textContent = result.pending ? '図を描いています…' : ''
      if (!result.pending && !result.error && result.generation !== lastGeneration) {
        lastGeneration = result.generation
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          if (!figure.isConnected || this.renderer.get(this.id) !== result) return
          figure.dataset.generation = String(result.generation)
          if (!result.measured) {
            performance.measure('canvas:diagram', { start: result.changedAt, detail: { block: this.id } })
            result.measured = true
          }
          if (performance.getEntriesByName('canvas:diagram').length > 200) performance.clearMeasures('canvas:diagram')
        })
      }
    }
    const unsubscribe = this.renderer.subscribe(this.id, update)
    cleanup.set(figure, () => { unsubscribe(); observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame) })
    update()
    return figure
  }
  destroy(dom: HTMLElement) { cleanup.get(dom)?.(); cleanup.delete(dom) }
  ignoreEvent() { return true }
}

class Bullet extends WidgetType {
  toDOM() { const span = document.createElement('span'); span.className = 'list-bullet'; span.textContent = '•'; return span }
}

export function livePreview(renderer: DiagramRenderer) {
  function edit(view: EditorView, id: string) {
    const block = view.state.field(field).blocks.find(b => b.id === id)
    if (!block) return
    view.dispatch({ selection: { anchor: block.sourceFrom }, effects: collapse.of(''), scrollIntoView: false })
    view.focus()
  }
  function build(state: EditorState, blocks: DiagramBlock[], isComposing: boolean, collapsed?: string) {
    const decorations: Range<Decoration>[] = []
    const selection = state.selection
    const intersects = (from: number, to: number) => selection.ranges.some(s => s.from <= to && s.to >= from)
    for (const block of blocks) {
      const active = !block.closed || ((intersects(block.from, block.to) || isComposing) && collapsed !== block.id)
      const widget = new FigureWidget(block.id, renderer, active, edit)
      if (active) {
        for (let pos = state.doc.lineAt(block.from).from; pos <= block.to;) {
          const line = state.doc.lineAt(pos)
          decorations.push(Decoration.line({ class: 'mermaid-source' }).range(line.from))
          pos = line.to + 1
        }
        decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(block.to))
      } else {
        decorations.push(Decoration.replace({ widget, block: true }).range(block.from, block.to))
      }
    }
    syntaxTree(state).iterate({ enter(node) {
      if (blocks.some(b => node.from >= b.from && node.to <= b.to)) return false
      const line = state.doc.lineAt(node.from)
      const active = isComposing || intersects(line.from, state.doc.lineAt(node.to).to)
      if (/^ATXHeading[1-6]$/.test(node.name)) {
        decorations.push(Decoration.line({ class: `md-heading md-h${node.name.slice(-1)}` }).range(line.from))
      }
      if (node.name === 'StrongEmphasis' || node.name === 'InlineCode' || node.name === 'Emphasis') {
        decorations.push(Decoration.mark({ class: node.name === 'StrongEmphasis' ? 'md-strong' : node.name === 'InlineCode' ? 'md-inline-code' : 'md-emphasis' }).range(node.from, node.to))
      }
      if (node.name === 'FencedCode') {
        for (let pos = line.from; pos <= node.to;) {
          const current = state.doc.lineAt(pos)
          decorations.push(Decoration.line({ class: 'md-code' }).range(pos))
          pos = current.to + 1
        }
        if (!active) {
          const marks = node.node.getChildren('CodeMark')
          for (const mark of marks) {
            const fenceLine = state.doc.lineAt(mark.from)
            decorations.push(Decoration.replace({}).range(fenceLine.from, fenceLine.to))
          }
        }
        return false
      }
      if (!active && ['HeaderMark', 'EmphasisMark', 'CodeMark'].includes(node.name)) {
        const to = node.name === 'HeaderMark' ? Math.min(node.to + 1, line.to) : node.to
        decorations.push(Decoration.replace({}).range(node.from, to))
      }
      if (node.name === 'ListItem') decorations.push(Decoration.line({ class: 'md-list' }).range(line.from))
      if (!active && node.name === 'ListMark' && /^[-+*]$/.test(state.sliceDoc(node.from, node.to))) {
        decorations.push(Decoration.replace({ widget: new Bullet() }).range(node.from, node.to))
      }
    } })
    return Decoration.set(decorations, true)
  }
  const field = StateField.define<PreviewState>({
    create(state) {
      const blocks = reconcileBlocks([], findDiagrams(state))
      return { blocks, composing: false, decorations: build(state, blocks, false) }
    },
    update(value, tr) {
      let isComposing = value.composing
      let collapsed = tr.selection || tr.docChanged ? undefined : value.collapsed
      for (const effect of tr.effects) {
        if (effect.is(composing)) isComposing = effect.value
        if (effect.is(collapse)) collapsed = effect.value
      }
      const blocks = tr.docChanged ? reconcileBlocks(value.blocks, findDiagrams(tr.state), tr.changes) : value.blocks
      if (!tr.docChanged && !tr.selection && !tr.effects.length) return value
      // Keep the DOM around the IME composition stable; rebuild once it commits.
      if (isComposing) return { blocks, composing: true, collapsed, decorations: value.decorations.map(tr.changes) }
      return { blocks, composing: isComposing, collapsed, decorations: build(tr.state, blocks, isComposing, collapsed) }
    },
    provide: f => EditorView.decorations.from(f, v => v.decorations),
  })
  const sync = ViewPlugin.fromClass(class {
    ids = new Set<string>()
    constructor(view: EditorView) { this.sync(view) }
    update(update: { view: EditorView; docChanged: boolean; transactions: readonly { effects: readonly StateEffect<unknown>[] }[] }) {
      if (update.view.state.field(field).composing) return
      if (update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(composing)))) this.sync(update.view)
    }
    sync(view: EditorView) {
      const blocks = view.state.field(field).blocks
      const ids = new Set(blocks.map(b => b.id))
      this.ids.forEach(id => { if (!ids.has(id)) renderer.remove(id) })
      this.ids = ids
      blocks.forEach(b => renderer.request(b.id, b.source))
    }
  })
  return {
    field,
    extensions: [field, sync, EditorView.domEventHandlers({
      compositionstart: (_event, view) => { view.dispatch({ effects: composing.of(true) }); return false },
      compositionend: (_event, view) => { setTimeout(() => { if (view.dom.isConnected) view.dispatch({ effects: composing.of(false) }) }, 0); return false },
    })],
    exit(view: EditorView) {
      const block = view.state.field(field).blocks.find(b => view.state.selection.main.head >= b.from && view.state.selection.main.head <= b.to)
      if (!block || view.composing) return false
      const needsLine = block.to === view.state.doc.length
      view.dispatch({
        changes: needsLine ? { from: block.to, insert: '\n\n' } : undefined,
        selection: { anchor: block.to + (needsLine ? 2 : 1) }, effects: collapse.of(block.id),
      })
      return true
    },
  }
}
