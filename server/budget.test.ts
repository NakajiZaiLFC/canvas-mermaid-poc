import { expect, it } from 'vitest'
import { reserve, type Usage } from './budget'

it('reserves output and input before inference; caps shared IP and global budget, then resets on a new UTC day', () => {
  let usage: Usage | undefined
  const now = Date.UTC(2026, 10, 6)
  for (let i = 0; i < 2; i++) {
    const result = reserve(usage, 'same-client', 2000, now)
    expect(result.allowed).toBe(true); usage = result.usage
  }
  expect(reserve(usage, 'same-client', 2000, now).allowed).toBe(false)
  expect(reserve(usage, 'different-client', 39_000, now).allowed).toBe(false)
  for (let i = 0; i < 8; i++) {
    const result = reserve(usage, 'same-client', 2000, now + 60_000 * (i + 1))
    expect(result.allowed).toBe(true); usage = result.usage
  }
  expect(reserve(usage, 'same-client', 2000, now + 900_000).allowed).toBe(false)
  expect(reserve(usage, 'same-client', 2000, now + 86_400_000).allowed).toBe(true)
})
