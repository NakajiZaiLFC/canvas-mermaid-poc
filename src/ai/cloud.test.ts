import { afterEach, expect, it, vi } from 'vitest'
import { createCloudModel } from './cloud'
afterEach(() => vi.unstubAllGlobals())
it('sends only the bounded task prompt and carries cancellation; exposes a limited-service error', async () => {
  const signal = new AbortController().signal
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    expect(options.signal).toBe(signal)
    expect(JSON.parse(options.body as string)).toEqual({ prompt: 'diagram instruction' })
    return Response.json({ code: 'flowchart LR\nA-->B' })
  })
  vi.stubGlobal('fetch', fetcher)
  const model = createCloudModel('https://ai.example/ai')
  expect(JSON.parse(await model('diagram instruction', signal))).toEqual({ code: 'flowchart LR\nA-->B' })
  vi.stubGlobal('fetch', async () => Response.json({ error: '利用上限です' }, { status: 429 }))
  await expect(model('diagram instruction', signal)).rejects.toThrow('利用上限')
})
it('rejects excessive UTF8 input before sending', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await expect(createCloudModel('https://ai.example/ai')('あ'.repeat(9000), new AbortController().signal)).rejects.toThrow('大きすぎ')
  expect(fetcher).not.toHaveBeenCalled()
})
