import { Prec, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { acceptCompletion, autocompletion, clearSnippet, closeCompletion, CompletionContext, moveCompletionSelection, nextSnippetField, prevSnippetField, selectedCompletion, snippetCompletion, snippetKeymap, startCompletion, type Completion, type CompletionResult } from '@codemirror/autocomplete'
import { findDiagrams } from './document'

interface Suggestion extends Completion { preview: string; search?: string }
const flow = 'flowchart LR\n  A[${1:はじめ}] --> B[${2:つぎ}]'
const sequence = 'sequenceDiagram\n  participant User as ${1:利用者}\n  participant API as ${2:サーバー}\n  User->>API: ${3:リクエスト}\n  API-->>User: ${4:応答}'
function template(label: string, title: string, text: string, search = ''): Suggestion {
  return { ...snippetCompletion(text, { label, displayLabel: title, detail: 'Tabで挿入', info: text.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{0\}/g, ''), type: 'keyword' }), preview: text.split('\n')[0].replace(/\$\{\d+:([^}]*)\}/g, '$1'), search: `${label} ${title} ${search}` }
}
const commands = [
  template('/flow', 'フロー図', '```mermaid\n' + flow + '\n```\n\n${0}', 'フローチャート 図 flowchart'),
  template('/sequence', 'シーケンス図', '```mermaid\n' + sequence + '\n```\n\n${0}', '処理 順序'),
  template('/heading', '見出し', '# ${1:見出し}\n\n${0}', 'h1'),
  template('/h2', '小見出し', '## ${1:小見出し}\n\n${0}'),
  template('/list', '箇条書き', '- ${1:項目}', 'bullet'),
  template('/number', '番号付きリスト', '1. ${1:項目}', '番号 list'),
  template('/bold', '太字', '**${1:強調する言葉}**${0}'),
  template('/inline', 'インラインコード', '`${1:code}`${0}'),
  template('/code', 'コードブロック', '```${1:text}\n${2:コード}\n```\n\n${0}'),
]
const composingEffect = StateEffect.define<boolean>()
const composing = StateField.define({ create: () => false, update: (value, tr) => tr.effects.reduce((v, e) => e.is(composingEffect) ? e.value : v, value) })
const isComposing = (view: EditorView) => view.composing || view.state.field(composing, false) === true

function identifiers(source: string, sequenceMode: boolean): string[] {
  const found = new Set<string>()
  for (const raw of source.split('\n').slice(1)) {
    const line = raw.replace(/%%.*$/, '').replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|"[^"]*"/g, '')
    if (sequenceMode) {
      const declaration = /^\s*(?:participant|actor)\s+([\p{L}_][\p{L}\p{N}_]*)/u.exec(line)
      if (declaration) found.add(declaration[1])
      const connection = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*[-<>=x)]+\s*([\p{L}_][\p{L}\p{N}_]*)/u.exec(line)
      if (connection) { found.add(connection[1]); found.add(connection[2]) }
    } else {
      if (/^\s*(?:subgraph|end|style|class|click|linkStyle|direction)\b/.test(line)) continue
      for (const part of line.split(/\s*(?:-->|---|-\.->|==>|--[^-\n]+-->)\s*/)) {
        const match = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(part.replace(/\|[^|]*\|/g, ''))
        if (match) found.add(match[1])
      }
    }
  }
  return [...found].slice(0, 200)
}

