export interface Usage {
  day: string; units: number; requests: number
  clients: Record<string, { total: number; minute: number; count: number }>
}
export function reserve(previous: Usage | undefined, client: string, units: number, now: number): { allowed: boolean; usage: Usage } {
  const day = new Date(now).toISOString().slice(0, 10), minute = Math.floor(now / 60_000)
  const usage: Usage = previous?.day === day ? previous : { day, units: 0, requests: 0, clients: {} }
  const old = usage.clients[client] ?? { total: 0, minute, count: 0 }
  const count = old.minute === minute ? old.count : 0
  if (!Number.isSafeInteger(units) || units < 1 || usage.units + units > 40_000 || usage.requests >= 50 || old.total >= 10 || count >= 2) return { allowed: false, usage }
  return { allowed: true, usage: { day, units: usage.units + units, requests: usage.requests + 1, clients: { ...usage.clients, [client]: { total: old.total + 1, minute, count: count + 1 } } } }
}
