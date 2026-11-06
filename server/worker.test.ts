import { expect, it, vi } from 'vitest'
import { handle, type Env } from './worker'
const origin = 'https://nakajizailfc.github.io'
function env(allow = true): Env {
  return { ENABLED: 'true', ALLOWED_ORIGIN: origin, AI: { run: vi.fn(async () => ({ response: JSON.stringify({ code: 'flowchart LR\nA-->B' }) })) }, BUDGET: { getByName: () => ({ fetch: async () => Response.json({ allowed: allow }) }) } }
}
const request = (body = JSON.stringify({ prompt: '利用者からAPIへ送信する図' }), requestOrigin = origin) => new Request('https://ai.example/ai', { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body })
it('rejects origin, oversized body, malformed prompt and exhausted budget before inference', async () => {
  const config = env()
  expect((await handle(request(undefined, 'https://evil.invalid'), config)).status).toBe(403)
  expect((await handle(request('x'.repeat(49_000)), config)).status).toBe(413)
  expect((await handle(request('{"prompt":42}'), config)).status).toBe(400)
  expect(config.AI.run).not.toHaveBeenCalled()
  const limited = env(false)
  expect((await handle(request(), limited)).status).toBe(429)
  expect(limited.AI.run).not.toHaveBeenCalled()
})
it('returns constrained code with exact CORS and never exposes provider errors', async () => {
  const config = env()
  const response = await handle(request(), config)
  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ code: 'flowchart LR\nA-->B' })
  config.AI.run = async () => { throw new Error('private provider details') }
  const failed = await handle(request(), config)
  expect(failed.status).toBe(502)
  expect(await failed.text()).not.toContain('private provider details')
})
it('fails closed when disabled or when the model returns an invalid object', async () => {
  const config = env(); config.ENABLED = 'false'
  expect((await handle(request(), config)).status).toBe(503)
  expect(config.AI.run).not.toHaveBeenCalled()
  config.ENABLED = 'true'; config.AI.run = async () => ({ response: '{"javascript":"alert(1)"}' })
  expect((await handle(request(), config)).status).toBe(502)
})
