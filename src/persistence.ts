import { openDB } from 'idb'

const database = () => openDB('canvas-mermaid-v1', 1, {
  upgrade(db) { db.createObjectStore('documents') },
})
let queue: Promise<void> = Promise.resolve()

export async function loadDocument(key = 'document'): Promise<string | null> {
  const db = await database()
  try {
    const record = await db.get('documents', key)
    if (record === undefined) return null
    if (record?.version !== 1 || typeof record.markdown !== 'string') throw new Error('保存データの形式を確認できません。上書きを停止しました。')
    return record.markdown
  } finally { db.close() }
}

export function saveDocument(markdown: string, key = 'document'): Promise<void> {
  const operation = queue.catch(() => {}).then(async () => {
    const db = await database()
    try { await db.put('documents', { version: 1, markdown, savedAt: Date.now() }, key) }
    finally { db.close() }
  })
  queue = operation
  return operation
}