export function canvasCompletion(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context
  if (!state.selection.main.empty || state.field(composing, false) || context.view?.composing) return null
  const line = state.doc.lineAt(pos), before = state.sliceDoc(line.from, pos)
  const block = findDiagrams(state).find(b => pos >= b.from && pos <= b.to)
  if (block && pos >= block.sourceFrom && !(block.closed && pos >= state.doc.lineAt(block.to).from)) {
    if (before.includes('%%') || /(?:\[[^\]]*|\([^)]*|\{[^}]*|"[^"]*)$/.test(before)) return null
    const leading = before.match(/^\s*/)?.[0].length ?? 0
    const header = state.doc.lineAt(block.sourceFrom)
    if (line.number === header.number) {
      const direction = /^\s*(?:flowchart|graph)\s+(\w*)$/.exec(before)
      if (direction) return { from: pos - direction[1].length, to: pos + (state.sliceDoc(pos, line.to).match(/^\w*/)?.[0].length ?? 0), options: ['LR', 'TD', 'RL', 'BT', 'TB'].map(label => ({ label, detail: { LR: '左→右', TD: '上→下', RL: '右→左', BT: '下→上', TB: '上→下' }[label] })), filter: true }
      if (!/^\s*[A-Za-z]*$/.test(before)) return null
      const keywordEnd = pos + (state.sliceDoc(pos, line.to).match(/^[A-Za-z]*/)?.[0].length ?? 0)
      const hasContent = state.sliceDoc(keywordEnd, line.to).trim() || block.source.split('\n').slice(1).some(line => line.trim())
      if (hasContent) return { from: line.from + leading, to: keywordEnd, options: ['flowchart', 'graph', 'sequenceDiagram'].map(label => ({ label })) }
      return { from: line.from + leading, to: line.to, options: [template('flowchart LR', 'flowchart LR', flow), template('flowchart TD', 'flowchart TD', flow.replace('LR', 'TD')), template('sequenceDiagram', 'sequenceDiagram', sequence)] }
    }
    const sequenceMode = /^\s*sequenceDiagram/.test(block.source)
    const arrow = context.matchBefore(/[-.=<>]+/)
    if (arrow) return { from: arrow.from, to: pos + (state.sliceDoc(pos, line.to).match(/^[-.=<>]+/)?.[0].length ?? 0), options: (sequenceMode ? ['->>', '-->>', '-x'] : ['-->', '-.->', '==>', '---']).map(label => ({ label, detail: '接続', type: 'operator' })) }
    const word = context.matchBefore(/[\p{L}\p{N}_]+/u)
    if (!word && !context.explicit) return null
    const from = word?.from ?? pos
    const to = pos + (state.sliceDoc(pos, line.to).match(/^[\p{L}\p{N}_]+/u)?.[0].length ?? 0)
    const options = identifiers(block.source, sequenceMode).filter(label => label !== state.sliceDoc(from, to)).map(label => ({ label, detail: 'この図のノード', type: 'variable' }))
    return options.length ? { from, to, options } : null
  }
  // A closing fence belongs to the preceding code block, never to a new template.
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node.parent && !['FencedCode', 'CodeBlock', 'InlineCode'].includes(node.name)) node = node.parent
  const inCode = ['FencedCode', 'CodeBlock', 'InlineCode'].includes(node.name)
  if (/^\s*```(?:m(?:e(?:r(?:m(?:a(?:i(?:d)?)?)?)?)?)?)?$/.test(before) && (!inCode || node.from === line.from)) {
    const indent = before.length - before.trimStart().length
    const fresh = line.to === state.doc.length
    return { from: line.from + indent, to: line.to, options: [fresh ? template('```mermaid', 'Mermaid · フロー図', '```mermaid\n' + flow + '\n```\n\n${0}') : { label: '```mermaid', detail: '図のコードブロック' }] }
  }
  if (inCode) return null
  const slash = /^\s*\/([^\s/]*)$/.exec(before)
  if (slash) {
    const query = slash[1].toLowerCase()
    const options = commands.filter(c => c.search!.toLowerCase().includes(query))
    return options.length ? { from: line.from + before.indexOf('/'), to: pos + (state.sliceDoc(pos, line.to).match(/^[^\s/]*/)?.[0].length ?? 0), options, filter: false } : null
  }
  if (/^#{1,3}$/.test(before)) return { from: line.from, to: pos, options: [template(before, '見出し', before + ' ${1:見出し}\n\n${0}')] }
  return null
}

class Ghost extends WidgetType {
  constructor(readonly text: string) { super() }
  eq(other: Ghost) { return this.text === other.text }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'completion-ghost'; span.setAttribute('aria-hidden', 'true'); span.textContent = this.text
    return span
  }
}
const ghost = ViewPlugin.fromClass(class {
  decorations: DecorationSet = Decoration.none
  constructor(view: EditorView) { this.update({ view }) }
  update({ view }: { view: EditorView }) {
    this.decorations = Decoration.none
    if (isComposing(view) || !view.hasFocus) return
    const selected = selectedCompletion(view.state) as Suggestion | null
    if (!selected) return
    const pos = view.state.selection.main.head
    if (view.state.doc.lineAt(pos).to !== pos) return
    const result = canvasCompletion(new CompletionContext(view.state, pos, false, view))
    if (!result) return
    const typed = view.state.sliceDoc(result.from, pos)
    const preview = selected.preview ?? (typeof selected.apply === 'string' ? selected.apply : selected.label)
    const suffix = preview.startsWith(typed) ? preview.slice(typed.length) : typed.startsWith('/') ? ` → ${selected.displayLabel}` : ''
    if (suffix) this.decorations = Decoration.set([Decoration.widget({ widget: new Ghost(suffix.slice(0, 70) + '  ⇥'), side: 1 }).range(pos)])
  }
}, { decorations: value => value.decorations })

export function inputAssistance(): Extension {
  return [composing, autocompletion({ override: [canvasCompletion], defaultKeymap: false, activateOnTypingDelay: 60, interactionDelay: 0, maxRenderedOptions: 8, icons: false }), ghost,
    snippetKeymap.of([]),
    Prec.highest(keymap.of([
      { key: 'Tab', run: view => isComposing(view) || acceptCompletion(view) || nextSnippetField(view) },
      { key: 'Shift-Tab', run: view => isComposing(view) || prevSnippetField(view) },
      { key: 'Escape', run: view => isComposing(view) || closeCompletion(view) || clearSnippet(view) },
      { key: 'ArrowDown', run: view => !isComposing(view) && moveCompletionSelection(true)(view) },
      { key: 'ArrowUp', run: view => !isComposing(view) && moveCompletionSelection(false)(view) },
      { key: 'Ctrl-Space', run: view => !isComposing(view) && startCompletion(view) },
    ])),
    EditorView.domEventHandlers({
      compositionstart: (_e, view) => { view.dispatch({ effects: composingEffect.of(true) }); closeCompletion(view); return false },
      compositionend: (_e, view) => { setTimeout(() => { if (view.dom.isConnected) view.dispatch({ effects: composingEffect.of(false) }) }, 0); return false },
    }),
  ]
}
