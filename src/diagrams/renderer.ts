export interface DiagramResult { svg?: string; recoverySource?: string; lastValidSource?: string; error?: string; pending: boolean; source: string; generation: number; changedAt: number; measured?: boolean }
export class DiagramRenderer {
  private entries = new Map<string, DiagramResult>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private listeners = new Map<string, Set<() => void>>()
  private cache = new Map<string, string>()
  private queue: Promise<void> = Promise.resolve()
  private serial = 0
  constructor(private draw: (source: string, id: string) => Promise<string>, private settled?: () => void) {}
  get(id: string) { return this.entries.get(id) }
  subscribe(id: string, listener: () => void) {
    const set = this.listeners.get(id) ?? new Set()
    set.add(listener)
    this.listeners.set(id, set)
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(id) }
  }
  private notify(id: string) { this.listeners.get(id)?.forEach(fn => fn()) }
  request(id: string, source: string, recoverySource?: string) {
    const old = this.entries.get(id)
    if (old?.source === source) return
    clearTimeout(this.timers.get(id))
    const entry: DiagramResult = { ...old, recoverySource: old?.recoverySource ?? recoverySource, source, generation: ++this.serial, pending: true, error: undefined, changedAt: performance.now(), measured: false }
    this.entries.set(id, entry)
    this.notify(id)
    const timer = setTimeout(() => {
      this.timers.delete(id)
      this.queue = this.queue.then(async () => {
        if (this.entries.get(id) !== entry) return
        try {
          const key = `${id}\u0000${source}`
          const svg = this.cache.get(key) ?? await this.draw(source, `${id}-g${entry.generation}`)
          if (this.entries.get(id) !== entry) return
          this.cache.set(key, svg)
          if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!)
          entry.svg = svg
          entry.lastValidSource = source
          entry.recoverySource = undefined
          entry.error = undefined
        } catch (error) {
          if (this.entries.get(id) !== entry) return
          entry.error = error instanceof Error ? error.message : String(error)
          const recoverySource = entry.recoverySource
          if (!entry.svg && recoverySource && recoverySource !== source) {
            try {
              const svg = await this.draw(recoverySource, `${id}-recovered-${entry.generation}`)
              if (this.entries.get(id) !== entry) return
              entry.svg = svg; entry.lastValidSource = recoverySource
            } catch { /* Invalid optional recovery must not hide the current source error. */ }
            entry.recoverySource = undefined
          }
          if (this.entries.get(id) !== entry) return
        }
        entry.pending = false
        this.notify(id)
        this.settled?.()
      })
    }, 80)
    this.timers.set(id, timer)
  }
  remove(id: string) {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    this.entries.delete(id)
  }
  destroy() {
    this.timers.forEach(clearTimeout)
    this.timers.clear()
    this.entries.clear()
    this.listeners.clear()
    this.cache.clear()
  }
}
