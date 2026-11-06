import { useEffect, useState } from 'react'
import type { CanvasEditor } from './editor/createEditor'
import { sampleText, searchScore, templates } from './editor/assistance'

interface Props {
  editor: CanvasEditor | null
  close: () => void
  ai: (kind: 'generate' | 'repair') => void
  exportMarkdown: () => void
  importMarkdown: () => void
  help: () => void
}
export function CommandMenu({ editor, close, ai, exportMarkdown, importMarkdown, help }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const items = [
    { id: 'add', title: '図を追加する', description: 'フロー図から始める', aliases: 'mermaid 図 作成', group: '操作', run: () => { close(); editor?.insertDiagram() } },
    { id: 'generate', title: 'AIで図を作る', description: '日本語で説明して候補を作る', aliases: 'ai 生成 作成', group: 'AI', run: () => { close(); ai('generate') } },
    { id: 'repair', title: 'この図をAIで修復', description: editor?.selectedDiagram() ? '選んだ図の構文を直す' : '先に図を選ぶと使えます', aliases: 'ai 修復 エラー 修正', group: 'AI', disabled: !editor?.selectedDiagram(), run: () => { close(); ai('repair') } },
    ...templates.map(item => ({ ...item, group: item.group as string, run: () => { close(); editor?.insertTemplate(item) } })),
    { id: 'complete', title: 'この位置の記法を補完', description: '図の中ではノード・分岐・接続など', aliases: '補完 候補 記法', group: '操作', run: () => { close(); editor?.complete() } },
    { id: 'export', title: 'Markdownを書き出す', description: 'この一枚を.mdファイルで保存', aliases: '保存 ダウンロード export markdown', group: '操作', run: exportMarkdown },
    { id: 'import', title: 'Markdownを読み込む', description: '文書を置き換え · Undoで復帰', aliases: '開く import markdown', group: '操作', run: () => { close(); importMarkdown() } },
    { id: 'help', title: '使い方', description: '記法とキーボード操作', aliases: 'ヘルプ help 操作', group: '操作', run: help },
  ]
  const results = items.map(item => ({ ...item, score: searchScore(query, `${item.id} ${item.title} ${item.aliases} ${item.group}`) }))
    .filter(item => item.score >= 0).sort((a, b) => b.score - a.score)
  const selected = results[Math.min(active, results.length - 1)]
  useEffect(() => { document.getElementById(`command-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active])
  const run = () => { if (selected && !('disabled' in selected && selected.disabled)) selected.run() }
  return <>
    <input className="command-search" aria-label="挿入・操作を検索" placeholder="分岐、太字、保存、AI…" value={query}
      aria-controls="command-results" aria-describedby="command-selection" onChange={e => { setQuery(e.target.value); setActive(0) }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setActive(value => Math.max(0, Math.min(results.length - 1, value + (e.key === 'ArrowDown' ? 1 : -1))))
        } else if (e.key === 'Enter') { e.preventDefault(); run() }
      }} />
    <div className="command-list" id="command-results">
      {results.map((item, index) => <button key={item.id} id={`command-${index}`} className={selected?.id === item.id ? 'command-active' : ''}
        aria-current={selected?.id === item.id ? true : undefined} disabled={'disabled' in item && item.disabled} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={item.run}>
        <span><span className="command-title">{item.title}</span><span className="command-description">{item.description}</span></span><small>{item.group}</small>
      </button>)}
      {!results.length && <p className="command-empty" role="status">候補がありません。「図」「見出し」「保存」などで探せます。</p>}
    </div>
    {selected && 'source' in selected && <pre className="command-preview" aria-label="挿入例">{sampleText(selected.source)}</pre>}
    <p id="command-selection" className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{selected ? `現在の候補: ${selected.title}。${selected.description}。${'disabled' in selected && selected.disabled ? '現在は使えません' : 'Enterで実行'}` : '候補はありません'}</p>
    <p className="command-hint">↑↓で選択 · Enterで実行 · Escで閉じる</p>
  </>
}
