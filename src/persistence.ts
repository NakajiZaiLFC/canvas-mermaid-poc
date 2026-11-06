import { openDB } from 'idb'

export interface DiagramRecovery { from: number; source: string; lastValidSource: string }
export interface DocumentSnapshot { markdown: string; recovery: DiagramRecovery[] }
const database = () => openDB('canvas-mermaid-v1', 1, { upgrade(db) { db.createObjectStore('documents') } })

export class SaveConflict extends Error {
  constructor() { super('別のタブで文書が更新されたため、自動保存を停止しています。このタブの内容を書き出してから再読み込みしてください。') }
}
function boundedRecovery(value: unknown): DiagramRecovery[] {
  if (!Array.isArray(value)) return []
  let budget = 512_000
  return value.slice(0, 64).filter((item): item is DiagramRecovery => {
    if (!item || !Number.isSafeInteger(item.from) || item.from < 0 || typeof item.source !== 'string' || typeof item.lastValidSource !== 'string' || item.source.length > 30_000 || item.lastValidSource.length > 30_000) return false
    budget -= item.source.length + item.lastValidSource.length
    return budget >= 0
  }).map(({ from, source, lastValidSource }) => ({ from, source, lastValidSource }))
}
function readRecord(record: unknown): { snapshot: DocumentSnapshot; revision: string | null } | null {
  if (record === undefined) return null
  if (!record || typeof record !== 'object') throw new Error('保存データの形式を確認できません。上書きを停止しました。')
  const data = record as Record<string, unknown>
  if (typeof data.markdown !== 'string' || ![1, 2].includes(data.version as number) || (data.version === 2 && typeof data.revision !== 'string')) throw new Error('保存データの形式を確認できません。上書きを停止しました。')
  return { snapshot: { markdown: data.markdown, recovery: boundedRecovery(data.recovery) }, revision: data.version === 2 ? data.revision as string : null }
}

export class DocumentSession {
  private revision: string | null = null
  private loaded = false
  private queue: Promise<void> = Promise.resolve()
  constructor(private key = 'document') {}
  async load(): Promise<DocumentSnapshot | null> {
    const db = await database()
    try {
      const record = readRecord(await db.get('documents', this.key))
      this.revision = record?.revision ?? null
      this.loaded = true
      return record?.snapshot ?? null
    } finally { db.close() }
  }
  save(snapshot: DocumentSnapshot): Promise<void> {
    const operation = this.queue.catch(() => {}).then(async () => {
      if (!this.loaded) throw new Error('保存前に文書を読み込んでください。')
      const db = await database()
      try {
        // Read and conditional write share one transaction: two tabs cannot both win.
        const tx = db.transaction('documents', 'readwrite')
        const current = readRecord(await tx.store.get(this.key))
        if ((current?.revision ?? null) !== this.revision) { await tx.done; throw new SaveConflict() }
        const revision = crypto.randomUUID()
        await tx.store.put({ version: 2, revision, markdown: snapshot.markdown, recovery: boundedRecovery(snapshot.recovery), savedAt: Date.now() }, this.key)
        await tx.done
        this.revision = revision
      } finally { db.close() }
    })
    this.queue = operation
    return operation
  }
}
