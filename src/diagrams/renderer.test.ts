import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagramRenderer } from './renderer'

afterEach(() => vi.useRealTimers())
describe('diagram rendering lifecycle', () => {
  it('retains the last valid SVG after an invalid edit and recovers', async () => {
    vi.useFakeTimers()
    const renderer = new DiagramRenderer(async source => {
      if (source === 'broken') throw new Error('syntax error')
      return `<svg>${source}</svg>`
    })
    renderer.request('a', 'valid')
    await vi.runAllTimersAsync()
    renderer.request('a', 'broken')
    await vi.runAllTimersAsync()
    expect(renderer.get('a')).toMatchObject({ svg: '<svg>valid</svg>', error: 'syntax error' })
    renderer.request('a', 'fixed')
    await vi.runAllTimersAsync()
    expect(renderer.get('a')).toMatchObject({ svg: '<svg>fixed</svg>', error: undefined })
    renderer.destroy()
  })
  it('discards stale async completions and removed blocks', async () => {
    vi.useFakeTimers()
    const pending: Array<(value: string) => void> = []
    const renderer = new DiagramRenderer(() => new Promise(resolve => pending.push(resolve)))
    renderer.request('a', 'old')
    await vi.advanceTimersByTimeAsync(80)
    renderer.request('a', 'new')
    pending[0]('<svg>old</svg>')
    await vi.advanceTimersByTimeAsync(80)
    expect(renderer.get('a')?.svg).toBeUndefined()
    pending[1]('<svg>new</svg>')
    await vi.runAllTimersAsync()
    expect(renderer.get('a')?.svg).toBe('<svg>new</svg>')
    renderer.request('a', 'last')
    await vi.advanceTimersByTimeAsync(80)
    renderer.remove('a')
    pending[2]('<svg>removed</svg>')
    await vi.runAllTimersAsync()
    expect(renderer.get('a')).toBeUndefined()
  })
  it('does not redraw unchanged blocks and isolates duplicate source diagrams', async () => {
    vi.useFakeTimers()
    let draws = 0
    const renderer = new DiagramRenderer(async (_source, id) => `<svg id="${id}-${++draws}"/>`)
    renderer.request('a', 'same')
    renderer.request('b', 'same')
    await vi.runAllTimersAsync()
    const b = renderer.get('b')?.svg
    renderer.request('b', 'same')
    renderer.request('a', 'changed')
    await vi.runAllTimersAsync()
    expect(draws).toBe(3)
    expect(renderer.get('b')?.svg).toBe(b)
    expect(renderer.get('a')?.svg).not.toBe(b)
    renderer.destroy()
  })
})
