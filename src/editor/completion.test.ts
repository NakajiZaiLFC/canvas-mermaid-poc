import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { CompletionContext } from '@codemirror/autocomplete'
import { canvasCompletion } from './completion'

function complete(text: string, explicit = false) {
  const pos = text.indexOf('¦')
  const doc = text.replace('¦', '')
  return canvasCompletion(new CompletionContext(EditorState.create({ doc, selection: { anchor: pos }, extensions: [markdown()] }), pos, explicit))
}
const labels = (text: string) => complete(text)?.options.map(o => o.label) ?? []

describe('contextual input assistance', () => {
  it('offers discoverable slash commands and Japanese search without intercepting prose', () => {
    expect(labels('/¦')).toContain('/flow')
    expect(labels('/見出し¦')).toContain('/heading')
    expect(complete('https://example.com/¦')).toBeNull()
    expect(complete('文章を入力¦')).toBeNull()
  })
  it('offers an opening Mermaid fence but never a closing fence or ordinary code', () => {
    expect(labels('```mer¦')).toContain('```mermaid')
    expect(complete('```mermaid\nflowchart LR\nA-->B\n```¦')).toBeNull()
    expect(complete('```js\n/¦\n```')).toBeNull()
    expect(complete('`/¦`')).toBeNull()
  })
  it('completes figure headers, direction and the appropriate arrow family', () => {
    expect(labels('```mermaid\nflo¦\n```')).toContain('flowchart LR')
    expect(labels('```mermaid\nflowchart L¦\n```')).toContain('LR')
    expect(labels('```mermaid\nflowchart LR\nA-¦\n```')).toContain('-->')
    expect(labels('```mermaid\nsequenceDiagram\nUser-¦\n```')).toContain('->>')
  })
  it('offers identifiers from only the current diagram, not labels or comments', () => {
    const labelsHere = labels('```mermaid\nflowchart LR\nSecret-->Other\n```\n\n```mermaid\nflowchart LR\nWeb[ラベル] --> API[別名]\n%% Private --> Hidden\nA¦\n```')
    expect(labelsHere).toContain('API')
    expect(labelsHere).not.toContain('Secret')
    expect(labelsHere).not.toContain('Hidden')
    expect(labelsHere).not.toContain('別名')
  })
  it('replaces an entire partially edited identifier and avoids label interiors', () => {
    const result = complete('```mermaid\nflowchart LR\nAPI-->DB\nA¦PX\n```')!
    expect(result.to! - result.from).toBe(3)
    expect(complete('```mermaid\nflowchart LR\nA[ラ¦ベル]\n```')).toBeNull()
  })
  it('does not consume unrelated prose after a slash command', () => {
    const result = complete('/flo¦w 既存の説明')!
    expect(result.to).toBe(5)
  })
})

it('direction completion preserves statements later on the header line', () => {
  const result = complete('```mermaid\nflowchart L¦R; A-->B\n```')!
  expect(result.to! - result.from).toBe(2)
})
it('header completion changes only the keyword when a diagram already has content', () => {
  const text = '```mermaid\nflo¦wchart LR; A-->B\nC-->D\n```'
  const result = complete(text)!
  expect(text.replace('¦', '').slice(result.from, result.to)).toBe('flowchart')
  expect(result.options.every(option => typeof option.apply !== 'function')).toBe(true)
})

it('finds Japanese intent, full-width commands and small English typos', () => {
  expect(labels('/分岐¦')).toContain('/decision')
  expect(labels('/データベース¦')).toContain('/database')
  expect(labels('/繰り返し¦')).toContain('/loop')
  expect(labels('/ｆｌｏｗ¦')[0]).toBe('/flow')
  expect(labels('/sequnce¦')[0]).toBe('/sequence')
  expect(labels('フロー¦')).toContain('/flow')
  expect(complete('説明をそのまま書き続ける¦')).toBeNull()
  expect(complete('¦', true)?.options.length).toBeGreaterThan(10)
})

it('offers diagram-specific building blocks and targets after arrows', () => {
  expect(labels('```mermaid\nflowchart LR\nsub¦\n```')).toContain('subgraph')
  expect(labels('```mermaid\nsequenceDiagram\nlo¦\n```')).toContain('loop')
  expect(labels('```mermaid\nflowchart LR\nlo¦\n```')).not.toContain('loop')
  expect(labels('```mermaid\nflowchart LR\nWeb-->API; API-->DB\nWeb --> ¦\n```')).toContain('DB')
  expect(labels('```mermaid\nsequenceDiagram\nparticipant User\nparticipant API\nUser->>¦\n```')).toContain('API')
  expect(complete('```mermaid\nsequenceDiagram\nUser->>API: メッセージ¦\n```')).toBeNull()
  expect(complete('```mermaid\nflowchart LR\nA -->|ラベル¦\n```')).toBeNull()
})

it('does not offer structural plain-language completion over an existing prose suffix', () => {
  expect(complete('フロー¦図について説明')).toBeNull()
  expect(complete('flow¦chartについて説明')).toBeNull()
})

it('finds Japanese diagram actions in their own diagram family', () => {
  expect(labels('```mermaid\nflowchart LR\n分岐¦\n```')).toContain('decision')
  expect(labels('```mermaid\nsequenceDiagram\n分岐¦\n```')).toContain('alt')
  expect(labels('```mermaid\nsequenceDiagram\n分岐¦\n```')).not.toContain('participant')
  expect(complete('```mermaid\nsequenceDiagram\n分岐¦\n```')?.filter).toBe(false)
  expect(labels('```mermaid\nsequenceDiagram\n繰り返し¦\n```')).toContain('loop')
})
