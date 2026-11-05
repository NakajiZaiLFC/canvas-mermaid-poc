import type { ChangeDesc, EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
export interface DiagramBlock { id: string; from: number; to: number; sourceFrom: number; source: string; closed: boolean }
export function findDiagrams(state: EditorState): Omit<DiagramBlock, 'id'>[] {
  const blocks: Omit<DiagramBlock, 'id'>[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 40) ?? syntaxTree(state)
  tree.iterate({ enter(node) {
    if (node.name !== 'FencedCode') return
    const info = node.node.getChild('CodeInfo')
    if (!info || state.sliceDoc(info.from, info.to).trim().toLowerCase() !== 'mermaid') return false
    const marks = node.node.getChildren('CodeMark')
    const sourceFrom = Math.min(state.doc.lineAt(node.from).to + 1, node.to)
    const closed = marks.length > 1
    const end = closed ? Math.max(sourceFrom, state.doc.lineAt(marks[1].from).from - 1) : node.to
    blocks.push({ from: node.from, to: node.to, sourceFrom, source: state.sliceDoc(sourceFrom, end), closed })
    return false
  } })
  return blocks
}
let serial = 0
export function reconcileBlocks(old: DiagramBlock[], next: Omit<DiagramBlock, 'id'>[], changes?: ChangeDesc): DiagramBlock[] {
  const mapped = old.filter(block => {
    let deleted = false
    changes?.iterChangedRanges((from, to) => {
      if (to > from && from <= block.from && to >= block.to) deleted = true
    })
    return !deleted
  }).map(b => ({ ...b, from: changes ? changes.mapPos(b.from, 1) : b.from }))
  const used = new Set<string>()
  return next.map(block => {
    const previous = mapped.find(b => b.from === block.from && !used.has(b.id))
    if (previous) used.add(previous.id)
    return { ...block, id: previous?.id ?? `diagram-${++serial}` }
  })
}
