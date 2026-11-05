import { useEffect, useRef, useState } from 'react'
import type { CanvasEditor } from '../editor/createEditor'
import { createLocalModel, localAvailability } from './local'
import { runTask, type Candidate } from './harness'
import { renderMermaid } from '../diagrams/mermaid'

let candidateSerial = 0
export function AiPanel({ editor, kind, onClose }: { editor: CanvasEditor; kind: 'generate' | 'repair'; onClose: () => void }) {
  const [target] = useState(() => editor.captureTarget(kind))
  const [availability, setAvailability] = useState<Availability | 'checking'>('checking')
  const [instruction, setInstruction] = useState('')
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let disposed = false
    input.current?.focus()
    void localAvailability().then(value => { if (!disposed) setAvailability(value) }).catch(e => {
      if (!disposed) { setAvailability('unavailable'); setError(e instanceof Error ? e.message : String(e)) }
    })
    return () => { disposed = true; abort.current?.abort(); editor.releaseTarget(target) }
  }, [editor, target])

  const run = async () => {
    const controller = new AbortController()
    abort.current?.abort()
    abort.current = controller
    setBusy(true); setError(''); setCandidate(null); setProgress(null)
    let destroy: (() => void) | undefined
    const timeout = setTimeout(() => controller.abort(new Error('AIの処理が時間内に完了しませんでした。もう一度お試しください。')), 180_000)
    try {
      // Called directly from the button gesture; create() may require activation for download.
      const session = await createLocalModel(controller.signal, setProgress)
      destroy = session.destroy
      setAvailability('available'); setProgress(null)
      const task = kind === 'repair'
        ? { kind, source: target.source!, error: editor.renderer.get(target.id!)?.error ?? '構文を検証し、必要な修復だけ行ってください。', instruction }
        : { kind, instruction }
      const result = await runTask(task, session.model, code => renderMermaid(code, `candidate-${++candidateSerial}`), controller.signal)
      if (!controller.signal.aborted) setCandidate(result)
    } catch (e) {
      if (abort.current === controller) setError(controller.signal.aborted ? '中止しました。文書は変更していません。' : e instanceof Error ? e.message : String(e))
    } finally {
      clearTimeout(timeout); destroy?.()
      if (abort.current === controller) { setBusy(false); setProgress(null) }
    }
  }
  const unavailable = availability === 'unavailable'
  return <section className="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-title" onKeyDown={e => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.stopPropagation(); onClose() }
  }}>
    <div className="dialog-heading"><span className="eyebrow">ON-DEVICE AI</span><button className="close-button" aria-label="AIを閉じる" onClick={onClose}>×</button></div>
    <h2 id="ai-title">{kind === 'generate' ? '言葉から、図のたたき台を。' : 'この図の構文を、整える。'}</h2>
    <p className="ai-description">{kind === 'generate' ? '作りたい図を日本語で。候補を確認してから挿入します。' : '対象のコードとエラーだけを使います。変更箇所を確認してから置き換えます。'}</p>
    {unavailable ? <div className="ai-unavailable" role="status">
      この端末では日本語の端末内AIを利用できません。対応Chromeと、モデル導入に必要な空き容量・メモリをご確認ください。
      <a href="https://developer.chrome.com/docs/ai/prompt-api#hardware-requirements" target="_blank" rel="noreferrer">対応条件を見る ↗</a>
      <span>MarkdownとMermaidの編集はそのまま利用できます。</span>
    </div> : <>
      <label className="visually-hidden" htmlFor="ai-instruction">AIへの指示</label>
      <textarea id="ai-instruction" ref={input} value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={4000} placeholder={kind === 'generate' ? '利用者がWebからAPIを経由してDBに保存する図' : '補足があれば入力（省略可）'} rows={3} />
      {(availability === 'downloadable' || availability === 'downloading') && <p className="ai-description">初回はChromeがモデルをダウンロードします。以下のボタンで開始します。文章を外部へ送信することはありません。</p>}
      {!candidate && <button className="primary-button" disabled={busy || availability === 'checking' || (kind === 'generate' && !instruction.trim())} onClick={() => void run()}>
        {busy ? progress === null ? '端末内で考えています…' : `モデルを準備中 ${Math.round(progress * 100)}%` : availability === 'checking' ? '対応状況を確認中…' : kind === 'generate' ? '候補を作る' : '修復候補を作る'}
      </button>}
      {busy && <button className="text-button" onClick={() => abort.current?.abort()}>中止する</button>}
    </>}
    {error && <p className="ai-error" role="status">{error}</p>}
    {candidate && <div className="ai-candidate">
      <div className="candidate-svg" dangerouslySetInnerHTML={{ __html: candidate.svg }} />
      {kind === 'repair' && <details open><summary>変更差分（− 元の行 / ＋ 候補の行）</summary><pre className="code-diff">{lineDiff(target.source!, candidate.code).map((line, i) => <span key={i} className={line.kind}>{line.kind === 'removed' ? '− ' : line.kind === 'added' ? '＋ ' : '  '}{line.text}{'\n'}</span>)}</pre></details>}
      <details open={kind === 'generate'}><summary>Mermaidコード</summary><pre className="candidate-code" tabIndex={0}>{candidate.code}</pre></details>
      <div className="ai-actions"><button className="primary-button" onClick={() => {
        try { editor.applyCandidate(target, candidate.code); onClose() }
        catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      }}>この候補を適用</button><button className="text-button" onClick={() => setCandidate(null)}>作り直す</button></div>
    </div>}
    <p className="dialog-footer">Chrome内で実行 · 外部送信なし<br />この欄を開いたまま、本文の編集を続けられます。</p>
  </section>
}

function lineDiff(before: string, after: string) {
  // Bounded line diff: preserve order, show changed regions without quadratic memory.
  const old = before.split('\n'), next = after.split('\n')
  let start = 0, end = 0
  while (start < old.length && start < next.length && old[start] === next[start]) start++
  while (end < old.length - start && end < next.length - start && old[old.length - 1 - end] === next[next.length - 1 - end]) end++
  return [
    ...old.slice(0, start).map(text => ({ kind: 'same', text })),
    ...old.slice(start, old.length - end).map(text => ({ kind: 'removed', text })),
    ...next.slice(start, next.length - end).map(text => ({ kind: 'added', text })),
    ...old.slice(old.length - end).map(text => ({ kind: 'same', text })),
  ]
}
