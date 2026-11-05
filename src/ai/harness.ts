export type AITask = { kind: 'generate'; instruction: string } | { kind: 'repair'; source: string; error: string; instruction: string }
export interface Candidate { code: string; svg: string }
export type Model = (prompt: string, signal: AbortSignal) => Promise<string>
export async function runTask(task: AITask, model: Model, validate: (code: string) => Promise<string>, signal: AbortSignal): Promise<Candidate> {
  if (task.instruction.length > 4000) throw new Error('指示は4,000文字以内にしてください。')
  if (task.kind === 'repair' && task.source.length > 30_000) throw new Error('対象の図が大きすぎます。')
  const original = task.kind === 'generate'
    ? `Create a small Mermaid flowchart or sequence diagram from the user's Japanese instruction. Keep Japanese labels.\nInstruction: ${task.instruction}`
    : `Repair ONLY the syntax of this Mermaid diagram. Preserve all nodes, labels and connections; do not add new ideas.\nSource:\n${task.source}\nParser error: ${task.error.slice(0, 2000)}\nAdditional instruction: ${task.instruction}`
  let feedback = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted()
    const response = await model(`${original}\nReturn exactly a JSON object with one string field "code" containing Mermaid, without fences or commentary.${feedback}`, signal)
    signal.throwIfAborted()
    try {
      if (response.length > 60_000) throw new Error('AIの出力が長すぎます。')
      const value: unknown = JSON.parse(response)
      if (!value || typeof value !== 'object' || !('code' in value) || typeof value.code !== 'string' || Object.keys(value).length !== 1) throw new Error('AI応答は {"code":"…"} 形式である必要があります。')
      const code = value.code.trim()
      if (!code || code.length > 30_000) throw new Error('AIのコードが空、または長すぎます。')
      const svg = await validate(code)
      signal.throwIfAborted()
      return { code, svg }
    } catch (error) {
      signal.throwIfAborted()
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === 1) throw new Error(`有効な図を生成できませんでした。${message}`, { cause: error })
      feedback = `\nPrevious invalid response:\n${response.slice(0, 30_000)}\nValidation error: ${message.slice(0, 2000)}\nCorrect the error and return the JSON object.`
    }
  }
  throw new Error('有効な候補がありません。')
}
