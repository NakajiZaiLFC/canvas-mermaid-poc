import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { expect, it } from 'vitest'

it('real SQLite Durable Object serializes concurrent reservations and rejects global budget overruns', async () => {
  const compiled = await build({ entryPoints: ['server/worker.ts'], bundle: true, format: 'esm', write: false, platform: 'browser' })
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: compiled.outputFiles[0].text + `\nexport class AlarmTestBudget extends DailyBudget { async fetch(request) { if (new URL(request.url).pathname === '/alarm') { await this.alarm(); return new Response('ok'); } return super.fetch(request); } }`, compatibilityDate: '2026-11-06', durableObjects: { BUDGET: { className: 'AlarmTestBudget', useSQLite: true } } }))
  try {
    const ns = await mf.getDurableObjectNamespace('BUDGET')
    const id = ns.idFromName('test')
    const responses = await Promise.all(Array.from({ length: 8 }, () => ns.get(id).fetch('https://budget/reserve', { method: 'POST', body: JSON.stringify({ ip: '192.0.2.1', units: 2000 }) })))
    const results = await Promise.all(responses.map(r => r.json() as Promise<{ allowed: boolean }>))
    expect(results.filter(r => r.allowed)).toHaveLength(2)
    // A delayed previous-day alarm can execute after today's first request.
    await ns.get(id).fetch('https://budget/alarm')
    const afterAlarm = await ns.get(id).fetch('https://budget/reserve', { method: 'POST', body: JSON.stringify({ ip: '192.0.2.1', units: 2000 }) })
    expect(await afterAlarm.json()).toEqual({ allowed: false })
    const next = await ns.get(id).fetch('https://budget/reserve', { method: 'POST', body: JSON.stringify({ ip: '192.0.2.2', units: 39_000 }) })
    expect(await next.json()).toEqual({ allowed: false })
  } finally { await mf.dispose() }
})
