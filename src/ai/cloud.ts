import type { Model } from './harness'
export const CLOUD_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT?.trim() ?? ''
export function createCloudModel(endpoint: string): Model {
  return async (prompt, signal) => {
    signal.throwIfAborted()
    if (new TextEncoder().encode(prompt).length > 24_000) throw new Error('送信内容が大きすぎます。図を小さく分けてください。')
    let response: Response
    try { response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal, credentials: 'omit', cache: 'no-store' }) }
    catch (error) { signal.throwIfAborted(); throw new Error('クラウドAIに接続できません。通信状況をご確認ください。', { cause: error }) }
    const text = await response.text()
    if (text.length > 60_000) throw new Error('AIの出力上限を超えました。')
    if (!response.ok) {
      let message = 'クラウドAIを利用できません。時間を置いてお試しください。'
      try { const body = JSON.parse(text); if (typeof body.error === 'string') message = body.error.slice(0, 300) } catch { /* Keep bounded fallback. */ }
      throw new Error(message)
    }
    return text
  }
}
