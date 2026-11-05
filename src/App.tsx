import { useEffect, useRef, useState } from 'react'
import { createEditor, type CanvasEditor } from './editor/createEditor'
import { loadDocument, saveDocument } from './persistence'
import { SAMPLE } from './sample'
import { AiPanel } from './ai/AiPanel'

export function App() {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<CanvasEditor | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDialogElement>(null)
  const [menu, setMenu] = useState<'commands' | 'help' | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [ai, setAi] = useState<'generate' | 'repair' | null>(null)

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: string | undefined
    let canSave = true
    const flush = () => {
      clearTimeout(timer)
      if (pending === undefined || !canSave) return
      const text = pending
      pending = undefined
      void saveDocument(text).then(() => setNotice('')).catch(() => setNotice('端末に保存できません。操作一覧からMarkdownを書き出してください。'))
    }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', flush)
    void loadDocument().catch(error => {
      canSave = false
      setNotice(`保存データを読み込めません。自動保存を停止しています。${error instanceof Error ? error.message : ''}`)
      return null
    }).then(saved => {
      if (disposed || !host.current) return
      editor.current = createEditor(host.current, saved ?? SAMPLE, {
        change: markdown => { pending = markdown; clearTimeout(timer); timer = setTimeout(flush, 250) },
        commands: () => setMenu('commands'), help: () => setMenu('help'),
      })
      setLoading(false)
    })
    return () => {
      disposed = true
      flush()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', flush)
      editor.current?.destroy()
    }
  }, [])

  useEffect(() => { if (menu) menuRef.current?.showModal(); else menuRef.current?.close() }, [menu])
  const close = () => { setMenu(null); editor.current?.view.focus() }
  const exportMarkdown = () => {
    if (!editor.current) return
    const blob = new Blob([editor.current.view.state.doc.toString()], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'canvas.md'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    close()
  }
  return <>
    <main aria-label="Canvas" className="paper">
      {loading && <p className="loading">一枚のキャンバスを開いています…</p>}
      <div ref={host} />
    </main>
    {notice && <div className="notice" role="status">{notice}</div>}
    {ai && editor.current && <AiPanel key={ai} editor={editor.current} kind={ai} onClose={() => { setAi(null); editor.current?.view.focus() }} />}
    <input ref={importInput} hidden type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" aria-label="Markdownを読み込む" onChange={async e => {
      const file = e.target.files?.[0]
      if (!file) return
      try { editor.current?.replace(await file.text()); setNotice('読み込みました。元に戻す操作で取り消せます。') }
      catch { setNotice('ファイルを読み込めませんでした。') }
      e.target.value = ''
    }} />
    <dialog ref={menuRef} className="command-dialog" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="dialog-heading"><span className="eyebrow">CANVAS</span><button className="close-button" aria-label="閉じる" onClick={close}>×</button></div>
      <h2>{menu === 'help' ? '考えることに、集中する。' : 'この一枚で、できること。'}</h2>
      {menu === 'help' ? <div className="help-copy">
        <p>Markdownで文章を書き、Mermaidで図を描きます。図を選ぶと、その場でコードを編集できます。</p>
        <dl><dt>操作一覧</dt><dd>⌘ / Ctrl + Shift + P</dd><dt>図の編集を終える</dt><dd>Esc</dd><dt>元に戻す</dt><dd>⌘ / Ctrl + Z</dd><dt>ヘルプ</dt><dd>F1</dd></dl>
        <p>文書はこのブラウザに自動保存されます。大切な内容はMarkdownで書き出してください。図が横に長いときは、図の中を横スクロールできます。</p>
        <button onClick={() => setMenu('commands')}>操作一覧を開く</button>
      </div> : <div className="command-list">
        <button onClick={() => { close(); editor.current?.insertDiagram() }}><span>図を追加する</span><small>Mermaid</small></button>
        <button onClick={() => { close(); setAi('generate') }}><span>AIで図を作る</span><small>端末内で実行</small></button>
        <button disabled={!editor.current?.selectedDiagram()} onClick={() => { close(); setAi('repair') }}><span>この図をAIで修復</span><small>図を選択して実行</small></button>
        <button onClick={exportMarkdown}><span>Markdownを書き出す</span><small>.md</small></button>
        <button onClick={() => { close(); importInput.current?.click() }}><span>Markdownを読み込む</span><small>文書を置き換え · Undoで復帰</small></button>
        <button onClick={() => setMenu('help')}><span>使い方</span><small>F1</small></button>
      </div>}
      <p className="dialog-footer">あなたの文章は、このブラウザの中に。</p>
    </dialog>
  </>
}
