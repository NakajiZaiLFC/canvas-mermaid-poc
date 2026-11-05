import { describe, expect, it } from 'vitest'
import { runTask } from './harness'

describe('AI candidate harness (model boundary simulated)', () => {
  it('returns only a successfully validated candidate', async () => {
    const result = await runTask({ kind: 'generate', instruction: '利用者からWebへ' }, async () => '{"code":"flowchart LR\\nUser-->Web"}', async code => `<svg>${code}</svg>`, new AbortController().signal)
    expect(result).toEqual({ code: 'flowchart LR\nUser-->Web', svg: '<svg>flowchart LR\nUser-->Web</svg>' })
  })
  it('repairs one invalid response using parser feedback and never loops indefinitely', async () => {
    let attempts = 0
    const prompts: string[] = []
    const result = await runTask({ kind: 'repair', source: 'A[', error: 'unclosed label', instruction: '' }, async prompt => {
      prompts.push(prompt)
      return JSON.stringify({ code: ++attempts === 1 ? 'broken' : 'flowchart LR\nA[完了]' })
    }, async code => { if (code === 'broken') throw new Error('unclosed node'); return '<svg/>' }, new AbortController().signal)
    expect(result.code).toBe('flowchart LR\nA[完了]')
    expect(prompts[1]).toContain('unclosed node')
    expect(prompts[0]).toContain('A[')
    let failures = 0
    await expect(runTask({ kind: 'generate', instruction: '図' }, async () => { failures++; return 'not json' }, async () => '', new AbortController().signal)).rejects.toThrow()
    expect(failures).toBe(2)
  })
  it('does not retry an aborted model request or accept a late response after cancellation', async () => {
    const controller = new AbortController()
    let calls = 0
    await expect(runTask({ kind: 'generate', instruction: '図' }, async () => {
      calls++; controller.abort(); return '{"code":"flowchart LR\\nA-->B"}'
    }, async () => '<svg/>', controller.signal)).rejects.toThrow()
    expect(calls).toBe(1)
  })
  it('rejects oversized or wrong-shaped output before it reaches the parser', async () => {
    let validated = false
    await expect(runTask({ kind: 'generate', instruction: '図' }, async () => JSON.stringify({ code: 'x'.repeat(30_001) }), async () => { validated = true; return '<svg/>' }, new AbortController().signal)).rejects.toThrow()
    expect(validated).toBe(false)
  })
})
